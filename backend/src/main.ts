import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { buildCorsOriginOption } from './config/cors.config';
import { applyHttpSecurity } from './config/app-security';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers (helmet) and trust-proxy handling (BL-12).
  applyHttpSecurity(app);

  // staff-console (a different origin) calls this API directly and needs CORS; so does a locally
  // previewed parent-app (`flutter run -d chrome`). Scoped to a known allow-list in
  // staging/production (env-driven via CORS_ORIGINS, per Sprint B hardening) — see
  // buildCorsOriginOption for the dev/test-only localhost carve-out.
  app.enableCors({
    origin: buildCorsOriginOption(
      process.env.CORS_ORIGINS,
      process.env.NODE_ENV,
    ),
  });

  // Enforces every DTO's class-validator decorators (e.g. LoginDto) on every request; without this
  // the decorators are inert and bad input reaches the service layer unchecked.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start Nest application', err);
  process.exit(1);
});
