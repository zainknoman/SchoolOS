import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { api } from './api';
import { useAuthStore } from '../stores/auth';

// BL-36 / KG-15: the API accepts an access token only in the Authorization header, so an <img> or
// a download link cannot point at a download route directly. These helpers fetch the file with
// the bearer header (through the 401-refresh interceptor) and hand the browser a blob URL.

function currentToken(): string {
  const token = useAuthStore().accessToken;
  if (!token) throw new Error('Your session has ended. Please sign in again.');
  return token;
}

/**
 * Saves the file at `path` (a download route) as `filename`. Always a download, never a new tab:
 * the blob is re-typed as application/octet-stream, so an uploaded attachment (a parent's
 * complaint file, say) can never render as a page on the console's own origin.
 */
export async function downloadAuthedFile(path: string, filename: string): Promise<void> {
  const blob = await api.fetchFile(currentToken(), path);
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // The download has started from the blob; give slow browsers a moment before freeing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * A blob URL for the image at `path` (null while loading, on failure, or when `path` is null).
 * Follows `path` as it changes and frees the previous blob URL, and the last one on unmount.
 */
export function useAuthedImage(path: Ref<string | null>): Ref<string | null> {
  const url = ref<string | null>(null);
  let generation = 0;

  function release() {
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = null;
  }

  watch(
    path,
    async (next) => {
      const mine = ++generation;
      release();
      if (!next) return;
      try {
        const blob = await api.fetchFile(currentToken(), next);
        if (mine === generation) url.value = URL.createObjectURL(blob);
      } catch {
        // A missing or forbidden image just shows the placeholder, as a broken <img> did before.
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    generation++;
    release();
  });

  return url;
}
