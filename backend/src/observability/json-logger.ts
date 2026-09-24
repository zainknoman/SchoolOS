import { LoggerService, LogLevel } from '@nestjs/common';
import { currentRequestId } from './request-context';
import { scrub, scrubString } from './scrub';

const LEVEL_ORDER: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

/**
 * One JSON object per line (BL-11) — what log collectors ingest without parsing rules. Every line
 * carries the current request id (when inside a request) and passes through the scrubber.
 * Selected by LOG_FORMAT=json (the default outside development/test).
 */
export class JsonLogger implements LoggerService {
  private readonly minLevel: number;

  constructor(
    level: string = 'log',
    private readonly write: (line: string, isError: boolean) => void = (
      line,
      isError,
    ) => (isError ? process.stderr : process.stdout).write(`${line}\n`),
  ) {
    const idx = LEVEL_ORDER.indexOf(level as LogLevel);
    this.minLevel = idx === -1 ? LEVEL_ORDER.indexOf('log') : idx;
  }

  log(message: unknown, ...rest: unknown[]) {
    this.emit('log', message, rest);
  }
  error(message: unknown, ...rest: unknown[]) {
    this.emit('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]) {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]) {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]) {
    this.emit('verbose', message, rest);
  }
  fatal(message: unknown, ...rest: unknown[]) {
    this.emit('fatal', message, rest);
  }

  private emit(level: LogLevel, message: unknown, rest: unknown[]) {
    if (LEVEL_ORDER.indexOf(level) < this.minLevel) return;
    // Nest passes the context as the last string argument; for error() a stack precedes it.
    const args = [...rest];
    const context =
      typeof args[args.length - 1] === 'string'
        ? (args.pop() as string)
        : undefined;
    const stack =
      typeof args[0] === 'string' ? (args.shift() as string) : undefined;
    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      ...(currentRequestId() ? { requestId: currentRequestId() } : {}),
    };
    if (message && typeof message === 'object' && !(message instanceof Error)) {
      Object.assign(entry, scrub(message as Record<string, unknown>));
    } else if (message instanceof Error) {
      entry.message = scrubString(message.message);
      entry.stack = scrubString(message.stack ?? '');
    } else {
      entry.message = scrubString(String(message));
    }
    if (stack) entry.stack = scrubString(stack);
    if (args.length) entry.extra = scrub(args);
    this.write(JSON.stringify(entry), level === 'error' || level === 'fatal');
  }
}
