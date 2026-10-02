import { TimeoutError, withTimeout } from './with-timeout';

describe('withTimeout (KI-5)', () => {
  it('returns the value of a call that settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 50, 'x')).resolves.toBe(7);
  });

  it('passes through the call’s own error', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 50, 'x'),
    ).rejects.toThrow('boom');
  });

  it('rejects with a TimeoutError when the call hangs', async () => {
    const hang = new Promise<void>(() => undefined);
    await expect(withTimeout(hang, 20, 'push delivery')).rejects.toThrow(
      new TimeoutError('push delivery', 20),
    );
  });
});
