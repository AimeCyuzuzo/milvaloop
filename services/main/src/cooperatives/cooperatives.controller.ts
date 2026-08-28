import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createCooperativeSchema,
  slugPreviewQuerySchema,
  PERMISSIONS,
  type CreateCooperativeInput,
  type SlugPreviewQuery,
} from '@milvaloop/types';
import type { Request, Response } from 'express';

import { AccessTokenGuard, type AccessTokenClaims } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { readRefreshCookie, setRefreshCookie } from '../auth/refresh-cookie';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

// An already-authenticated user creating a brand-new cooperative. Distinct
// from signup (no new user, no email/password) and from
// /auth/cooperatives/* (those finish an in-progress login via a ticket;
// this is ordinary resource creation by someone already fully signed in).
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly authService: AuthService) {}

  // Same abuse profile as signup — it inserts a tenant row.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post()
  @UseGuards(AccessTokenGuard)
  async create(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(createCooperativeSchema))
    body: CreateCooperativeInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.authService.createCooperative(
        claims,
        body,
        readRefreshCookie(req),
      );
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  // Marks the active tenant's guided setup wizard done (see
  // apps/web/app/(app)/onboarding) — only its founder/admin can finish
  // setup on behalf of the whole cooperative.
  @Post('complete-onboarding')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TENANT_ADMIN)
  async completeOnboarding(@CurrentUser() claims: AccessTokenClaims) {
    await this.authService.completeOnboarding(claims.tenantId);
  }

  // Public — shows a live "this will be created at ___" preview as the user
  // types a cooperative name, before any account/cooperative necessarily
  // exists yet (signup, the login-ticket create-first-cooperative flow),
  // as well as an already-authenticated user adding another one. Advisory
  // only: AuthService.previewCooperativeSlug never trusts a client-supplied
  // slug (there isn't one — see createCooperativeSchema), and the actual
  // creation path re-derives and re-checks it independently.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('slug-preview')
  async previewSlug(
    @Query(new ZodValidationPipe(slugPreviewQuerySchema))
    query: SlugPreviewQuery,
  ) {
    return this.authService.previewCooperativeSlug(query.name);
  }
}
