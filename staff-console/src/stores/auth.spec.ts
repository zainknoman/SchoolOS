import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';
import { api, ApiError, type LoginResponse } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

// BL-36 option B: the refresh token is an HttpOnly cookie the console never sees; the access
// token lives only in memory. Nothing secret is written to localStorage.
function session(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    accessToken: 'token-abc',
    role: 'TEACHER',
    isPrincipal: false,
    mustChangePassword: false,
    campusId: null,
    schoolId: null,
    ...overrides,
  };
}

function storedText(): string {
  let all = '';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    all += `${key}=${localStorage.getItem(key)};`;
  }
  return all;
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(api.login).mockReset();
    vi.mocked(api.refresh).mockReset();
    vi.mocked(api.logout).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts logged out with no token', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
  });

  it('logs in and keeps the access token in memory only — no token in localStorage', async () => {
    vi.mocked(api.login).mockResolvedValue(session({ accessToken: 'token-secret-1' }));

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe('TEACHER');
    expect(store.accessToken).toBe('token-secret-1');
    expect(storedText()).not.toContain('token-secret-1');
    expect(localStorage.getItem('schoolos.auth')).toBeNull();
  });

  it('restores the session after a page reload from the cookie (refresh), not from storage', async () => {
    vi.mocked(api.login).mockResolvedValue(session({ role: 'SCHOOL_ADMIN' }));
    await useAuthStore().login('admin@schoolos.edu.pk', 'ChangeMe123!');

    // A fresh page load: new Pinia, nothing in memory.
    setActivePinia(createPinia());
    const reloaded = useAuthStore();
    expect(reloaded.isAuthenticated).toBe(false);

    vi.mocked(api.refresh).mockResolvedValue(session({ accessToken: 'token-2', role: 'SCHOOL_ADMIN' }));
    await reloaded.restoreSession();

    expect(api.refresh).toHaveBeenCalledWith(undefined);
    expect(reloaded.isAuthenticated).toBe(true);
    expect(reloaded.role).toBe('SCHOOL_ADMIN');
    expect(reloaded.accessToken).toBe('token-2');
  });

  it('restoreSession does not call the API when this browser never signed in', async () => {
    await useAuthStore().restoreSession();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(useAuthStore().isAuthenticated).toBe(false);
  });

  it('restoreSession stays logged out when the cookie session has ended', async () => {
    vi.mocked(api.login).mockResolvedValue(session());
    await useAuthStore().login('t@schoolos.edu.pk', 'x');
    setActivePinia(createPinia());
    vi.mocked(api.refresh).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await store.restoreSession();

    expect(store.isAuthenticated).toBe(false);
    await store.restoreSession();
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('moves a pre-BL-36 localStorage session into the cookie and deletes the stored tokens', async () => {
    localStorage.setItem(
      'schoolos.auth',
      JSON.stringify({ accessToken: 'old-access', refreshToken: 'old-refresh', role: 'TEACHER' }),
    );
    vi.mocked(api.refresh).mockResolvedValue(session({ accessToken: 'token-new' }));

    const store = useAuthStore();
    await store.restoreSession();

    expect(api.refresh).toHaveBeenCalledWith('old-refresh');
    expect(localStorage.getItem('schoolos.auth')).toBeNull();
    expect(store.accessToken).toBe('token-new');
    expect(storedText()).not.toContain('old-refresh');
  });

  it('surfaces the generic auth error from the API without modification', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await expect(store.login('teacher@schoolos.edu.pk', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(store.isAuthenticated).toBe(false);
  });

  it('logout clears the session and revokes the cookie session on the server', async () => {
    vi.mocked(api.login).mockResolvedValue(session());
    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');
    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    await Promise.resolve();
    expect(api.logout).toHaveBeenCalledTimes(1);

    // The next page load does not try to restore it.
    setActivePinia(createPinia());
    await useAuthStore().restoreSession();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('logout still clears the local session when the server call fails', async () => {
    vi.mocked(api.logout).mockRejectedValue(new Error('offline'));
    const store = useAuthStore();
    store.applySession(session());
    expect(() => store.logout()).not.toThrow();
    expect(store.isAuthenticated).toBe(false);
  });

  it('markPasswordChangeRequired sets the flag', () => {
    const store = useAuthStore();
    store.applySession(session());
    store.markPasswordChangeRequired();
    expect(store.mustChangePassword).toBe(true);
  });

  it('refreshSession() gets a new access token from the cookie session', async () => {
    vi.mocked(api.login).mockResolvedValue(session({ accessToken: 'token-old' }));
    vi.mocked(api.refresh).mockResolvedValue(session({ accessToken: 'token-new' }));

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    expect(await store.refreshSession()).toBe('token-new');
    expect(store.accessToken).toBe('token-new');
    expect(api.refresh).toHaveBeenCalledWith();
  });

  it('refreshSession() logs out and returns null when the refresh call itself fails', async () => {
    vi.mocked(api.login).mockResolvedValue(session());
    vi.mocked(api.refresh).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    expect(await store.refreshSession()).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('refreshSession() returns null immediately when signed out', async () => {
    expect(await useAuthStore().refreshSession()).toBeNull();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('refreshSession() de-duplicates concurrent calls into a single API request', async () => {
    vi.mocked(api.login).mockResolvedValue(session());
    let resolveRefresh!: (value: LoginResponse) => void;
    vi.mocked(api.refresh).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    const call1 = store.refreshSession();
    const call2 = store.refreshSession();
    resolveRefresh(session({ accessToken: 'token-new' }));

    expect(await Promise.all([call1, call2])).toEqual(['token-new', 'token-new']);
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshSession() runs under a cross-tab lock, so two tabs never present the same rotated cookie', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<unknown>) => cb());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    vi.mocked(api.login).mockResolvedValue(session());
    vi.mocked(api.refresh).mockResolvedValue(session({ accessToken: 'token-new' }));

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');
    await store.refreshSession();

    expect(request).toHaveBeenCalledWith('schoolos.refresh', expect.any(Function));
  });

  it('keeps mustChangePassword and campusId from login in memory; applySession clears the flag', async () => {
    vi.mocked(api.login).mockResolvedValue(
      session({ role: 'SCHOOL_ADMIN', isPrincipal: true, mustChangePassword: true, campusId: 'campus-1' }),
    );
    const store = useAuthStore();
    await store.login('p@schoolos.edu.pk', 'Temp1234!x');
    expect(store.mustChangePassword).toBe(true);
    expect(store.campusId).toBe('campus-1');

    store.applySession(session({ accessToken: 'a2', role: 'SCHOOL_ADMIN', campusId: 'campus-1' }));
    expect(store.mustChangePassword).toBe(false);
    expect(store.accessToken).toBe('a2');

    store.logout();
    expect(store.mustChangePassword).toBe(false);
    expect(store.campusId).toBeNull();
  });
});
