/** Raised by withTimeout when the wrapped promise does not settle in time. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * KI-5: bounds an outbound call (push, WhatsApp, SMS, e-mail) so a hung provider cannot hold a
 * request or a job open. The underlying call is not cancelled — use an AbortSignal where the
 * client supports one — but the caller stops waiting and records a failure.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
