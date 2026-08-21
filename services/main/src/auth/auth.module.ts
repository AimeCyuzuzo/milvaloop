import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  // No default secret/TTL here — access and refresh tokens use different
  // secrets, passed explicitly on every sign/verify call in AuthService.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, PermissionsGuard],
  // AccessTokenGuard/PermissionsGuard are the mechanism every future
  // protected route (members, contributions, ...) will use to gate access —
  // exported so other feature modules can apply them without redeclaring.
  // AuthService is exported too so CooperativesModule can create a
  // cooperative for an already-authenticated user without duplicating the
  // tenant+membership transaction logic.
  exports: [AuthService, AccessTokenGuard, PermissionsGuard],
})
export class AuthModule {}
