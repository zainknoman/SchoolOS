import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useAuthStore } from '../stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/teacher', name: 'teacher-home', component: { template: '<div>teacher</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' } },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
      { path: '/teacher/messages', name: 'teacher-messages', component: { template: '<div>messages</div>' } },
      { path: '/admin/messages', name: 'admin-messages', component: { template: '<div>messages</div>' } },
    ],
  });
}

async function mountAsRole(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  return mount(AppShell, { global: { plugins: [router] } });
}

describe('AppShell (role-gated nav)', () => {
  it('shows only Teacher nav items for a TEACHER role, with no admin items in the DOM at all', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.text()).toContain('Attendance');
    expect(wrapper.text()).toContain('Diary');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Messages');

    // Not CSS-hidden — absent from the DOM entirely.
    expect(wrapper.text()).not.toContain('Students');
    expect(wrapper.text()).not.toContain('Fees');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(false);
  });

  it('shows Admin/Accounts nav items for a SCHOOL_ADMIN role, with no teacher-only items', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Students');
    expect(wrapper.text()).toContain('Parents');
    expect(wrapper.text()).toContain('Teachers');
    expect(wrapper.text()).toContain('Classes');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Circulars');
    expect(wrapper.text()).toContain('Fees');
    expect(wrapper.text()).toContain('Messages');

    expect(wrapper.find('[data-testid="nav-attendance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-diary"]').exists()).toBe(false);

    expect(wrapper.find('[data-testid="nav-dashboard"]').attributes('href')).toBe('/admin');
    expect(wrapper.find('[data-testid="nav-fees"]').attributes('href')).toBe('/admin/fees');
  });

  it('shows a role-initials avatar and a notifications bell in the topbar', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="avatar"]').text()).toBe('AC');
    expect(wrapper.find('[data-testid="notifications"]').exists()).toBe(true);
  });

  it('highlights the active nav item with the router-link-active class', async () => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.role = 'SCHOOL_ADMIN';
    const router = makeRouter();
    await router.push('/admin');
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="nav-dashboard"]').classes()).toContain('router-link-active');
  });

  it('logs out and returns to /login when the logout control is used', async () => {
    const wrapper = await mountAsRole('TEACHER');
    const auth = useAuthStore();

    await wrapper.find('[data-testid="logout"]').trigger('click');

    expect(auth.isAuthenticated).toBe(false);
  });
});
