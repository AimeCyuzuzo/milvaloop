import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.use(cookieParser());
  await app.listen(env.PORT);
}
void bootstrap();
