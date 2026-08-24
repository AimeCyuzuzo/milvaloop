import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { ContributionReminderService } from './contribution-reminders.service';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

@Module({
  // JwtModule.register({}) repeated here for the same reason as
  // MembersModule — AccessTokenGuard is applied directly on
  // ContributionsController via @UseGuards, so JwtService needs to resolve
  // against this module too, not just AuthModule's.
  imports: [AuthModule, JwtModule.register({})],
  controllers: [ContributionsController],
  providers: [ContributionsService, ContributionReminderService],
})
export class ContributionsModule {}
