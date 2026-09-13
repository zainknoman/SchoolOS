// staff-console/src/views/AssessmentCategoriesView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AssessmentCategoriesView from './AssessmentCategoriesView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listTerms: vi.fn(),
    listAssessmentCategories: vi.fn(),
    createAssessmentCategory: vi.fn(),
    updateAssessmentCategory: vi.fn(),
    deleteAssessmentCategory: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('AssessmentCategoriesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listClasses).mockResolvedValue([
      { id: 'c1', name: 'Grade 3', campusId: 'camp-1', campusName: 'Main', academicSessionId: 'sess-1', academicSessionLabel: '2026-2027' },
    ]);
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 't1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('loads categories once both class and term are picked', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([
      { id: 'cat1', classId: 'c1', termId: 't1', name: 'Quizzes', weightPercent: 30 },
    ]);

    const wrapper = mount(AssessmentCategoriesView);
    await flushPromises();

    await wrapper.find('[data-testid="select-class"]').setValue('c1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();

    expect(api.listAssessmentCategories).toHaveBeenCalledWith('token-1', 'c1', 't1');
    expect(wrapper.text()).toContain('Quizzes');
  });

  it('creates a category and shows the warning banner when weightTotalWarning is non-null', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
    vi.mocked(api.createAssessmentCategory).mockResolvedValue({
      id: 'cat1',
      classId: 'c1',
      termId: 't1',
      name: 'Quizzes',
      weightPercent: 30,
      weightTotalWarning: 'Category weights for this class/term total 30%, not 100%',
    });

    const wrapper = mount(AssessmentCategoriesView);
    await flushPromises();
    await wrapper.find('[data-testid="select-class"]').setValue('c1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-name"]').setValue('Quizzes');
    await wrapper.find('[data-testid="add-weightPercent"]').setValue('30');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('30%');
  });

  it('does not show a warning banner when weightTotalWarning is null', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
    vi.mocked(api.createAssessmentCategory).mockResolvedValue({
      id: 'cat1',
      classId: 'c1',
      termId: 't1',
      name: 'Final Exam',
      weightPercent: 100,
      weightTotalWarning: null,
    });

    const wrapper = mount(AssessmentCategoriesView);
    await flushPromises();
    await wrapper.find('[data-testid="select-class"]').setValue('c1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-name"]').setValue('Final Exam');
    await wrapper.find('[data-testid="add-weightPercent"]').setValue('100');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('edits and deletes a category', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([
      { id: 'cat1', classId: 'c1', termId: 't1', name: 'Quizzes', weightPercent: 30 },
    ]);
    vi.mocked(api.updateAssessmentCategory).mockResolvedValue({
      id: 'cat1',
      classId: 'c1',
      termId: 't1',
      name: 'Quizzes Renamed',
      weightPercent: 40,
      weightTotalWarning: null,
    });
    vi.mocked(api.deleteAssessmentCategory).mockResolvedValue(undefined);

    const wrapper = mount(AssessmentCategoriesView);
    await flushPromises();
    await wrapper.find('[data-testid="select-class"]').setValue('c1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('t1');
    await flushPromises();

    await wrapper.find('[data-testid="edit-cat1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-cat1"]').setValue('Quizzes Renamed');
    await wrapper.find('[data-testid="edit-weightPercent-cat1"]').setValue('40');
    await wrapper.find('[data-testid="save-cat1"]').trigger('click');
    await flushPromises();
    expect(api.updateAssessmentCategory).toHaveBeenCalledWith('token-1', 'cat1', {
      name: 'Quizzes Renamed',
      weightPercent: 40,
    });

    await wrapper.find('[data-testid="delete-cat1"]').trigger('click');
    await flushPromises();
    expect(api.deleteAssessmentCategory).toHaveBeenCalledWith('token-1', 'cat1');
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(api.listClasses).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(AssessmentCategoriesView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
