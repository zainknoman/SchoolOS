import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';
import { api, ApiError } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { login: vi.fn(), refresh: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(api.login).mockReset();
    vi.mocked(api.refresh).mockReset();
  });

  it('starts logged out with no token', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
  });

  it('logs in, stores the token + role, and marks the session authenticated', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      role: 'TEACHER',
    });

    const store = useAuthStore();
    await store.login('teacher@seeds.edu.pk', 'ChangeMe123!');

    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe('TEACHER');
    expect(store.accessToken).toBe('token-abc');
  });

  it('persists the session across a page reload (new store instance) via localStorage', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      role: 'SCHOOL_ADMIN',
    });

    const store = useAuthStore();
    await store.login('admin@seeds.edu.pk', 'ChangeMe123!');

    // Simulate a fresh page load: new Pinia instance, store re-reads from localStorage.
    setActivePinia(createPinia());
    const reloadedStore = useAuthStore();

    expect(reloadedStore.isAuthenticated).toBe(true);
    expect(reloadedStore.role).toBe('SCHOOL_ADMIN');
  });

  it('surfaces the generic auth error from the API without modification', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await expect(store.login('teacher@seeds.edu.pk', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(store.isAuthenticated).toBe(false);
  });

  it('clears the stored session on logout', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      role: 'TEACHER',
    });

    const store = useAuthStore();
    await store.login('teacher@seeds.edu.pk', 'ChangeMe123!');
    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(localStorage.getItem('seeds.auth')).toBeNull();
  });

  it('refreshSession() exchanges the stored refresh token for a new session and persists it', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    vi.mocked(api.refresh).mockResolvedValue({
      accessToken: 'token-new',
      refreshToken: 'refresh-new',
      role: 'TEACHER',
    });

    const store = useAuthStore();
    await store.login('teacher@seeds.edu.pk', 'ChangeMe123!');

    const newAccessToken = await store.refreshSession();

    expect(newAccessToken).toBe('token-new');
    expect(store.accessToken).toBe('token-new');
    expect(store.refreshToken).toBe('refresh-new');
    expect(JSON.parse(localStorage.getItem('seeds.auth')!).accessToken).toBe('token-new');
  });

  it('refreshSession() logs out and returns null when the refresh call itself fails', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    vi.mocked(api.refresh).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await store.login('teacher@seeds.edu.pk', 'ChangeMe123!');

    const result = await store.refreshSession();

    expect(result).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem('seeds.auth')).toBeNull();
  });

  it('refreshSession() returns null immediately when there is no refresh token to use', async () => {
    const store = useAuthStore();
    const result = await store.refreshSession();
    expect(result).toBeNull();
    expect(vi.mocked(api.refresh)).not.toHaveBeenCalled();
  });

  it('refreshSession() de-duplicates concurrent calls into a single API request', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    let resolveRefresh!: (value: { accessToken: string; refreshToken: string; role: string }) => void;
    vi.mocked(api.refresh).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const store = useAuthStore();
    await store.login('teacher@seeds.edu.pk', 'ChangeMe123!');

    const call1 = store.refreshSession();
    const call2 = store.refreshSession();
    resolveRefresh({ accessToken: 'token-new', refreshToken: 'refresh-new', role: 'TEACHER' });

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe('token-new');
    expect(result2).toBe('token-new');
    expect(vi.mocked(api.refresh)).toHaveBeenCalledTimes(1);
  });
});
