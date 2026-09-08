import { API_BASE_URL } from './api';
import { useAuthStore } from '../stores/auth';

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// Wraps the global fetch so any 401 from OUR API triggers one silent refresh-and-retry before the
// caller ever sees it — installed once at app bootstrap (main.ts), so none of api.ts's ~60 call
// sites need to change. Only intercepts requests to our own API that already carried a bearer
// token — a 401 from /auth/login or /auth/refresh itself means the credentials/refresh-token
// really are bad, not that the access token expired, and must not retry.
export function installFetchInterceptor(nativeFetch: typeof fetch = window.fetch): void {
  window.fetch = async (input, init) => {
    const url = resolveUrl(input);
    const isOwnApi = url.startsWith(API_BASE_URL);
    const headers = new Headers(init?.headers);
    const hadAuthHeader = headers.has('Authorization');

    const response = await nativeFetch(input, init);

    if (!isOwnApi || !hadAuthHeader || response.status !== 401) {
      return response;
    }

    const authStore = useAuthStore();
    const newAccessToken = await authStore.refreshSession();
    if (!newAccessToken) {
      // refreshSession() has already logged out — let the original 401 propagate so the router
      // guard redirects to /login.
      return response;
    }

    headers.set('Authorization', `Bearer ${newAccessToken}`);
    return nativeFetch(input, { ...init, headers });
  };
}
