import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import TeacherGradebookOverviewView from './TeacherGradebookOverviewView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { teacherGradebookOverview: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/teacher/gradebook', name: 'teacher-gradebook', component: TeacherGradebookOverviewView },
      { path: '/teacher/gradebook/entry', name: 'teacher-gradebook-entry', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'TEACHER';
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/teacher/gradebook');
  await router.isReady();
  const wrapper = mount(TeacherGradebookOverviewView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('TeacherGradebookOverviewView', () => {
  beforeEach(() => {
    vi.mocked(api.teacherGradebookOverview).mockReset();
  });

  it('shows "Complete" when every student has a mark, "In progress" partway, "Not started" at zero', async () => {
    vi.mocked(api.teacherGradebookOverview).mockResolvedValue({
      classes: [
        { sectionId: 's1', subjectId: 'm', className: '6', sectionName: 'A', subjectName: 'Mathematics', termLabel: 'Mid-term', studentsCount: 34, marksEnteredCount: 34 },
        { sectionId: 's2', subjectId: 'm', className: '7', sectionName: 'B', subjectName: 'Mathematics', termLabel: 'Mid-term', studentsCount: 31, marksEnteredCount: 22 },
        { sectionId: 's3', subjectId: 'm', className: '10', sectionName: 'A', subjectName: 'Mathematics', termLabel: 'Mid-term', studentsCount: 27, marksEnteredCount: 0 },
      ],
      upcomingExams: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Complete');
    expect(wrapper.text()).toContain('In progress');
    expect(wrapper.text()).toContain('Not started');
    expect(wrapper.text()).toContain('34 of 34 entered');
    expect(wrapper.text()).toContain('22 of 31 entered');
  });

  it('links "Enter marks"/"Review" to the marks-entry route with the section preselected', async () => {
    vi.mocked(api.teacherGradebookOverview).mockResolvedValue({
      classes: [
        { sectionId: 'sec-9', subjectId: 'm', className: '9', sectionName: 'B', subjectName: 'Mathematics', termLabel: 'Mid-term', studentsCount: 29, marksEnteredCount: 0 },
      ],
      upcomingExams: [],
    });

    const wrapper = await mountView();

    const link = wrapper.find('a[href^="/teacher/gradebook/entry"]');
    expect(link.attributes('href')).toBe('/teacher/gradebook/entry?sectionId=sec-9');
    expect(link.text()).toBe('Enter marks');
  });

  it('renders upcoming exams with a days-until countdown', async () => {
    vi.mocked(api.teacherGradebookOverview).mockResolvedValue({
      classes: [],
      upcomingExams: [{ termId: 't1', label: 'Mid-term — Grade 9', startDate: '2026-09-28T00:00:00.000Z', daysUntil: 10 }],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Mid-term — Grade 9');
    expect(wrapper.text()).toContain('10 days');
  });

  it('shows an error message when the overview fails to load', async () => {
    vi.mocked(api.teacherGradebookOverview).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Network down');
  });
});
