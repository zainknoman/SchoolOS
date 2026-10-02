import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { isDevOrTestEnv } from './env.validation';

/**
 * BL-19 (KI-11): the OpenAPI contract of the API. Request/response schemas come from the DTO
 * classes through the @nestjs/swagger compiler plugin (nest-cli.json), so the document is complete
 * only from a `nest build` output — `npm run openapi` regenerates docs/api/openapi.json from there.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SchoolOS API')
    .setDescription(
      'Staff console and parent app API. Every route needs `Authorization: Bearer <access token>` ' +
        'unless it is public (login, refresh, password reset, health). Role and school/campus ' +
        'scope are enforced server-side (see docs/api/ENDPOINTS.md).',
    )
    .setVersion('1')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

/**
 * Interactive docs at /api/docs — development/test only, or when OPENAPI_UI=enabled (e.g. on
 * staging). Production does not advertise its API surface by default.
 */
export function mountOpenApiUi(
  app: INestApplication,
  env: Record<string, string | undefined>,
): boolean {
  const enabled =
    env.OPENAPI_UI === 'enabled' ||
    (env.OPENAPI_UI !== 'disabled' && isDevOrTestEnv(env.NODE_ENV));
  if (!enabled) return false;
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  return true;
}

/** Stable text form (sorted keys) so the committed file only changes when the API does. */
export function serialiseOpenApi(doc: OpenAPIObject): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(doc), null, 2) + '\n';
}
