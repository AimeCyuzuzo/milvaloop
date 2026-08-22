import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  createFirstCooperativeSchema,
  emailVerificationConsumeSchema,
  forgotPasswordSchema,
  loginSchema,
  magicLinkConsumeSchema,
  magicLinkRequestSchema,
  resetPasswordSchema,
  selectCooperativeSchema,
  signupSchema,
  switchCooperativeSchema,
  type ChangePasswordInput,
  type CreateFirstCooperativeInput,
  type EmailVerificationConsumeInput,
  type ForgotPasswordInput,
  type LoginInput,
  type LoginResult,
  type MagicLinkConsumeInput,
  type MagicLinkRequestInput,
  type ResetPasswordInput,
  type SelectCooperativeInput,
  type SignupInput,
  type SwitchCooperativeInput,
} from '@milvaloop/types';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AccessTokenGuard, type AccessTokenClaims } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { toLoginResponse } from './login-response';
import {
  readRefreshCookie,
  setRefreshCookie,
  REFRESH_COOKIE,
} from './refresh-cookie';
import { env } from '../config/env';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Creates a tenant — expensive and abuse-prone, so it gets the tightest
  // limit of any auth route.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.signup(body);
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  // Protects against credential-stuffing/brute-force login attempts.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const outcome = await this.authService.login(body);
    return toLoginResponse(outcome, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = readRefreshCookie(req);
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.refresh(rawRefreshToken);
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return { accessToken: session.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, {
      path: '/auth',
      domain: env.COOKIE_DOMAIN,
    });
  }

  // Each request sends a real email — a low limit both prevents brute-force
  // account probing and stops this from being used to spam a target inbox.
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post('magic-link/request')
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(
    @Body(new ZodValidationPipe(magicLinkRequestSchema))
    body: MagicLinkRequestInput,
  ) {
    await this.authService.requestMagicLink(body);
    // Always the same response, whether or not the account exists.
    return { message: 'If that account exists, a sign-in link has been sent.' };
  }

  // The token itself is unguessable (256 bits), but still throttled to slow
  // down scripted abuse against this endpoint.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('magic-link/consume')
  @HttpCode(HttpStatus.OK)
  async consumeMagicLink(
    @Body(new ZodValidationPipe(magicLinkConsumeSchema))
    body: MagicLinkConsumeInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const outcome = await this.authService.consumeMagicLink(body.token);
    return toLoginResponse(outcome, res);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@CurrentUser() claims: AccessTokenClaims) {
    return this.authService.getCurrentSession(claims);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(emailVerificationConsumeSchema))
    body: EmailVerificationConsumeInput,
  ) {
    await this.authService.verifyEmail(body.token);
    return { message: 'Email verified.' };
  }

  // Authenticated (not by email/tenant) — a user can only ever resend their
  // own verification email, so there's no enumeration surface to protect.
  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async resendEmailVerification(@CurrentUser() claims: AccessTokenClaims) {
    await this.authService.resendEmailVerification(claims);
    return {
      message: 'If your email is not yet verified, a new link has been sent.',
    };
  }

  // Same reasoning as magic-link/request: sends a real email, so it gets a
  // tight limit. No cooperative field — a password belongs to the user.
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    body: ForgotPasswordInput,
  ) {
    await this.authService.forgotPassword(body);
    // Always the same response, whether or not the account exists.
    return {
      message: 'If that account exists, a password reset link has been sent.',
    };
  }

  // No session issued here — the caller logs in fresh with the new
  // password (see AuthService.resetPassword's session-revocation note).
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    await this.authService.resetPassword(body);
    return {
      message: 'Password changed. Please log in with your new password.',
    };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async changePassword(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
  ) {
    await this.authService.changePassword(claims, body);
    return { message: 'Password changed.' };
  }

  // Finishes a 'selection_required' login — no guard, the ticket itself is
  // the credential (it can only ever resolve to the ticket-holder's own
  // memberships).
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('cooperatives/select')
  @HttpCode(HttpStatus.OK)
  async selectCooperative(
    @Body(new ZodValidationPipe(selectCooperativeSchema))
    body: SelectCooperativeInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.selectCooperative(body);
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  // Finishes a 'no_cooperatives' login by creating the user's first
  // cooperative — same abuse profile as select-cooperative (ticket-gated).
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('cooperatives/create-from-ticket')
  @HttpCode(HttpStatus.OK)
  async createFirstCooperativeFromTicket(
    @Body(new ZodValidationPipe(createFirstCooperativeSchema))
    body: CreateFirstCooperativeInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.createFirstCooperativeFromTicket(body);
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  // Already-authenticated — no ticket needed, the access token already
  // proves identity. Low abuse surface, same convention as
  // password/change and email/resend (no custom throttle).
  @Post('cooperatives/switch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async switchCooperative(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(switchCooperativeSchema))
    body: SwitchCooperativeInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.switchCooperative(
        claims,
        body,
        readRefreshCookie(req),
      );
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }
}
