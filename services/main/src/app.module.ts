import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CooperativesModule } from './cooperatives/cooperatives.module';
import { DbModule } from './db/db.module';
import { MailerModule } from './email/mailer.module';
import { MembersModule } from './members/members.module';

@Module({
  imports: [
    // Default cap for every route; auth endpoints override this with
    // tighter, purpose-specific limits (see AuthController). In-memory
    // storage is fine for the single-instance deployment this is built for
    // today (see docs/DEPLOYMENT.md) — move to Redis-backed storage if this
    // ever runs as more than one instance, since in-memory counters aren't
    // shared across processes.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    DbModule,
    MailerModule,
    AuditModule,
    AuthModule,
    CooperativesModule,
    MembersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
