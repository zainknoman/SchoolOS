// staff-console/src/views/MarksEntryView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import MarksEntryView from './MarksEntryView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

function makeRouter(initialPath = '/teacher/gradebook/entry') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/teacher/gradebook/entry', name: 'teacher-gradebook-entry', component: MarksEntryView }],
  });
  router.push(initialPath);
  return router;
}

async function mountWithRouter(initialPath?: string) {
  const router = makeRouter(initialPath);
  await router.isReady();
  const wrapper = mount(MarksEntryView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listClasses: vi.fn(),
    sectionStudents: vi.fn(),
    listTerms: vi.fn(),
    listAssessmentCategories: vi.fn(),
    listAssessments: vi.fn(),
    saveMarksBulk: vi.fn(),
  },
}));

describe('MarksEntryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Main' },
    ]);
    vi.mocked(api.listClasses).mockResolvedValue([
      { id: 'c1', name: 'Grade 3', campusId: 'camp-1', campusName: 'Main', academicSessionId: 'sess-1', academicSessionLabel: '2026-2027' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([{ id: 's1', name: 'Ali Khan', grNumber: 'GR-1001' }]);
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 't1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([
      { id: 'cat1', classId: 'c1', termId: 't1', name: 'Quizzes', weightPercent: 30 },
    ]);
    vi.mocked(api.listAssessments).mockResolvedValue([
      { id: 'a1', assessmentCategoryId: 'cat1', subjectId: 'sub-1', label: 'Quiz 1', maxMarks: 20 },
    ]);
  });

  it('cascades section -> term -> category -> assessment and saves marks', async () => {
    vi.mocked(api.saveMarksBulk).mockResolvedValue(undefined);

    const wrapper = await mountWithRouter();

    await wrapper.find('[data-testid="select-section"]').setValue('sec-1');
    await flushPromises();
    expect(wrapper.text()).toContain('Ali Khan');

    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();
    await wrapper.find('[data-testid="select-category"]').setValue('cat1');
    await flushPromises();
    await wrapper.find('[data-testid="select-assessment"]').setValue('a1');
    await flushPromises();

    await wrapper.find('[data-testid="marks-input-s1"]').setValue('18');
    await wrapper.find('[data-testid="save-marks"]').trigger('click');
    await flushPromises();

    expect(api.saveMarksBulk).toHaveBeenCalledWith('token-1', 'a1', {
      marks: [{ studentId: 's1', obtainedMarks: 18 }],
    });
  });

  it('surfaces a save error (e.g. obtained marks exceed maximum) via role="alert"', async () => {
    vi.mocked(api.saveMarksBulk).mockRejectedValue(
      new Error('Student s1: obtained marks (999) exceed the maximum (20) for this assessment'),
    );

    const wrapper = await mountWithRouter();
    await wrapper.find('[data-testid="select-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();
    await wrapper.find('[data-testid="select-category"]').setValue('cat1');
    await flushPromises();
    await wrapper.find('[data-testid="select-assessment"]').setValue('a1');
    await flushPromises();

    await wrapper.find('[data-testid="marks-input-s1"]').setValue('999');
    await wrapper.find('[data-testid="save-marks"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('exceed the maximum');
  });

  describe('?sectionId= preselection (from the Gradebook overview\'s "Enter marks" link)', () => {
    it('preselects the section and loads its students/terms when the query param matches a real section', async () => {
      const wrapper = await mountWithRouter('/teacher/gradebook/entry?sectionId=sec-1');

      expect((wrapper.find('[data-testid="select-section"]').element as HTMLSelectElement).value).toBe('sec-1');
      expect(wrapper.text()).toContain('Ali Khan');
      expect(wrapper.find('[data-testid="select-term"]').exists()).toBe(true);
    });

    it('leaves the section unselected when the query param does not match any real section', async () => {
      const wrapper = await mountWithRouter('/teacher/gradebook/entry?sectionId=does-not-exist');

      expect((wrapper.find('[data-testid="select-section"]').element as HTMLSelectElement).value).toBe('');
      expect(wrapper.text()).not.toContain('Ali Khan');
    });

    it('behaves exactly as before when no sectionId query param is present', async () => {
      const wrapper = await mountWithRouter('/teacher/gradebook/entry');

      expect((wrapper.find('[data-testid="select-section"]').element as HTMLSelectElement).value).toBe('');
    });
  });
});
