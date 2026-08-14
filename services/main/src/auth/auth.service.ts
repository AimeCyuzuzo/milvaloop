import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, schema, type Database } from '@milvaloop/db';
import type { Mailer } from '@milvaloop/email';
import {
  PERMISSIONS,
  type AuthSession,
  type CurrentSession,
  type LoginInput,
  type MagicLinkRequestInput,
  type SignupInput,
} from '@milvaloop/types';
import * as argon2 from 'argon2';

import { isUniqueViolation } from '../common/db-errors';
import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import { MAILER } from '../email/mailer.module';
import type { AccessTokenClaims } from './auth.guard';
import {
  generateOpaqueToken,
  hashToken,
  parseTtlMs,
  parseTtlSeconds,
} from './tokens';

const { tenants, users, memberships, sessions, magicLinkTokens } = schema;

// Single-use, short-lived by design — not worth exposing as an env var.
const MAGIC_LINK_TTL = '15m';

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class AuthService {
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
          const [tenant] = await tx
            .insert(tenants)
            .values({ name: input.tenantName, slug: input.tenantSlug })
            .returning();
          const [user] = await tx
            .insert(users)
            .values({ email: input.email, passwordHash })
            .returning();
          const [membership] = await tx
            .insert(memberships)
            .values({
              userId: user.id,
              tenantId: tenant.id,
              permissions: [PERMISSIONS.TENANT_ADMIN],
            })
            .returning();
          return { tenant, user, membership };
        },
      );

      return this.issueSession(user, tenant, membership.permissions);
    } catch (error) {
      if (isUniqueViolation(error, 'tenants_slug_unique')) {
        throw new ConflictException('This cooperative name is already taken');
      }
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password');

    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, input.tenantSlug))
      .limit(1);
    if (!tenant) {
      throw invalidCredentials();
    }

    const [row] = await this.db
      .select({ user: users, membership: memberships })
      .from(users)
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, users.id),
          eq(memberships.tenantId, tenant.id),
        ),
      )
      .where(eq(users.email, input.email))
      .limit(1);
    if (!row) {
      throw invalidCredentials();
    }

    const passwordValid = await argon2.verify(
      row.user.passwordHash,
      input.password,
    );
    if (!passwordValid) {
      throw invalidCredentials();
    }

    return this.issueSession(row.user, tenant, row.membership.permissions);
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
    // Never reveal whether the tenant/account exists — same response either
    // way (see CODE_QUALITY.md's account-enumeration rule).
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, input.tenantSlug))
      .limit(1);
    if (!tenant) {
      return;
    }

    const [row] = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, users.id),
          eq(memberships.tenantId, tenant.id),
        ),
      )
      .where(eq(users.email, input.email))
      .limit(1);
    if (!row) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(MAGIC_LINK_TTL));

    await this.db.insert(magicLinkTokens).values({
      userId: row.user.id,
      tenantId: tenant.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const loginUrl = `${env.WEB_ORIGIN}/auth/magic-link?token=${rawToken}`;
    await this.mailer.send({
      to: row.user.email,
      subject: `Sign in to ${tenant.name}`,
      html: `<p>Click the link below to sign in to <strong>${tenant.name}</strong> on MilvaLoop.</p><p><a href="${loginUrl}">${loginUrl}</a></p><p>This link expires in 15 minutes and can only be used once. If you didn't request it, ignore this email.</p>`,
      text: `Sign in to ${tenant.name}: ${loginUrl}\n\nThis link expires in 15 minutes and can only be used once. If you didn't request it, ignore this email.`,
    });
  }

  async consumeMagicLink(rawToken: string): Promise<IssuedSession> {
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

    const { tenant, user, membership } = await this.loadSessionContext(
      record.userId,
      record.tenantId,
    );
    if (!tenant || !user || !membership) {
      throw invalid();
    }

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
      user: { id: user.id, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      permissions: membership.permissions,
    };
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

    return {
      refreshToken,
      refreshTokenExpiresAt,
      session: {
        accessToken,
        user: { id: user.id, email: user.email },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        permissions,
      },
    };
  }
}
