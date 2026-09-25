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

describe('router org-structure access', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    await router.push('/login');
  });

  function signInAs(role: string, campusId: string | null = null) {
    const auth = useAuthStore();
    auth.accessToken = 't';
    auth.role = role;
    auth.isPrincipal = role === 'SCHOOL_ADMIN';
    auth.campusId = campusId;
  }

  it.each(['/admin/campuses', '/admin/campuses/c1', '/admin/classes', '/admin/sections'])(
    'lets a SCHOOL_ADMIN open %s',
    async (path) => {
      signInAs('SCHOOL_ADMIN');
      await router.push(path);
      expect(router.currentRoute.value.path).toBe(path);
    },
  );

  // BL-33 (KI-18): /admin/academic-sessions is open to SCHOOL_ADMIN (view + copy structure).
  it('lets a SCHOOL_ADMIN open /admin/academic-sessions', async () => {
    signInAs('SCHOOL_ADMIN');
    await router.push('/admin/academic-sessions');
    expect(router.currentRoute.value.path).toBe('/admin/academic-sessions');
  });

  it.each(['/admin/schools', '/admin/schools/new', '/admin/schools/s1'])(
    'keeps %s SUPER_ADMIN-only',
    async (path) => {
      signInAs('SCHOOL_ADMIN');
      await router.push(path);
      expect(router.currentRoute.value.path).toBe('/principal');
    },
  );

  it.each(['/admin/campuses', '/admin/classes', '/admin/sections'])('keeps %s away from ACCOUNTS', async (path) => {
    signInAs('ACCOUNTS');
    await router.push(path);
    expect(router.currentRoute.value.path).toBe('/admin');
  });

  it('lets a school-wide SCHOOL_ADMIN and a SUPER_ADMIN open /admin/campuses/new', async () => {
    signInAs('SCHOOL_ADMIN', null);
    await router.push('/admin/campuses/new');
    expect(router.currentRoute.value.path).toBe('/admin/campuses/new');
    await router.push('/login');
    signInAs('SUPER_ADMIN');
    await router.push('/admin/campuses/new');
    expect(router.currentRoute.value.path).toBe('/admin/campuses/new');
  });

  it('redirects a campus principal away from /admin/campuses/new', async () => {
    signInAs('SCHOOL_ADMIN', 'campus-1');
    await router.push('/admin/campuses/new');
    expect(router.currentRoute.value.path).toBe('/principal');
  });
});
