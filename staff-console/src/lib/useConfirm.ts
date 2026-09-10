import { ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Module-level singleton — shared by every component that calls useConfirm(), so a confirmation
// can be requested from any component without prop-drilling a shared instance down to it. Only
// one <ConfirmDialog> is ever mounted (in AppShell.vue), reading this same queue.
const queue = ref<PendingConfirm[]>([]);

function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.value = [...queue.value, { ...opts, resolve }];
  });
}

function resolveActive(result: boolean): void {
  const [active, ...rest] = queue.value;
  queue.value = rest;
  active?.resolve(result);
}

export function useConfirm() {
  return { confirm };
}

// Internal — consumed only by ConfirmDialog.vue to render/resolve the head of the queue.
export function useConfirmQueue() {
  return { queue, resolveActive };
}
