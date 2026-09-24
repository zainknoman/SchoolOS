import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/** Per-request context (BL-11): the request id follows the request through every await. */
export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

// An upstream proxy/load balancer may already have assigned an id; accept it only when it is a
// short, safe token so it cannot inject into logs or headers.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : randomUUID();
}
