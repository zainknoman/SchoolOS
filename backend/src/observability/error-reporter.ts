import { randomUUID } from 'crypto';
import { scrub, scrubString } from './scrub';

/**
 * Error reporting (BL-11), provider-agnostic: the app talks to this interface only. The built-in
 * implementation speaks the Sentry envelope protocol (supported by Sentry and compatible
 * services such as GlitchTip) with no SDK dependency; it is enabled by SENTRY_DSN and otherwise a
 * no-op. Every event is scrubbed before it leaves the process; sending never throws.
 */
export const ERROR_REPORTER = 'ERROR_REPORTER';

export interface ErrorContext {
  requestId?: string;
  method?: string;
  path?: string;
  userId?: string;
  status?: number;
}

export interface ErrorReporter {
  readonly enabled: boolean;
  report(error: unknown, context?: ErrorContext): Promise<void>;
}

export class NoopErrorReporter implements ErrorReporter {
  readonly enabled = false;
  report(): Promise<void> {
    return Promise.resolve();
  }
}

interface ParsedDsn {
  envelopeUrl: string;
  publicKey: string;
}

/** https://<key>@<host>[/<path>]/<projectId> -> envelope endpoint + key. */
export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const parts = u.pathname.split('/').filter(Boolean);
    const projectId = parts.pop();
    if (!u.username || !projectId) return null;
    const prefix = parts.length ? `/${parts.join('/')}` : '';
    return {
      publicKey: decodeURIComponent(u.username),
      envelopeUrl: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

export function buildEvent(
  error: unknown,
  context: ErrorContext,
  meta: { environment?: string; release?: string },
): Record<string, unknown> {
  const err = error instanceof Error ? error : new Error(String(error));
  return scrub({
    event_id: randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    environment: meta.environment,
    release: meta.release,
    exception: {
      values: [
        {
          type: err.name,
          value: scrubString(err.message),
          stacktrace: {
            frames: (err.stack ?? '')
              .split('\n')
              .slice(1)
              .map((l) => ({ function: scrubString(l.trim()) }))
              .reverse(),
          },
        },
      ],
    },
    request: context.path
      ? { method: context.method, url: context.path }
      : undefined,
    tags: { requestId: context.requestId, status: context.status },
    // Only an opaque id — never identifier/e-mail/name.
    user: context.userId ? { id: context.userId } : undefined,
  });
}

export class SentryEnvelopeReporter implements ErrorReporter {
  readonly enabled = true;
  constructor(
    private readonly dsn: ParsedDsn,
    private readonly meta: { environment?: string; release?: string },
    private readonly send: typeof fetch = fetch,
  ) {}

  async report(error: unknown, context: ErrorContext = {}): Promise<void> {
    const event = buildEvent(error, context, this.meta);
    const body = [
      JSON.stringify({
        event_id: event.event_id,
        sent_at: new Date().toISOString(),
      }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(event),
    ].join('\n');
    try {
      await this.send(this.dsn.envelopeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${this.dsn.publicKey}, sentry_client=schoolos/1.0`,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Reporting is best-effort: a tracker outage must never affect a request.
    }
  }
}

export function createErrorReporter(
  get: (k: string) => string | undefined,
): ErrorReporter {
  const raw = get('SENTRY_DSN')?.trim();
  if (!raw) return new NoopErrorReporter();
  const dsn = parseDsn(raw);
  if (!dsn) throw new Error('SENTRY_DSN is not a valid DSN.');
  return new SentryEnvelopeReporter(dsn, {
    environment: get('SENTRY_ENVIRONMENT') ?? get('NODE_ENV'),
    release: get('APP_RELEASE'),
  });
}
