// CLI entry for BL-19: `npm run openapi` (writes docs/api/openapi.json) and `npm run openapi:check`
// (fails when the committed file is out of date). Runs the compiled dist build, where the swagger
// compiler plugin has filled in the DTO schemas; the app is created in preview mode, so nothing
// connects to a database.
import 'dotenv/config';
import './openapi-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { buildOpenApiDocument, serialiseOpenApi } from '../config/openapi';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main(): Promise<number> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const text = serialiseOpenApi(buildOpenApiDocument(app));
  await app.close();

  const file = join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'docs',
    'api',
    'openapi.json',
  );
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    } catch {
      // missing file = out of date
    }
    if (current !== text) {
      console.error(
        'docs/api/openapi.json is out of date — run `npm run build && npm run openapi` and commit it',
      );
      return 1;
    }
    console.log('docs/api/openapi.json is up to date');
    return 0;
  }
  writeFileSync(file, text);
  const doc = JSON.parse(text) as { paths: Record<string, object> };
  console.log(`wrote ${file} (${Object.keys(doc.paths).length} paths)`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  },
);
