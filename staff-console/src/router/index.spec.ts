import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import router from './index';
import { useAuthStore } from '../stores/auth';

describe('router forced password change', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    await router.push('/login');
  });

  function signIn(mustChangePassword: boolean) {
    const auth = useAuthStore();
    auth.accessToken = 't';
    auth.role = 'SCHOOL_ADMIN';
    auth.isPrincipal = true;
    auth.mustChangePassword = mustChangePassword;
  }

  it('redirects a user who must change password from /admin to /change-password', async () => {
    signIn(true);
    await router.push('/admin');
    expect(router.currentRoute.value.name).toBe('change-password');
  });

  it('lets a user who must change password stay on /change-password', async () => {
    signIn(true);
    await router.push('/change-password');
    expect(router.currentRoute.value.name).toBe('change-password');
  });

  it('does not trap a user with no pending change', async () => {
    signIn(false);
    await router.push('/admin');
    expect(router.currentRoute.value.name).toBe('admin-home');
    await router.push('/change-password');
    expect(router.currentRoute.value.name).toBe('change-password');
  });

  it('sends unauthenticated users to login, not change-password', async () => {
    await router.push('/change-password');
    expect(router.currentRoute.value.name).toBe('login');
  });
});
