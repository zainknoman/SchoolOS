import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_REPORTER, type ErrorReporter } from './error-reporter';
import { currentRequestId } from './request-context';
import { pathOnly } from './scrub';

/**
 * Global exception filter (BL-11). HttpExceptions keep the exact body shape the clients rely on,
 * plus `requestId`. Anything else is an unexpected failure: the client gets a generic 500 (no
 * internals), the full error is logged with the request id and sent to the error reporter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(
    @Inject(ERROR_REPORTER) private readonly reporter: ErrorReporter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { user?: { id?: string } }>();
    const requestId = currentRequestId();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body =
        typeof payload === 'string'
          ? { statusCode: status, message: payload }
          : { ...(payload as Record<string, unknown>) };
      if (status >= 500)
        this.reportUnexpected(exception, req, status, requestId);
      res.status(status).json({ ...body, ...(requestId ? { requestId } : {}) });
      return;
    }

    this.reportUnexpected(
      exception,
      req,
      HttpStatus.INTERNAL_SERVER_ERROR,
      requestId,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      ...(requestId ? { requestId } : {}),
    });
  }

  private reportUnexpected(
    exception: unknown,
    req: Request & { user?: { id?: string } },
    status: number,
    requestId: string | undefined,
  ) {
    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    const path = pathOnly(req.originalUrl ?? req.url ?? '');
    this.logger.error(
      `${req.method} ${path} -> ${status}: ${err.message}`,
      err.stack,
    );
    void this.reporter.report(err, {
      requestId,
      method: req.method,
      path,
      userId: req.user?.id,
      status,
    });
  }
}
