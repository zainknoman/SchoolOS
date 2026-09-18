import { describe, it, expect, vi, afterEach } from 'vitest';
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
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' }, meta: { title: 'Dashboard' } },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
      { path: '/admin/leave', name: 'admin-leave', component: { template: '<div>leave</div>' } },
      { path: '/teacher/messages', name: 'teacher-messages', component: { template: '<div>messages</div>' } },
      { path: '/admin/messages', name: 'admin-messages', component: { template: '<div>messages</div>' } },
      { path: '/teacher/diary', name: 'teacher-diary', component: { template: '<div>diary</div>' } },
      { path: '/admin/circulars', name: 'admin-circulars', component: { template: '<div>circulars</div>' } },
      { path: '/admin/timetable', name: 'admin-timetable', component: { template: '<div>timetable</div>' } },
      { path: '/admin/schools', name: 'admin-schools', component: { template: '<div>schools</div>' } },
      { path: '/admin/campuses', name: 'admin-campuses', component: { template: '<div>campuses</div>' } },
      {
        path: '/admin/academic-sessions',
        name: 'admin-academic-sessions',
        component: { template: '<div>academic-sessions</div>' },
      },
      { path: '/admin/classes', name: 'admin-classes', component: { template: '<div>classes</div>' } },
      { path: '/admin/sections', name: 'admin-sections', component: { template: '<div>sections</div>' } },
      { path: '/admin/parents', name: 'admin-parents', component: { template: '<div>parents</div>' } },
      {
        path: '/admin/students',
        name: 'admin-students',
        component: { template: '<div>students</div>' },
        meta: { title: 'Students', group: 'People' },
      },
      { path: '/admin/hiring', name: 'admin-hiring', component: { template: '<div>hiring</div>' } },
      { path: '/admin/hiring/new', name: 'admin-hiring-new', component: { template: '<div>hiring-new</div>' } },
      { path: '/admin/staff', name: 'admin-staff', component: { template: '<div>staff</div>' } },
      { path: '/admin/admissions', name: 'admin-admissions', component: { template: '<div>admissions</div>' } },
      {
        path: '/admin/admissions/new',
        name: 'admin-admissions-new',
        component: { template: '<div>admissions-new</div>' },
      },
      { path: '/admin/bulk-import', name: 'admin-bulk-import', component: { template: '<div>bulk-import</div>' } },
    ],
  });
}

async function mountAsRole(role: string, options: { attach?: boolean } = {}) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  const wrapper = mount(AppShell, {
    global: { plugins: [router] },
    ...(options.attach ? { attachTo: document.body } : {}),
  });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  // vi.mocked(...).mockResolvedValue(...) (used throughout this file, not mockResolvedValueOnce)
  // replaces the mock's default resolution for every subsequent test, not just the one that set
  // it — reset it here so each test starts from the same empty-inbox baseline unless it sets its
  // own notifications.
  vi.mocked(api.listNotifications).mockResolvedValue([]);
});

describe('AppShell (role-gated nav)', () => {
  it('shows only Teacher nav items for a TEACHER role, with no admin items in the DOM at all', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.text()).toContain('Attendance');
    expect(wrapper.text()).toContain('Diary');
    expect(wrapper.text()).toContain('Messages');
    // Sprint I re-added this link now that a real teacher-facing timetable view exists (it used
    // to point to href="#" with no route, and Sprint D removed it as dead).
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-timetable"]').attributes('href')).toBe('/teacher/timetable');
    // Teacher can raise complaints and upload report cards (backend already permits both), so both
    // need a nav entry, not just admin.
    expect(wrapper.find('[data-testid="nav-complaints"]').attributes('href')).toBe('/teacher/complaints');
    expect(wrapper.find('[data-testid="nav-report-cards"]').attributes('href')).toBe('/teacher/report-cards');

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
    expect(wrapper.text()).toContain('Staff');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Circulars');
    expect(wrapper.text()).toContain('Fees');
    expect(wrapper.text()).toContain('Leave');
    expect(wrapper.text()).toContain('Messages');

    expect(wrapper.find('[data-testid="nav-attendance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-diary"]').exists()).toBe(false);

    // Org Structure links (Schools/Campuses/Academic Sessions/Classes/Sections) are
    // SUPER_ADMIN-only — not visible to SCHOOL_ADMIN, even though it's otherwise a full admin role.
    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(false);

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

  it('shows the Org Structure nav links (Schools/Campuses/Academic Sessions/Classes/Sections) for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-schools"]').attributes('href')).toBe('/admin/schools');
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-campuses"]').attributes('href')).toBe('/admin/campuses');
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').attributes('href')).toBe(
      '/admin/academic-sessions',
    );
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-classes"]').attributes('href')).toBe('/admin/classes');
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-sections"]').attributes('href')).toBe('/admin/sections');
  });

  it('hides the Org Structure nav links for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(false);
  });

  it('shows the People CRUD nav links (Parents/Students) for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-parents"]').attributes('href')).toBe('/admin/parents');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-students"]').attributes('href')).toBe('/admin/students');
  });

  it('shows the People CRUD nav links (Parents/Students) for a SCHOOL_ADMIN role', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-parents"]').attributes('href')).toBe('/admin/parents');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-students"]').attributes('href')).toBe('/admin/students');
  });

  it('shows nav-staff for SCHOOL_ADMIN/SUPER_ADMIN and hides it for ACCOUNTS/TEACHER', async () => {
    let wrapper = await mountAsRole('SCHOOL_ADMIN');
    expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-staff"]').attributes('href')).toBe('/admin/staff');

    wrapper = await mountAsRole('SUPER_ADMIN');
    expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(true);

    wrapper = await mountAsRole('ACCOUNTS');
    expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(false);

    wrapper = await mountAsRole('TEACHER');
    expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(false);
  });

  it('shows nav-hiring for SCHOOL_ADMIN/SUPER_ADMIN and hides it for ACCOUNTS', async () => {
    let wrapper = await mountAsRole('SCHOOL_ADMIN');
    expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-hiring"]').attributes('href')).toBe('/admin/hiring');

    wrapper = await mountAsRole('SUPER_ADMIN');
    expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(true);

    wrapper = await mountAsRole('ACCOUNTS');
    expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(false);
  });

  it('hides the People CRUD nav links (Parents/Students) for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
  });

  it('hides the People CRUD nav links (Parents/Students) for a TEACHER role', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
  });

  it('hides nav-leave for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
  });

  it('hides nav-circulars and nav-timetable for an ACCOUNTS role (fixes the route/nav mismatch bug)', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-circulars"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(false);
    // Fees and Messages have no such restriction and should still show.
    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-messages"]').exists()).toBe(true);
  });

  it('shows nav-circulars and nav-timetable for a SCHOOL_ADMIN role', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="nav-circulars"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(true);
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

describe('AppShell (breadcrumb)', () => {
  it("renders the current route's meta.title alone when there's no meta.group, with a Breadcrumb aria-label", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');
    await wrapper.vm.$router.push('/admin');
    await flushPromises();

    expect(wrapper.find('[data-testid="breadcrumb"]').text()).toBe('Dashboard');
    expect(wrapper.find('[data-testid="breadcrumb-group"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="breadcrumb"]').attributes('aria-label')).toBe('Breadcrumb');
  });

  it('renders a real Group / Title trail when the route carries meta.group', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');
    await wrapper.vm.$router.push('/admin/students');
    await flushPromises();

    expect(wrapper.find('[data-testid="breadcrumb-group"]').text()).toBe('People');
    expect(wrapper.find('[data-testid="breadcrumb"]').text()).toBe('People/Students');
  });
});

describe('AppShell (two-tier notifications)', () => {
  it('shows a dot, not a number, when only non-message unread notifications exist', async () => {
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
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(true);
  });

  it('shows the numeric badge (not a dot) when at least one message is unread, even alongside ambient unread', async () => {
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
      {
        id: 'n2',
        type: 'message',
        title: 'New message',
        body: 'Hi',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(false);
  });

  it('shows neither badge nor dot when there is no unread notification', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(false);
  });

  it('closes the notifications dropdown on Escape, matching the command palette', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN', { attach: true });

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    expect(wrapper.find('[data-testid="notif-dropdown"]').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('closes the notifications dropdown on a click outside it', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN', { attach: true });

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    expect(wrapper.find('[data-testid="notif-dropdown"]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not close the notifications dropdown on a click inside it', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN', { attach: true });

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await wrapper.find('[data-testid="notif-dropdown"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

describe('AppShell (theme toggle)', () => {
  it('defaults to no explicit data-theme attribute (follows OS default)', async () => {
    await mountAsRole('SCHOOL_ADMIN');

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('sets data-theme="dark" and persists it on first click', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('schoolos.theme')).toBe('dark');
  });

  it('toggles back to light on a second click', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');
    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('schoolos.theme')).toBe('light');
  });

  it('reads a persisted preference back on mount', async () => {
    localStorage.setItem('schoolos.theme', 'dark');

    await mountAsRole('SCHOOL_ADMIN');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reflects the active theme via aria-pressed for assistive tech', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="theme-toggle"]').attributes('aria-pressed')).toBe('false');

    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');

    expect(wrapper.find('[data-testid="theme-toggle"]').attributes('aria-pressed')).toBe('true');
  });
});

describe('AppShell (command palette)', () => {
  it('opens the palette from the topbar trigger', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(true);
  });

  it('advertises the trigger as a dialog-opening disclosure via aria-haspopup/aria-expanded', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');
    const trigger = wrapper.find('[data-testid="cmdk-trigger"]');

    expect(trigger.attributes('aria-haspopup')).toBe('dialog');
    expect(trigger.attributes('aria-expanded')).toBe('false');

    await trigger.trigger('click');

    expect(wrapper.find('[data-testid="cmdk-trigger"]').attributes('aria-expanded')).toBe('true');
  });

  it('opens the palette on Ctrl+K and closes it on a second Ctrl+K', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);
  });

  it("only offers actions the current role can perform (e.g. no 'Add student' for ACCOUNTS)", async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="cmdk-action-add-student"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').exists()).toBe(true);
  });

  it("navigates to /admin/students with ?focus=gr-number for the 'Add student' action", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');
    await wrapper.find('[data-testid="cmdk-action-add-student"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin/students');
    expect(wrapper.vm.$router.currentRoute.value.query.focus).toBe('gr-number');
  });

  it('lists Admissions and Bulk Import as Go-to entries, and the newer-module actions', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="cmdk-admissions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-bulk-import"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-action-new-applicant"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-action-new-candidate"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-action-bulk-import"]').exists()).toBe(true);
  });

  it("navigates to /admin/hiring/new for the 'Add hiring candidate' action", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');
    await wrapper.find('[data-testid="cmdk-action-new-candidate"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin/hiring/new');
  });

  it("navigates to /admin/bulk-import with ?focus=entity for the 'Run a bulk import' action", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');
    await wrapper.find('[data-testid="cmdk-action-bulk-import"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin/bulk-import');
    expect(wrapper.vm.$router.currentRoute.value.query.focus).toBe('entity');
  });
});
