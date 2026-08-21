import { Global, Module } from '@nestjs/common';
import { createMailer } from '@milvaloop/email';

import { env } from '../config/env';

export const MAILER = Symbol('MAILER');

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      useFactory: () =>
        createMailer({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          from: env.SMTP_FROM,
        }),
    },
  ],
  exports: [MAILER],
})
export class MailerModule {}
