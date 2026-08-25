import { Controller, Get, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AccessTokenClaims } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditLogService } from './audit-log.service';

// Full transparency, same as contributions (see MAIN.md) — every read here
// needs nothing beyond a valid session. There's nothing to mutate through
// this controller; every audit event is written by the feature that
// produced it, in the same transaction as the change itself.
@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  async list(@CurrentUser() claims: AccessTokenClaims) {
    return this.auditLogService.list(claims.tenantId);
  }
}
