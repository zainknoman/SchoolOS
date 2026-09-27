import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

const body = { accessToken: 'a', role: 'TEACHER', isPrincipal: false, mustChangePassword: false, campusId: null, schoolId: null };

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callInit(fetchMock: ReturnType<typeof stubFetch>, n = 0): RequestInit {
  return fetchMock.mock.calls[n]![1] as RequestInit;
}

// BL-36 option B: every call that creates, renews or ends the session runs in cookie mode.
describe('cookie-session auth calls', () => {
  it.each([
    ['login', () => api.login('u', 'p'), '/api/v1/auth/login'],
    ['refresh', () => api.refresh(), '/api/v1/auth/refresh'],
    ['logout', () => api.logout(), '/api/v1/auth/logout'],
    ['change-password', () => api.changePassword('t', { currentPassword: 'a', newPassword: 'b' }), '/api/v1/auth/change-password'],
  ])('%s sends X-SchoolOS-Session and includes credentials', async (_name, call, path) => {
    const fetchMock = stubFetch();
    await call();
    expect(String(fetchMock.mock.calls[0]![0])).toContain(path);
    const init = callInit(fetchMock);
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('X-SchoolOS-Session')).toBe('cookie');
  });

  it('refresh sends no token, except once for a pre-BL-36 session', async () => {
    const fetchMock = stubFetch();
    await api.refresh();
    await api.refresh('legacy-token');
    expect(JSON.parse(callInit(fetchMock, 0).body as string)).toEqual({});
    expect(JSON.parse(callInit(fetchMock, 1).body as string)).toEqual({ refreshToken: 'legacy-token' });
  });
});
