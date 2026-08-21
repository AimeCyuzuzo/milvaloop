import { Global, Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';

// Global like DbModule/MailerModule — every feature module that mutates
// tenant-scoped data ends up needing this, not just members.
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
