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
import {
  loginSchema,
  magicLinkConsumeSchema,
  magicLinkRequestSchema,
  signupSchema,
  type LoginInput,
  type MagicLinkConsumeInput,
  type MagicLinkRequestInput,
  type SignupInput,
} from '@milvaloop/types';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { env } from '../config/env';
import { AccessTokenGuard, type AccessTokenClaims } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';

const REFRESH_COOKIE = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.signup(body);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.login(body);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = this.readRefreshCookie(req);
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.refresh(rawRefreshToken);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return { accessToken: session.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(this.readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, {
      path: '/auth',
      domain: env.COOKIE_DOMAIN,
    });
  }

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

  @Post('magic-link/consume')
  @HttpCode(HttpStatus.OK)
  async consumeMagicLink(
    @Body(new ZodValidationPipe(magicLinkConsumeSchema))
    body: MagicLinkConsumeInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.consumeMagicLink(body.token);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@CurrentUser() claims: AccessTokenClaims) {
    return this.authService.getCurrentSession(claims);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: env.COOKIE_DOMAIN,
      path: '/auth',
      expires: expiresAt,
    });
  }
}
