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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  bulkContributionIdsSchema,
  bulkRejectSchema,
  contributionIdParamSchema,
  contributionListQuerySchema,
  membershipIdParamSchema,
  previewAllocationSchema,
  recordContributionSchema,
  recordHistoricalBatchSchema,
  rejectContributionSchema,
  setSharePriceSchema,
  sharePriceIdParamSchema,
  unapproveContributionSchema,
  updateSharePriceSchema,
  PERMISSIONS,
  type BulkContributionIdsInput,
  type BulkRejectInput,
  type ContributionIdParam,
  type ContributionListQuery,
  type MembershipIdParam,
  type PreviewAllocationInput,
  type RecordContributionInput,
  type RecordHistoricalBatchInput,
  type RejectContributionInput,
  type SetSharePriceInput,
  type SharePriceIdParam,
  type UnapproveContributionInput,
  type UpdateSharePriceInput,
} from '@milvaloop/types';
import type { Response } from 'express';

import { AccessTokenGuard, type AccessTokenClaims } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContributionsService } from './contributions.service';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendWorkbook(
  res: Response,
  { buffer, filename }: { buffer: Buffer; filename: string },
): StreamableFile {
  res.set({
    'Content-Type': XLSX_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  return new StreamableFile(buffer);
}

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

  @Get('compliance-summary')
  @UseGuards(AccessTokenGuard)
  async getComplianceSummary(@CurrentUser() claims: AccessTokenClaims) {
    return this.contributionsService.getTenantComplianceSummary(
      claims.tenantId,
    );
  }

  @Get('analytics')
  @UseGuards(AccessTokenGuard)
  async getAnalytics(@CurrentUser() claims: AccessTokenClaims) {
    return this.contributionsService.getAnalytics(claims.tenantId);
  }

  @Get('export')
  @UseGuards(AccessTokenGuard)
  async exportLedger(
    @CurrentUser() claims: AccessTokenClaims,
    @Query(new ZodValidationPipe(contributionListQuerySchema))
    query: ContributionListQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const workbook = await this.contributionsService.exportLedger(
      claims.tenantId,
      query,
    );
    return sendWorkbook(res, workbook);
  }

  @Get('analytics/export')
  @UseGuards(AccessTokenGuard)
  async exportAnalytics(
    @CurrentUser() claims: AccessTokenClaims,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const workbook = await this.contributionsService.exportAnalytics(
      claims.tenantId,
    );
    return sendWorkbook(res, workbook);
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

  // Registered after every other static GET route above (settings,
  // compliance-summary, analytics, export, members/:membershipId/summary)
  // — a bare :id param route has to come last among GET routes or it
  // would swallow those more specific paths as if "settings" or
  // "analytics" were a contribution id.
  @Get(':id')
  @UseGuards(AccessTokenGuard)
  async getDetail(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(contributionIdParamSchema))
    params: ContributionIdParam,
  ) {
    return this.contributionsService.getContributionDetail(
      claims.tenantId,
      params.id,
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

  @Patch('settings/:id')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_SETTINGS)
  async updateSharePrice(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(sharePriceIdParamSchema))
    params: SharePriceIdParam,
    @Body(new ZodValidationPipe(updateSharePriceSchema))
    body: UpdateSharePriceInput,
  ) {
    return this.contributionsService.updateSharePrice(
      claims.tenantId,
      claims.sub,
      params.id,
      body,
    );
  }

  @Delete('settings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_SETTINGS)
  async deleteSharePrice(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(sharePriceIdParamSchema))
    params: SharePriceIdParam,
  ) {
    await this.contributionsService.deleteSharePrice(
      claims.tenantId,
      claims.sub,
      params.id,
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

  // The historical-entry grid's submission — always an explicit admin
  // action on behalf of others, never a "record my own" self-service call
  // like the plain POST above, so it's gated on the permission rather than
  // left to the service's per-target check.
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_RECORD)
  async recordHistoricalBatch(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(recordHistoricalBatchSchema))
    body: RecordHistoricalBatchInput,
  ) {
    return this.contributionsService.recordHistoricalBatch(
      claims.tenantId,
      claims.sub,
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

  // A convenience over approving one at a time after a large import — see
  // ContributionsService.approveAllPending.
  @Post('approve-all-pending')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async approveAllPending(@CurrentUser() claims: AccessTokenClaims) {
    return this.contributionsService.approveAllPending(
      claims.tenantId,
      claims.sub,
    );
  }

  // The ledger table's row-selection floating bar — approve/reject an
  // explicit set of ids in one action, see ContributionsService.bulkApprove/
  // bulkReject for why this is exactly as guarded as clicking Approve/Reject
  // on each row individually.
  @Post('bulk-approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async bulkApprove(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(bulkContributionIdsSchema))
    body: BulkContributionIdsInput,
  ) {
    return this.contributionsService.bulkApprove(
      claims.tenantId,
      claims.sub,
      body.ids,
    );
  }

  @Post('bulk-reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async bulkReject(
    @CurrentUser() claims: AccessTokenClaims,
    @Body(new ZodValidationPipe(bulkRejectSchema))
    body: BulkRejectInput,
  ) {
    return this.contributionsService.bulkReject(
      claims.tenantId,
      claims.sub,
      body.ids,
      body.reason,
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

  @Post(':id/unapprove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTRIBUTIONS_APPROVE)
  async unapprove(
    @CurrentUser() claims: AccessTokenClaims,
    @Param(new ZodValidationPipe(contributionIdParamSchema))
    params: ContributionIdParam,
    @Body(new ZodValidationPipe(unapproveContributionSchema))
    body: UnapproveContributionInput,
  ) {
    await this.contributionsService.unapproveContribution(
      claims.tenantId,
      claims.sub,
      params.id,
      body.reason,
    );
  }
}
