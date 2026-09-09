import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // staff-console (Vite dev server, a different origin) and the future parent app both call this
  // API directly — CORS must be open to them, not just same-origin.
  //app.enableCors();

  // Enforces every DTO's class-validator decorators (e.g. LoginDto) on every request; without this
  // the decorators are inert and bad input reaches the service layer unchecked.
  //app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  //await app.listen(process.env.PORT ?? 3000);

  // staff-console (a different origin) calls this API directly and needs CORS; the parent app is
  // a Flutter mobile client, not subject to CORS. Scoped to a known allow-list (env-driven via
  // CORS_ORIGINS) rather than reflecting any Origin, per Sprint B hardening.
  app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });

  // Enforces every DTO's class-validator decorators (e.g. LoginDto) on every request; without this
  // the decorators are inert and bad input reaches the service layer unchecked.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start Nest application', err);
  process.exit(1);
});
