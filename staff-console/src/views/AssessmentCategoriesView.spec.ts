// staff-console/src/views/AssessmentCategoriesView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AssessmentCategoriesView from './AssessmentCategoriesView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type ResultPublicationStatus } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listTerms: vi.fn(),
    listAssessmentCategories: vi.fn(),
    createAssessmentCategory: vi.fn(),
    updateAssessmentCategory: vi.fn(),
    deleteAssessmentCategory: vi.fn(),
    getResultPublication: vi.fn(),
    publishResults: vi.fn(),
    unpublishResults: vi.fn(),
    generateReportCards: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

const status = (over: Partial<ResultPublicationStatus> = {}): ResultPublicationStatus => ({
  classId: 'c1',
  termId: 't1',
  published: false,
  publishedAt: null,
  scaleName: 'Standard',
  categoryCount: 1,
  weightTotal: 100,
  blockers: [],
  ...over,
});

async function pickClassAndTerm(wrapper: ReturnType<typeof mount>) {
  await flushPromises();
  await wrapper.find('[data-testid="select-class"]').setValue('c1');
  await flushPromises();
  await wrapper.find('[data-testid="select-term"]').setValue('t1');
  await flushPromises();
}

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
    vi.mocked(api.getResultPublication).mockResolvedValue(status());
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

  it('generates report cards once results are published (BL-06)', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
    vi.mocked(api.getResultPublication).mockResolvedValue(status({ published: true }));
    vi.mocked(api.generateReportCards).mockResolvedValue({ generated: 12, unchanged: 3, skipped: [] });
    const wrapper = mount(AssessmentCategoriesView);
    await pickClassAndTerm(wrapper);
    await wrapper.find('[data-testid="generate-report-cards"]').trigger('click');
    await flushPromises();
    expect(api.generateReportCards).toHaveBeenCalledWith('token-1', 'c1', 't1');
  });

  it('offers no report-card generation before publication', async () => {
    vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
    const wrapper = mount(AssessmentCategoriesView);
    await pickClassAndTerm(wrapper);
    expect(wrapper.find('[data-testid="generate-report-cards"]').exists()).toBe(false);
  });

  describe('result publication (BL-27)', () => {
    it('shows why results cannot be published and disables the button', async () => {
      vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
      vi.mocked(api.getResultPublication).mockResolvedValue(
        status({ weightTotal: 90, blockers: ['Category weights total 90%, not 100%; correct them before publishing.'] }),
      );
      const wrapper = mount(AssessmentCategoriesView);
      await pickClassAndTerm(wrapper);
      expect(wrapper.find('[data-testid="publication-state"]').text()).toBe('Not published');
      expect(wrapper.find('[data-testid="publication-blockers"]').text()).toContain('total 90%');
      expect((wrapper.find('[data-testid="publication-toggle"]').element as HTMLButtonElement).disabled).toBe(true);
    });

    it('publishes when nothing blocks it, then offers to unpublish', async () => {
      vi.mocked(api.listAssessmentCategories).mockResolvedValue([]);
      vi.mocked(api.publishResults).mockResolvedValue(status({ published: true, publishedAt: '2026-09-26' }));
      vi.mocked(api.unpublishResults).mockResolvedValue(status());
      const wrapper = mount(AssessmentCategoriesView);
      await pickClassAndTerm(wrapper);
      await wrapper.find('[data-testid="publication-toggle"]').trigger('click');
      await flushPromises();
      expect(api.publishResults).toHaveBeenCalledWith('token-1', 'c1', 't1');
      expect(wrapper.find('[data-testid="publication-state"]').text()).toContain('Published');
      expect(wrapper.find('[data-testid="publication-toggle"]').text()).toBe('Unpublish results');

      await wrapper.find('[data-testid="publication-toggle"]').trigger('click');
      await flushPromises();
      expect(api.unpublishResults).toHaveBeenCalledWith('token-1', 'c1', 't1');
      expect(wrapper.find('[data-testid="publication-state"]').text()).toBe('Not published');
    });
  });
});
