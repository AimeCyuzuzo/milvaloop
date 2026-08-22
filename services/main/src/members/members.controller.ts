import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  acceptInviteSchema,
  inviteMemberSchema,
  inviteTokenParamSchema,
  membershipIdParamSchema,
  membershipInviteIdParamSchema,
  updateMemberPermissionsSchema,
  PERMISSIONS,
  type AcceptInviteInput,
  type InviteMemberInput,
  type InviteTokenParam,
  type LoginResult,
  type MembershipIdParam,
  type MembershipInviteIdParam,
  type UpdateMemberPermissionsInput,
} from '@milvaloop/types';
import type { Request, Response } from 'express';

import { AccessTokenGuard, type AccessTokenClaims } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { toLoginResponse } from '../auth/login-response';
import { readRefreshCookie, setRefreshCookie } from '../auth/refresh-cookie';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // Ungated beyond having a valid session — every member of a cooperative
  // can see who else is in it.
  @Get()
  @UseGuards(AccessTokenGuard)
  async list(@CurrentUser() claims: AccessTokenClaims) {
    return this.membersService.list(claims.tenantId);
  }

  // Sends a real email — same abuse profile as the other email-sending auth
  // routes, loosened slightly since this one is authenticated (a legitimate
  // admin setting up a cooperative may invite several people in one sitting).
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MEMBERS_INVITE)
  async invite(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ) {
    return this.membersService.invite(claims.tenantId, claims.sub, body);
  }

  @Post('invites/:id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MEMBERS_INVITE)
  async revokeInvite(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(membershipInviteIdParamSchema))
    params: MembershipInviteIdParam,
  ) {
    await this.membersService.revokeInvite(
      claims.tenantId,
      claims.sub,
      params.id,
    );
  }

  @Patch(':membershipId/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MEMBERS_EDIT)
  async updatePermissions(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(membershipIdParamSchema))
    params: MembershipIdParam,
    @Body(new ZodValidationPipe(updateMemberPermissionsSchema))
    body: UpdateMemberPermissionsInput,
  ) {
    await this.membersService.updatePermissions(
      claims.tenantId,
      claims.sub,
      params.membershipId,
      body.permissions,
    );
  }

  @Delete(':membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MEMBERS_REMOVE)
  async remove(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(membershipIdParamSchema))
    params: MembershipIdParam,
  ) {
    await this.membersService.remove(
      claims.tenantId,
      claims.sub,
      params.membershipId,
    );
  }

  // Public, read-only — never consumes the invite, so it's safe for the
  // frontend to call on every load/reload of the accept page (see
  // docs/plans/invite-accept-rework.md). Same throttle tier as
  // magic-link/consume: arbitrary user input, no session required.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Get('invites/lookup')
  async lookupInvite(
    @Query(new ZodValidationPipe(inviteTokenParamSchema))
    query: InviteTokenParam,
  ) {
    return this.membersService.lookupInvite(query.token);
  }

  // Authenticated — the invitee already has a session; this only ever adds
  // a membership to *that* account (see MembersService.joinViaInvite).
  // Same convention as /auth/cooperatives/switch: identity is already
  // proven, no extra throttle beyond the global default.
  @Post('invites/:token/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async joinViaInvite(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(inviteTokenParamSchema))
    params: InviteTokenParam,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken, refreshTokenExpiresAt } =
      await this.membersService.joinViaInvite(
        claims,
        params.token,
        readRefreshCookie(req),
      );
    setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return session;
  }

  // Public — reached only once lookup reports hasAccount: false. The token
  // itself is unguessable (256 bits), but still throttled to slow down
  // scripted abuse, same reasoning as magic-link/consume.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('invites/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const outcome = await this.membersService.acceptInvite(body);
    return toLoginResponse(outcome, res);
  }
}
