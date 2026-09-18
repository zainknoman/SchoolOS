import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import TeacherMyDayView from './TeacherMyDayView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { teacherMyDay: vi.fn(), listConversations: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/teacher', name: 'teacher-home', component: TeacherMyDayView },
      { path: '/teacher/attendance', name: 'teacher-attendance', component: { template: '<div />' } },
      { path: '/teacher/diary', name: 'teacher-diary', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'TEACHER';
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/teacher');
  await router.isReady();
  const wrapper = mount(TeacherMyDayView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

const myDayFixture = {
  classesToday: [
    {
      timetableId: 'tt-1',
      sectionId: 'sec-1',
      className: '6',
      sectionName: 'A',
      subjectName: 'Mathematics',
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
      room: '14',
      attendanceMarked: true,
    },
    {
      timetableId: 'tt-2',
      sectionId: 'sec-2',
      className: '9',
      sectionName: 'B',
      subjectName: 'Mathematics',
      period: 3,
      startTime: '10:15',
      endTime: '10:55',
      room: '21',
      attendanceMarked: false,
    },
  ],
  diaryDueToday: [{ id: 'd1', className: '6', sectionName: 'A', subjectName: 'Mathematics', text: 'Ch. 4 exercises' }],
};

describe('TeacherMyDayView', () => {
  beforeEach(() => {
    vi.mocked(api.teacherMyDay).mockReset();
    vi.mocked(api.listConversations).mockReset();
  });

  it('renders the stat row: classes today, attendance-marked count, unread messages', async () => {
    vi.mocked(api.teacherMyDay).mockResolvedValue(myDayFixture);
    vi.mocked(api.listConversations).mockResolvedValue([
      { id: 'c1', recipientType: 'CLASS_TEACHER', studentId: null, otherPartyName: 'Parent A', lastMessageAt: '', unread: true },
      { id: 'c2', recipientType: 'CLASS_TEACHER', studentId: null, otherPartyName: 'Parent B', lastMessageAt: '', unread: false },
    ]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('2'); // classes today
    expect(wrapper.text()).toContain('1 of 2'); // attendance marked
  });

  it('shows "Mark attendance" only for a class not yet marked, navigating to /teacher/attendance', async () => {
    vi.mocked(api.teacherMyDay).mockResolvedValue(myDayFixture);
    vi.mocked(api.listConversations).mockResolvedValue([]);

    const { wrapper, router } = await mountView();

    expect(wrapper.find('[data-testid="mark-attendance-tt-1"]').exists()).toBe(false);
    const button = wrapper.find('[data-testid="mark-attendance-tt-2"]');
    expect(button.exists()).toBe(true);

    await button.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/teacher/attendance');
  });

  it("renders diary entries due today", async () => {
    vi.mocked(api.teacherMyDay).mockResolvedValue(myDayFixture);
    vi.mocked(api.listConversations).mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Ch. 4 exercises');
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(api.teacherMyDay).mockRejectedValue(new Error('Network down'));
    vi.mocked(api.listConversations).mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Network down');
  });
});
