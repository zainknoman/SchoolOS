import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { installFetchInterceptor } from './fetchInterceptor';
import { useAuthStore } from '../stores/auth';

describe('installFetchInterceptor', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('passes through a successful authenticated request unchanged', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer old-token' },
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not intercept a request with no Authorization header (e.g. login itself)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/auth/login', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('on a 401, refreshes once and retries with the new token', async () => {
    const authStore = useAuthStore();
    authStore.refreshToken = 'refresh-1';
    vi.spyOn(authStore, 'refreshSession').mockResolvedValue('new-access-token');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(mockFetch.mock.calls[1]![1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access-token');
  });

  it('does not retry when refresh fails, and the original 401 is returned', async () => {
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'refreshSession').mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not intercept requests to a different origin', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('https://example.com/some-other-api', {
      headers: { Authorization: 'Bearer token' },
    });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
