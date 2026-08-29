import { LoggingPushAdapter } from './logging-push.adapter';

describe('LoggingPushAdapter', () => {
  it('resolves without throwing — this sprint has no real Firebase project to send through', async () => {
    const adapter = new LoggingPushAdapter();
    await expect(
      adapter.send('user-1', { title: 'Hi', body: 'Hello', data: { type: 'message' } }),
    ).resolves.toBeUndefined();
  });
});
