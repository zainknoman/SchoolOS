import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/teacher', name: 'teacher-home', component: { template: '<div>teacher</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' } },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
      { path: '/admin/leave', name: 'admin-leave', component: { template: '<div>leave</div>' } },
      { path: '/teacher/messages', name: 'teacher-messages', component: { template: '<div>messages</div>' } },
      { path: '/admin/messages', name: 'admin-messages', component: { template: '<div>messages</div>' } },
      { path: '/teacher/diary', name: 'teacher-diary', component: { template: '<div>diary</div>' } },
      { path: '/admin/circulars', name: 'admin-circulars', component: { template: '<div>circulars</div>' } },
      { path: '/admin/timetable', name: 'admin-timetable', component: { template: '<div>timetable</div>' } },
    ],
  });
}

async function mountAsRole(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  const wrapper = mount(AppShell, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
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
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
  });

  it('shows Admin/Accounts nav items for a SCHOOL_ADMIN role, with no teacher-only items', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Students');
    expect(wrapper.text()).toContain('Parents');
    expect(wrapper.text()).toContain('Teachers');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Circulars');
    expect(wrapper.text()).toContain('Fees');
    expect(wrapper.text()).toContain('Leave');
    expect(wrapper.text()).toContain('Messages');

    expect(wrapper.find('[data-testid="nav-attendance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-diary"]').exists()).toBe(false);

    expect(wrapper.find('[data-testid="nav-dashboard"]').attributes('href')).toBe('/admin');
    expect(wrapper.find('[data-testid="nav-fees"]').attributes('href')).toBe('/admin/fees');
    expect(wrapper.find('[data-testid="nav-timetable"]').attributes('href')).toBe('/admin/timetable');
    expect(wrapper.find('[data-testid="nav-leave"]').attributes('href')).toBe('/admin/leave');
  });

  it('shows nav-leave for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-leave"]').attributes('href')).toBe('/admin/leave');
  });

  it('hides nav-leave for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
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
    auth.accessToken = 'token-1';
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

  it('opens a dropdown of notifications, marks one read, and navigates on click', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.find('[data-testid="notif-badge"]').text()).toBe('1');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').text()).toContain('New message');

    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(api.markNotificationRead).toHaveBeenCalledWith(expect.any(String), 'n1');
  });

  it('"mark all read" clears every unread notification', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-mark-all-read"]').trigger('click');
    await flushPromises();

    expect(api.markAllNotificationsRead).toHaveBeenCalledWith('token-1');
  });

  it('still navigates when marking a notification read fails', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.markNotificationRead).mockRejectedValueOnce(new Error('expired token'));
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/teacher/messages');
  });

  it('surfaces an error but does not throw when "mark all read" fails', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.markAllNotificationsRead).mockRejectedValueOnce(new Error('network error'));
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-mark-all-read"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-error"]').exists()).toBe(true);
  });

  it("carries the notification's conversation id through as a query param, for the Messages view to open it directly", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/teacher/messages');
    expect(wrapper.vm.$router.currentRoute.value.query.conversationId).toBe('conv-1');
  });

  it('falls back to the home route when a notification type does not match the caller role', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'circular',
        title: 'New circular',
        body: 'Read this',
        entityRef: 'circ-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('ACCOUNTS');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin');
  });
});
