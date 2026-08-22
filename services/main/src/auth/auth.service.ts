import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, schema, type Database } from '@milvaloop/db';
import {
  EmailVerificationEmail,
  MagicLinkEmail,
  PasswordResetEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import {
  isReservedSlug,
  PERMISSIONS,
  slugify,
  type AuthSession,
  type ChangePasswordInput,
  type CooperativeSummary,
  type CreateCooperativeInput,
  type CreateFirstCooperativeInput,
  type CurrentSession,
  type ForgotPasswordInput,
  type LoginInput,
  type MagicLinkRequestInput,
  type ResetPasswordInput,
  type SelectCooperativeInput,
  type SignupInput,
  type SlugPreviewResult,
  type SwitchCooperativeInput,
} from '@milvaloop/types';
import * as argon2 from 'argon2';

import { isUniqueViolation } from '../common/db-errors';
import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import type { Transaction } from '../db/types';
import { MAILER } from '../email/mailer.module';
import type { AccessTokenClaims } from './auth.guard';
import {
  generateOpaqueToken,
  hashToken,
  parseTtlMs,
  parseTtlSeconds,
} from './tokens';

const {
  tenants,
  users,
  memberships,
  sessions,
  magicLinkTokens,
  emailVerificationTokens,
  passwordResetTokens,
} = schema;

// Single-use, short-lived by design — not worth exposing as an env var.
const MAGIC_LINK_TTL = '15m';
const EMAIL_VERIFICATION_TTL = '24h';
const PASSWORD_RESET_TTL = '1h';
// Long enough to read a short cooperative list or fill in a name once —
// this never leaves the browser (unlike magic-link/reset, it's never
// emailed), so there's no reason to extend it further.
const LOGIN_TICKET_TTL = '5m';
const LOGIN_TICKET_PURPOSE = 'login-ticket';
// Bounds the "-<n>" disambiguation loop in insertTenantAndMembership /
// previewCooperativeSlug — astronomically generous for how many
// cooperatives could ever share the same generated base slug.
const MAX_SLUG_ATTEMPTS = 25;

// Per-IP throttling (see AuthController) doesn't stop a distributed request
// flood aimed at a single inbox. A short cooldown on the account itself
// closes that gap without needing to reveal whether the account exists.
const MAGIC_LINK_COOLDOWN_MS = 60_000;
const EMAIL_VERIFICATION_COOLDOWN_MS = 60_000;
const PASSWORD_RESET_COOLDOWN_MS = 60_000;

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// The service-internal result of "identity proven, now what" — login and
// magic-link consume both resolve to this; the controller flattens it into
// the wire-shaped LoginResult (see @milvaloop/types).
export type LoginOutcome =
  | { status: 'authenticated'; issued: IssuedSession }
  | {
      status: 'selection_required';
      ticket: string;
      cooperatives: CooperativeSummary[];
    }
  | { status: 'no_cooperatives'; ticket: string };

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
}

interface LoginTicketClaims {
  sub: string;
  purpose: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly jwtService: JwtService,
  ) {}

  async signup(input: SignupInput): Promise<IssuedSession> {
    const passwordHash = await argon2.hash(input.password);

    try {
      const { user, tenant, membership } = await this.db.transaction(
        async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({ email: input.email, passwordHash })
            .returning();
          const { tenant, membership } = await this.insertTenantAndMembership(
            tx,
            user.id,
            input.tenantName,
          );
          return { tenant, user, membership };
        },
      );

      // Side effects external to the database happen after the transaction
      // commits, not inside it (see PROJECT_SETUP_GUIDE.md §5). A failed
      // send shouldn't fail signup itself — the account and session are
      // already valid; the user can request another verification email.
      await this.sendEmailVerification(user, tenant).catch((error: unknown) => {
        this.logger.error(
          `Failed to send verification email to user ${user.id}`,
          error,
        );
      });

      return this.issueSession(user, tenant, membership.permissions);
    } catch (error) {
      // tenants_slug_unique is never surfaced here — insertTenantAndMembership
      // resolves that itself by trying the next disambiguated candidate.
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<LoginOutcome> {
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password');

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user) {
      throw invalidCredentials();
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordValid) {
      throw invalidCredentials();
    }

    return this.finishLogin(user);
  }

  async refresh(rawRefreshToken: string): Promise<IssuedSession> {
    const invalid = () =>
      new UnauthorizedException('Invalid or expired refresh token');

    let claims: { sub: string };
    try {
      claims = await this.jwtService.verifyAsync<{ sub: string }>(
        rawRefreshToken,
        { secret: env.JWT_REFRESH_SECRET },
      );
    } catch {
      throw invalid();
    }

    const tokenHash = hashToken(rawRefreshToken);
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, tokenHash))
      .limit(1);

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session?.revokedAt) {
        // This refresh token was already rotated once before and is being
        // presented again — a strong signal it leaked. Kill every other
        // session for this user as a precaution.
        await this.revokeAllSessions(claims.sub);
      }
      throw invalid();
    }

    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));

    const { tenant, user, membership } = await this.loadSessionContext(
      session.userId,
      session.tenantId,
    );
    if (!tenant || !user || !membership) {
      throw invalid();
    }

    return this.issueSession(user, tenant, membership.permissions);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = hashToken(rawRefreshToken);
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, tokenHash));
  }

  async requestMagicLink(input: MagicLinkRequestInput): Promise<void> {
    // Never reveal whether the account exists — same response either way
    // (see CODE_QUALITY.md's account-enumeration rule).
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user) {
      return;
    }

    const [recentToken] = await this.db
      .select({ id: magicLinkTokens.id })
      .from(magicLinkTokens)
      .where(
        and(
          eq(magicLinkTokens.userId, user.id),
          gt(
            magicLinkTokens.createdAt,
            new Date(Date.now() - MAGIC_LINK_COOLDOWN_MS),
          ),
        ),
      )
      .limit(1);
    if (recentToken) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(MAGIC_LINK_TTL));

    await this.db.insert(magicLinkTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const loginUrl = `${env.WEB_ORIGIN}/auth/magic-link?token=${rawToken}`;
    const { html, text } = await renderEmail(MagicLinkEmail({ loginUrl }));
    // Caught rather than thrown: an SMTP failure here must not turn into a
    // response difference between "account exists" and "account doesn't" —
    // that would reopen the enumeration gap this endpoint exists to close.
    await this.mailer
      .send({ to: user.email, subject: 'Sign in to MilvaLoop', html, text })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send magic-link email to user ${user.id}`,
          error,
        );
      });
  }

  async consumeMagicLink(rawToken: string): Promise<LoginOutcome> {
    const invalid = () =>
      new UnauthorizedException('This link is invalid or has expired');

    const tokenHash = hashToken(rawToken);
    const [record] = await this.db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.tokenHash, tokenHash))
      .limit(1);
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw invalid();
    }

    await this.db
      .update(magicLinkTokens)
      .set({ consumedAt: new Date() })
      .where(eq(magicLinkTokens.id, record.id));

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, record.userId))
      .limit(1);
    if (!user) {
      throw invalid();
    }

    return this.finishLogin(user);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const invalid = () =>
      new UnauthorizedException('This link is invalid or has expired');

    const tokenHash = hashToken(rawToken);
    const [record] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw invalid();
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerificationTokens.id, record.id));
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, record.userId));
    });
  }

  async resendEmailVerification(claims: AccessTokenClaims): Promise<void> {
    const { tenant, user } = await this.loadSessionContext(
      claims.sub,
      claims.tenantId,
    );
    if (!tenant || !user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const [fullUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (fullUser?.emailVerifiedAt) {
      return;
    }

    await this.sendEmailVerification(user, tenant);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    // Never reveal whether the account exists — same response either way
    // (see CODE_QUALITY.md's account-enumeration rule). No cooperative
    // context at all — a password belongs to the user, not a membership.
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user) {
      return;
    }

    const [recentToken] = await this.db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gt(
            passwordResetTokens.createdAt,
            new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS),
          ),
        ),
      )
      .limit(1);
    if (recentToken) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(PASSWORD_RESET_TTL));

    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const resetUrl = `${env.WEB_ORIGIN}/auth/reset-password?token=${rawToken}`;
    const { html, text } = await renderEmail(PasswordResetEmail({ resetUrl }));
    await this.mailer
      .send({
        to: user.email,
        subject: 'Reset your MilvaLoop password',
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send password-reset email to user ${user.id}`,
          error,
        );
      });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const invalid = () =>
      new UnauthorizedException('This link is invalid or has expired');

    const tokenHash = hashToken(input.token);
    const [record] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw invalid();
    }

    const passwordHash = await argon2.hash(input.newPassword);

    await this.db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id));
      await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, record.userId));
    });

    // A password reset means the old one may have been compromised — kill
    // every existing session rather than leave them valid under the new
    // password's authority. The caller logs in fresh afterward.
    await this.revokeAllSessions(record.userId);
  }

  async changePassword(
    claims: AccessTokenClaims,
    input: ChangePasswordInput,
  ): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const currentPasswordValid = await argon2.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!currentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(input.newPassword);
    await this.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    // Same reasoning as resetPassword: a password change invalidates every
    // other session. The device that just changed it keeps working off its
    // still-valid access token until that expires, then re-authenticates.
    await this.revokeAllSessions(user.id);
  }

  async selectCooperative(
    input: SelectCooperativeInput,
  ): Promise<IssuedSession> {
    const userId = await this.verifyLoginTicket(input.ticket);
    const invalid = () =>
      new UnauthorizedException("You don't have access to that cooperative");

    const [row] = await this.db
      .select({ user: users, tenant: tenants, membership: memberships })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.tenantId, input.cooperativeId),
        ),
      )
      .limit(1);
    if (!row) {
      throw invalid();
    }

    return this.issueSession(row.user, row.tenant, row.membership.permissions);
  }

  async createFirstCooperativeFromTicket(
    input: CreateFirstCooperativeInput,
  ): Promise<IssuedSession> {
    const expired = () =>
      new UnauthorizedException(
        'This selection has expired — please log in again',
      );
    const userId = await this.verifyLoginTicket(input.ticket);

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw expired();
    }

    const { tenant, membership } = await this.insertTenantAndMembership(
      this.db,
      userId,
      input.name,
    );
    return this.issueSession(user, tenant, membership.permissions);
  }

  async switchCooperative(
    claims: AccessTokenClaims,
    input: SwitchCooperativeInput,
    rawRefreshToken: string | undefined,
  ): Promise<IssuedSession> {
    const [row] = await this.db
      .select({ user: users, tenant: tenants, membership: memberships })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.userId, claims.sub),
          eq(memberships.tenantId, input.cooperativeId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new UnauthorizedException(
        "You don't have access to that cooperative",
      );
    }

    await this.revokeSession(rawRefreshToken);
    return this.issueSession(row.user, row.tenant, row.membership.permissions);
  }

  async createCooperative(
    claims: AccessTokenClaims,
    input: CreateCooperativeInput,
    rawRefreshToken: string | undefined,
  ): Promise<IssuedSession> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const { tenant, membership } = await this.insertTenantAndMembership(
      this.db,
      user.id,
      input.name,
    );
    await this.revokeSession(rawRefreshToken);
    return this.issueSession(user, tenant, membership.permissions);
  }

  async getCurrentSession(claims: AccessTokenClaims): Promise<CurrentSession> {
    const { tenant, user, membership } = await this.loadSessionContext(
      claims.sub,
      claims.tenantId,
    );
    if (!tenant || !user || !membership) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
      },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      permissions: membership.permissions,
      cooperatives: await this.listCooperatives(user.id),
    };
  }

  // Shared by login and consumeMagicLink: once identity is proven, resolve
  // to a session (exactly one membership), or a ticket for the caller to
  // finish with — either picking one of several, or creating their first.
  // Public, not private — the members module's accept-invite flow is a
  // second real consumer (see docs/plans/members-management.md): a newly
  // created or newly added membership needs exactly this 1-cooperative/
  // many-cooperatives branching to decide what to do next, same as login.
  async finishLogin(user: UserRow): Promise<LoginOutcome> {
    const rows = await this.db
      .select({ tenant: tenants, membership: memberships })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .where(eq(memberships.userId, user.id));

    if (rows.length === 1) {
      const { tenant, membership } = rows[0];
      const issued = await this.issueSession(
        user,
        tenant,
        membership.permissions,
      );
      return { status: 'authenticated', issued };
    }

    const ticket = await this.signLoginTicket(user.id);
    if (rows.length === 0) {
      return { status: 'no_cooperatives', ticket };
    }
    return {
      status: 'selection_required',
      ticket,
      cooperatives: rows.map(({ tenant }) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      })),
    };
  }

  // Shared by signup (nested inside its own user-creating transaction),
  // createCooperative, and createFirstCooperativeFromTicket — inserts a
  // tenant with a slug generated from `name` (never client-supplied, see
  // tenant.ts's slugify) and the creator's founding TENANT_ADMIN membership.
  //
  // Each candidate slug is attempted inside its own `tx.transaction(...)` —
  // a real transaction when `tx` is the top-level `this.db`, or a SAVEPOINT
  // when `tx` is already inside one (signup's case). Either way, a
  // collision only rolls back that one attempt, never the caller's outer
  // work — the DB's unique constraint (not a check-then-write gap) is what
  // actually decides a collision, per CODE_QUALITY.md.
  private async insertTenantAndMembership(
    tx: Database | Transaction,
    userId: string,
    name: string,
  ): Promise<{ tenant: TenantRow; membership: { permissions: string[] } }> {
    const base = slugify(name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = this.slugCandidate(base, attempt);
      if (isReservedSlug(candidate)) {
        continue;
      }
      try {
        return await tx.transaction(async (savepoint) => {
          const [tenant] = await savepoint
            .insert(tenants)
            .values({ name, slug: candidate })
            .returning();
          const [membership] = await savepoint
            .insert(memberships)
            .values({
              userId,
              tenantId: tenant.id,
              permissions: [PERMISSIONS.TENANT_ADMIN],
            })
            .returning();
          return { tenant, membership };
        });
      } catch (error) {
        if (isUniqueViolation(error, 'tenants_slug_unique')) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Could not generate a unique address for this cooperative name — try a different name',
    );
  }

  // Advisory only — shown to the user as a live "this will be created at
  // ___" preview while typing a name (never editable). The actual creation
  // path re-derives and re-checks the slug itself rather than trusting this
  // response, so a stale preview can never produce a colliding slug.
  async previewCooperativeSlug(name: string): Promise<SlugPreviewResult> {
    const base = slugify(name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = this.slugCandidate(base, attempt);
      if (isReservedSlug(candidate)) {
        continue;
      }
      const [existing] = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, candidate))
        .limit(1);
      if (!existing) {
        return { slug: candidate };
      }
    }

    throw new ConflictException(
      'Could not generate a unique address for this cooperative name — try a different name',
    );
  }

  private slugCandidate(base: string, attempt: number): string {
    return attempt === 0 ? base : `${base}-${attempt + 1}`;
  }

  private async listCooperatives(
    userId: string,
  ): Promise<CooperativeSummary[]> {
    const rows = await this.db
      .select({ tenant: tenants })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .where(eq(memberships.userId, userId));
    return rows.map(({ tenant }) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    }));
  }

  private async signLoginTicket(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        purpose: LOGIN_TICKET_PURPOSE,
        jti: generateOpaqueToken(),
      },
      {
        secret: env.AUTH_TICKET_SECRET,
        expiresIn: parseTtlSeconds(LOGIN_TICKET_TTL),
      },
    );
  }

  // Verifies AND checks purpose explicitly — even though a dedicated secret
  // already means this ticket can never verify as an access/refresh token,
  // the purpose claim is defense-in-depth for the day a second ticket kind
  // (e.g. a future invite-acceptance ticket) shares this same secret.
  private async verifyLoginTicket(rawTicket: string): Promise<string> {
    const invalid = () =>
      new UnauthorizedException(
        'This selection has expired — please log in again',
      );
    let claims: LoginTicketClaims;
    try {
      claims = await this.jwtService.verifyAsync<LoginTicketClaims>(rawTicket, {
        secret: env.AUTH_TICKET_SECRET,
      });
    } catch {
      throw invalid();
    }
    if (claims.purpose !== LOGIN_TICKET_PURPOSE) {
      throw invalid();
    }
    return claims.sub;
  }

  private async sendEmailVerification(
    user: UserRow,
    tenant: TenantRow,
  ): Promise<void> {
    const [recentToken] = await this.db
      .select({ id: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          eq(emailVerificationTokens.tenantId, tenant.id),
          gt(
            emailVerificationTokens.createdAt,
            new Date(Date.now() - EMAIL_VERIFICATION_COOLDOWN_MS),
          ),
        ),
      )
      .limit(1);
    if (recentToken) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(EMAIL_VERIFICATION_TTL));

    await this.db.insert(emailVerificationTokens).values({
      userId: user.id,
      tenantId: tenant.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const verifyUrl = `${env.WEB_ORIGIN}/auth/verify-email?token=${rawToken}`;
    const { html, text } = await renderEmail(
      EmailVerificationEmail({ tenantName: tenant.name, verifyUrl }),
    );
    await this.mailer.send({
      to: user.email,
      subject: `Verify your email for ${tenant.name}`,
      html,
      text,
    });
  }

  private async loadSessionContext(userId: string, tenantId: string) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [membership] = await this.db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)),
      )
      .limit(1);

    return { tenant, user, membership };
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, userId));
  }

  private async revokeSession(
    rawRefreshToken: string | undefined,
  ): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, hashToken(rawRefreshToken)));
  }

  private async issueSession(
    user: UserRow,
    tenant: TenantRow,
    permissions: string[],
  ): Promise<IssuedSession> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, tenantId: tenant.id, email: user.email, permissions },
      {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: parseTtlSeconds(env.JWT_ACCESS_TTL),
      },
    );

    // `jti` guarantees two refresh tokens for the same user are never
    // byte-identical even if issued within the same second — jsonwebtoken
    // signs deterministically, and a payload of just `{ sub }` would
    // otherwise collide with the sessions table's unique hash constraint.
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: generateOpaqueToken() },
      {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: parseTtlSeconds(env.JWT_REFRESH_TTL),
      },
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + parseTtlMs(env.JWT_REFRESH_TTL),
    );

    await this.db.insert(sessions).values({
      userId: user.id,
      tenantId: tenant.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });

    const cooperatives = await this.listCooperatives(user.id);

    return {
      refreshToken,
      refreshTokenExpiresAt,
      session: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: !!user.emailVerifiedAt,
        },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        permissions,
        cooperatives,
      },
    };
  }
}
