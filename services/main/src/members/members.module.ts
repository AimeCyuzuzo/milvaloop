import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  // JwtModule.register({}) repeated here for the same reason as
  // CooperativesModule — AccessTokenGuard is applied directly on
  // MembersController via @UseGuards, so JwtService needs to resolve
  // against this module too, not just AuthModule's.
  imports: [AuthModule, JwtModule.register({})],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
