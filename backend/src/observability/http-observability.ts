import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext, resolveRequestId } from './request-context';
import { pathOnly } from './scrub';

/**
 * Request id + access log (BL-11), shared by main.ts and the e2e suite. Every request runs inside
 * a request context (so logs and error responses carry its id), the id is echoed in
 * `X-Request-Id`, and one access-log line is written per request — path WITHOUT the query string,
 * because download links carry `?access_token=`.
 */
export function applyRequestObservability(app: INestApplication): void {
  const access = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    res.setHeader('X-Request-Id', requestId);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      requestContext.run({ requestId }, () => {
        access.log({
          msg: 'request',
          method: req.method,
          path: pathOnly(req.originalUrl ?? req.url),
          status: res.statusCode,
          durationMs: Math.round(ms),
        });
      });
    });
    requestContext.run({ requestId }, () => next());
  });
}
