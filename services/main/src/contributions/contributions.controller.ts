import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  contributionIdParamSchema,
  contributionListQuerySchema,
  membershipIdParamSchema,
  previewAllocationSchema,
  recordContributionSchema,
  rejectContributionSchema,
  setSharePriceSchema,
  PERMISSIONS,
  type ContributionIdParam,
  type ContributionListQuery,
  type MembershipIdParam,
  type PreviewAllocationInput,
  type RecordContributionInput,
  type RejectContributionInput,
  type SetSharePriceInput,
} from '@milvaloop/types';

import { AccessTokenGuard, type AccessTokenClaims } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContributionsService } from './contributions.service';

// Transparency by design (see the feature plan): every read here needs
// nothing beyond a valid session — any active member can see any other
// member's contribution history. Only the mutating routes below are
// permission-gated.
@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  async list(
    @CurrentUser() claims: AccessTokenClaims,
    @Query(new ZodValidationPipe(contributionListQuerySchema))
    query: ContributionListQuery,
  ) {
    return this.contributionsService.listContributions(claims.tenantId, query);
  }

  @Get('settings')
  @UseGuards(AccessTokenGuard)
  async getSettings(@CurrentUser() claims: AccessTokenClaims) {
    return this.contributionsService.getSettings(claims.tenantId);
  }

  @Get('members/:membershipId/summary')
  @UseGuards(AccessTokenGuard)
  async getMemberSummary(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(membershipIdParamSchema))
    params: MembershipIdParam,
  ) {
    return this.contributionsService.getMemberSummary(
      claims.tenantId,
      params.membershipId,
    );
  }

  @Post('settings')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_SETTINGS)
  async setSharePrice(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(setSharePriceSchema)) body: SetSharePriceInput,
  ) {
    return this.contributionsService.setSharePrice(
      claims.tenantId,
      claims.sub,
      body,
    );
  }

  // Every active member may preview/record a contribution for themselves —
  // no permission needed for that. Recording for someone else still needs
  // CONTRIBUTIONS_RECORD (or TENANT_ADMIN); that's a per-target decision
  // the service makes, since it depends on whose membershipId is in the
  // body, so PermissionsGuard's blanket allow/deny can't express it. 200,
  // not the POST default of 201 — a preview creates nothing.
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async preview(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(previewAllocationSchema))
    body: PreviewAllocationInput,
  ) {
    return this.contributionsService.previewAllocation(
      claims.tenantId,
      claims.sub,
      claims.permissions,
      body,
    );
  }

  // No content, not 201 — recordContribution returns void (the caller
  // already has everything it sent; nothing new to hand back), and a
  // "created" status without a body representation is a lie the frontend
  // shouldn't have to work around.
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  async record(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(recordContributionSchema))
    body: RecordContributionInput,
  ) {
    await this.contributionsService.recordContribution(
      claims.tenantId,
      claims.sub,
      claims.permissions,
      body,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async approve(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(contributionIdParamSchema))
    params: ContributionIdParam,
  ) {
    await this.contributionsService.approveContribution(
      claims.tenantId,
      claims.sub,
      params.id,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async reject(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(contributionIdParamSchema))
    params: ContributionIdParam,
    @Body(new ZodValidationPipe(rejectContributionSchema))
    body: RejectContributionInput,
  ) {
    await this.contributionsService.rejectContribution(
      claims.tenantId,
      claims.sub,
      params.id,
      body.reason,
    );
  }
}
