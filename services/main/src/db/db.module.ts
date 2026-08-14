import { Global, Module } from '@nestjs/common';
import { createDb } from '@milvaloop/db';

import { env } from '../config/env';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => createDb(env.DATABASE_URL),
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DbModule {}
