import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PromotionView from './PromotionView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import type {
  AcademicSessionSummary,
  ClassSummary,
  SectionSummary,
  PromotionPreviewRow,
} from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listSections: vi.fn(),
    listAcademicSessions: vi.fn(),
    previewPromotions: vi.fn(),
    executePromotions: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

// Active (source) academic session and the one non-active session available as a promotion target.
const activeSession: AcademicSessionSummary = {
  id: 'sess-active',
  label: '2025-2026',
  startDate: '2025-08-01',
  endDate: '2026-05-31',
  isActive: true,
};
const targetAcademicSession: AcademicSessionSummary = {
  id: 'sess-target',
  label: '2026-2027',
  startDate: '2026-08-01',
  endDate: '2027-05-31',
  isActive: false,
};

// Both classes share the same name+campus so SectionSummary (which carries no classId) matches
// both of them, exactly like PromotionView.vue's own sectionsForClass()/targetSectionOptions logic
// expects.
const sourceClass: ClassSummary = {
  id: 'class-source',
  name: 'Grade 5',
  campusId: 'campus-1',
  campusName: 'Main Campus',
  academicSessionId: 'sess-active',
  academicSessionLabel: '2025-2026',
};
const targetClass: ClassSummary = {
  id: 'class-target',
  name: 'Grade 5',
  campusId: 'campus-1',
  campusName: 'Main Campus',
  academicSessionId: 'sess-target',
  academicSessionLabel: '2026-2027',
};

const sourceSection: SectionSummary = {
  id: 'section-source',
  name: 'A',
  className: 'Grade 5',
  campusName: 'Main Campus',
  classTeacherId: null,
  classTeacherName: null,
};
const targetSection: SectionSummary = {
  id: 'section-target',
  name: 'B',
  className: 'Grade 5',
  campusName: 'Main Campus',
  classTeacherId: null,
  classTeacherName: null,
};

const previewRows: PromotionPreviewRow[] = [
  { studentId: 'student-1', name: 'Ali Khan', grNumber: 'GR-001', currentRollNumber: '12', suggestedDecision: 'PROMOTED' },
  { studentId: 'student-2', name: 'Sara Ahmed', grNumber: 'GR-002', currentRollNumber: null, suggestedDecision: 'PROMOTED' },
];

function mockReferenceData() {
  vi.mocked(api.listClasses).mockResolvedValueOnce([sourceClass, targetClass]);
  vi.mocked(api.listSections).mockResolvedValueOnce([sourceSection, targetSection]);
  vi.mocked(api.listAcademicSessions).mockResolvedValueOnce([activeSession, targetAcademicSession]);
}

// Picks the source class + section and clicks "Load students". Assumes mockReferenceData() and an
// api.previewPromotions mock have already been set up before mount().
async function loadStudents(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="select-source-class"]').setValue('class-source');
  await wrapper.find('[data-testid="select-source-section"]').setValue('section-source');
  await wrapper.find('[data-testid="load-students"]').trigger('click');
  await flushPromises();
}

// Picks the target academic session, then bulk-assigns the target section to every row that needs
// one (every row defaults to PROMOTED, which needsTargetSection()).
async function pickTargetSessionAndBulkAssign(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="select-target-session"]').setValue('sess-target');
  await wrapper.find('[data-testid="bulk-target-section"]').setValue('section-target');
  await wrapper.find('[data-testid="apply-bulk-target-section"]').trigger('click');
  await flushPromises();
}

describe('PromotionView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listClasses).mockReset();
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.listAcademicSessions).mockReset();
    vi.mocked(api.previewPromotions).mockReset();
    vi.mocked(api.executePromotions).mockReset();
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('loads students into the table after picking a source section', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);

    const wrapper = mount(PromotionView);
    await flushPromises();

    await loadStudents(wrapper);

    expect(api.previewPromotions).toHaveBeenCalledWith('token-1', 'section-source');
    expect(wrapper.text()).toContain('Ali Khan');
    expect(wrapper.text()).toContain('GR-001');
    expect(wrapper.text()).toContain('Sara Ahmed');
    expect(wrapper.text()).toContain('GR-002');
    // currentRollNumber is null for student-2 and rendered as an em dash by the cell-currentRollNumber slot.
    expect(wrapper.text()).toContain('—');
    // Each row gets its own decision select, defaulted to the suggested decision (PROMOTED).
    const decisionSelect = wrapper.find('[data-testid="decision-student-1"]');
    expect(decisionSelect.exists()).toBe(true);
    expect((decisionSelect.element as HTMLSelectElement).value).toBe('PROMOTED');
  });

  it('executes with the default all-PROMOTED decisions and calls api.executePromotions with the expected payload', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);
    vi.mocked(api.previewPromotions).mockResolvedValueOnce([]); // re-fetch after a successful execute
    vi.mocked(api.executePromotions).mockResolvedValueOnce({ processed: 2 });

    const wrapper = mount(PromotionView);
    await flushPromises();

    await loadStudents(wrapper);
    await pickTargetSessionAndBulkAssign(wrapper);

    await wrapper.find('[data-testid="execute-promotions"]').trigger('click');
    await flushPromises();

    expect(api.executePromotions).toHaveBeenCalledWith('token-1', {
      sourceAcademicSessionId: 'sess-active',
      targetAcademicSessionId: 'sess-target',
      decisions: [
        { studentId: 'student-1', decision: 'PROMOTED', targetSectionId: 'section-target' },
        { studentId: 'student-2', decision: 'PROMOTED', targetSectionId: 'section-target' },
      ],
    });
  });

  it("changing one row's decision to WITHDRAWN clears and disables that row's target-section field", async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);

    const wrapper = mount(PromotionView);
    await flushPromises();

    await loadStudents(wrapper);
    await wrapper.find('[data-testid="select-target-session"]').setValue('sess-target');

    // Give the row a target section first, so we can observe it actually get cleared.
    const targetSectionField = wrapper.find('[data-testid="target-section-student-1"]');
    await targetSectionField.setValue('section-target');
    expect((targetSectionField.element as HTMLSelectElement).value).toBe('section-target');
    expect((targetSectionField.element as HTMLSelectElement).disabled).toBe(false);

    await wrapper.find('[data-testid="decision-student-1"]').setValue('WITHDRAWN');
    await flushPromises();

    expect((targetSectionField.element as HTMLSelectElement).value).toBe('');
    expect((targetSectionField.element as HTMLSelectElement).disabled).toBe(true);
  });

  it('requires the confirm dialog to be accepted before calling api.executePromotions', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);
    vi.mocked(api.previewPromotions).mockResolvedValueOnce([]); // re-fetch after the eventual successful execute
    vi.mocked(api.executePromotions).mockResolvedValueOnce({ processed: 2 });
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(PromotionView);
    await flushPromises();

    await loadStudents(wrapper);
    await pickTargetSessionAndBulkAssign(wrapper);

    await wrapper.find('[data-testid="execute-promotions"]').trigger('click');
    await flushPromises();
    expect(api.executePromotions).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="execute-promotions"]').trigger('click');
    await flushPromises();

    expect(api.executePromotions).toHaveBeenCalledWith('token-1', {
      sourceAcademicSessionId: 'sess-active',
      targetAcademicSessionId: 'sess-target',
      decisions: [
        { studentId: 'student-1', decision: 'PROMOTED', targetSectionId: 'section-target' },
        { studentId: 'student-2', decision: 'PROMOTED', targetSectionId: 'section-target' },
      ],
    });
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Execute promotions?',
      message: 'Promote/retain/withdraw 2 student(s) into 2026-2027? This cannot be undone automatically.',
      danger: true,
    });
  });

  it('shows an error banner when api.executePromotions fails', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);
    vi.mocked(api.executePromotions).mockRejectedValueOnce(new Error('Execute failed'));

    const wrapper = mount(PromotionView);
    await flushPromises();

    await loadStudents(wrapper);
    await pickTargetSessionAndBulkAssign(wrapper);

    await wrapper.find('[data-testid="execute-promotions"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Execute failed');
  });
});
