import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Content-Disposition isn't on the CORS-safelisted response header list,
  // so without this a cross-origin fetch() (the web app is a different
  // origin from this API even in local dev) can't read the filename an
  // export endpoint names its file — see ExportService/StreamableFile
  // responses and apps/web/lib/api/api-fetch.ts's apiFetchBlob.
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  app.use(cookieParser());

  if (env.NODE_ENV === 'production') {
    // The target production topology puts exactly one reverse proxy in
    // front (see docs/DEPLOYMENT.md) — without this, req.ip resolves to the
    // proxy's own address for every request, collapsing per-IP rate limits
    // onto a single shared bucket for all traffic.
    app.set('trust proxy', 1);
  }

  await app.listen(env.PORT);
}
void bootstrap();
