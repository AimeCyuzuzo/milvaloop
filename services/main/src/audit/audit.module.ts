import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit-log.service';

// Global like DbModule/MailerModule — every feature module that mutates
// tenant-scoped data ends up needing AuditLogService, not just members.
// JwtModule.register({}) repeated here for the same reason as
// ContributionsModule — AccessTokenGuard is applied directly on
// AuditController via @UseGuards, so JwtService needs to resolve against
// this module too, not just AuthModule's.
@Global()
@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [AuditController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
