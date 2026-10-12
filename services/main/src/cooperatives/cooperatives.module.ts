import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { CooperativesController } from './cooperatives.controller';
import { TenantTrialReminderService } from './tenant-trial-reminders.service';

@Module({
  // JwtModule.register({}) is repeated here (also in AuthModule) because
  // AccessTokenGuard is applied directly on CooperativesController via
  // @UseGuards — Nest resolves a class-referenced guard's own dependencies
  // against the guard's *host* module, not the module it was exported from,
  // so JwtService needs to be resolvable here too. Cheap and stateless to
  // register twice; no secret/TTL is configured on either registration (see
  // AuthModule's comment — every sign/verify call passes its own secret).
  imports: [AuthModule, JwtModule.register({})],
  controllers: [CooperativesController],
  providers: [TenantTrialReminderService],
})
export class CooperativesModule {}
