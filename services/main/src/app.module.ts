import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { MailerModule } from './email/mailer.module';

@Module({
  imports: [DbModule, MailerModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
