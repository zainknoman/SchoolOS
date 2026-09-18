import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

// Module-level singleton — mirrors useConfirm.ts's queue pattern, so any component can push a
// toast without prop-drilling. Only one <ToastHost> is ever mounted (in AppShell.vue).
const toasts = ref<ToastItem[]>([]);
let nextId = 0;
const AUTO_DISMISS_MS = 4000;

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function push(tone: ToastTone, message: string): void {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, tone, message }];
  setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
}

export function useToast() {
  return {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  };
}

// Internal — consumed only by ToastHost.vue to render/dismiss the stack.
export function useToastQueue() {
  return { toasts, dismiss };
}
