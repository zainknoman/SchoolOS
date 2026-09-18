import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LoginView from './LoginView.vue';
import { useAuthStore } from '../stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/teacher', name: 'teacher-home', component: { template: '<div>teacher</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' } },
      { path: '/forgot-password', name: 'forgot-password', component: { template: '<div>forgot</div>' } },
    ],
  });
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the school-branded login form with identifier, password, and a submit control', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();
    const wrapper = mount(LoginView, { global: { plugins: [router] } });

    expect(wrapper.find('input[name="identifier"]').exists()).toBe(true);
    expect(wrapper.find('input[name="password"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('SchoolOS');
  });

  it('redirects a TEACHER to /teacher after a successful login', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();
    const wrapper = mount(LoginView, { global: { plugins: [router] } });

    const auth = useAuthStore();
    vi.spyOn(auth, 'login').mockResolvedValue(undefined);
    auth.role = 'TEACHER';

    await wrapper.find('input[name="identifier"]').setValue('teacher@schoolos.edu.pk');
    await wrapper.find('input[name="password"]').setValue('ChangeMe123!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(auth.login).toHaveBeenCalledWith('teacher@schoolos.edu.pk', 'ChangeMe123!');
    expect(router.currentRoute.value.name).toBe('teacher-home');
  });

  it('redirects a SCHOOL_ADMIN to /admin after a successful login', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();
    const wrapper = mount(LoginView, { global: { plugins: [router] } });

    const auth = useAuthStore();
    vi.spyOn(auth, 'login').mockResolvedValue(undefined);
    auth.role = 'SCHOOL_ADMIN';

    await wrapper.find('input[name="identifier"]').setValue('admin@schoolos.edu.pk');
    await wrapper.find('input[name="password"]').setValue('ChangeMe123!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('admin-home');
  });

  it('shows the generic error message on failed login without redirecting', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();
    const wrapper = mount(LoginView, { global: { plugins: [router] } });

    const auth = useAuthStore();
    vi.spyOn(auth, 'login').mockRejectedValue(new Error('Invalid credentials'));

    await wrapper.find('input[name="identifier"]').setValue('teacher@schoolos.edu.pk');
    await wrapper.find('input[name="password"]').setValue('wrong');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('Invalid credentials');
    expect(router.currentRoute.value.name).toBe('login');
  });
});
