import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirm, useConfirmQueue } from './useConfirm';

describe('useConfirm', () => {
  beforeEach(() => {
    useConfirmQueue().queue.value = [];
  });

  it('resolves true when the active confirm is accepted', async () => {
    const { confirm } = useConfirm();
    const { queue, resolveActive } = useConfirmQueue();

    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true });
    expect(queue.value).toHaveLength(1);
    expect(queue.value[0]!.title).toBe('Delete this school?');

    resolveActive(true);
    await expect(promise).resolves.toBe(true);
    expect(queue.value).toHaveLength(0);
  });

  it('resolves false when the active confirm is declined', async () => {
    const { confirm } = useConfirm();
    const { resolveActive } = useConfirmQueue();

    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    resolveActive(false);
    await expect(promise).resolves.toBe(false);
  });

  it('queues a second confirm behind the first, resolving each independently in order', async () => {
    const { confirm } = useConfirm();
    const { queue, resolveActive } = useConfirmQueue();

    const first = confirm({ title: 'First', message: 'm1' });
    const second = confirm({ title: 'Second', message: 'm2' });
    expect(queue.value).toHaveLength(2);
    expect(queue.value[0]!.title).toBe('First');

    resolveActive(true);
    await expect(first).resolves.toBe(true);
    expect(queue.value).toHaveLength(1);
    expect(queue.value[0]!.title).toBe('Second');

    resolveActive(false);
    await expect(second).resolves.toBe(false);
    expect(queue.value).toHaveLength(0);
  });
});
