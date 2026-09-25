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
  PromotionPreview,
  PromotionPreviewRow,
  StudentPromotionIndicators,
} from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listSections: vi.fn(),
    listAcademicSessions: vi.fn(),
    previewPromotions: vi.fn(),
    executePromotions: vi.fn(),
    updatePromotionPolicy: vi.fn(),
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

const clean: StudentPromotionIndicators = {
  attendance: { present: 90, late: 0, absent: 10, leave: 0, percent: 90 },
  results: { obtained: 80, max: 100, assessments: 4, percent: 80 },
  fees: { outstanding: 0, unpaidVouchers: 0 },
  warnings: [],
  blocked: false,
};
// Sara has fees due and the school blocks a plain PROMOTED while fees are outstanding.
const feesBlocked: StudentPromotionIndicators = {
  ...clean,
  fees: { outstanding: 150000, unpaidVouchers: 1 },
  warnings: [{ code: 'FEES_OUTSTANDING', message: 'Fees outstanding: Rs 1500.00 on 1 voucher(s)', blocking: true }],
  blocked: true,
};
const rowsData: PromotionPreviewRow[] = [
  { studentId: 'student-1', name: 'Ali Khan', grNumber: 'GR-001', currentRollNumber: '12', indicators: clean },
  { studentId: 'student-2', name: 'Sara Ahmed', grNumber: 'GR-002', currentRollNumber: null, indicators: feesBlocked },
];
const policy = { minAttendancePercent: 75, minResultPercent: 40, blockOnAttendance: false, blockOnResults: false, blockOnFees: true };
const previewRows: PromotionPreview = { schoolId: 'school-1', sourceAcademicSessionId: 'sess-active', policy, rows: rowsData };
const emptyPreview: PromotionPreview = { ...previewRows, rows: [] };

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

// Picks the target academic session, chooses outcomes explicitly (Ali: Promoted, Sara: Promoted with
// conditions), then bulk-assigns the target section to every row that needs one.
async function pickTargetSessionAndBulkAssign(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="select-target-session"]').setValue('sess-target');
  await wrapper.find('[data-testid="decision-student-1"]').setValue('PROMOTED');
  await wrapper.find('[data-testid="decision-student-2"]').setValue('PROMOTED_WITH_CONDITIONS');
  await flushPromises();
  await wrapper.find('[data-testid="conditions-student-2"]').setValue('Clear the fees by June');
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
    // BL-05: each row gets its own decision select with NO pre-selected outcome.
    const decisionSelect = wrapper.find('[data-testid="decision-student-1"]');
    expect(decisionSelect.exists()).toBe(true);
    expect((decisionSelect.element as HTMLSelectElement).value).toBe('');
    expect((wrapper.find('[data-testid="execute-promotions"]').element as HTMLButtonElement).disabled).toBe(true);
    // indicators and warnings are shown
    expect(wrapper.find('[data-testid="indicators-student-1"]').text()).toContain('Attendance 90%');
    expect(wrapper.find('[data-testid="indicators-student-2"]').text()).toContain('Rs 1500.00 due');
    expect(wrapper.find('[data-testid="indicators-student-2"]').text()).toContain('Blocks promotion');
    expect(wrapper.find('[data-testid="promotion-policy"]').exists()).toBe(true);
  });

  it('BL-05: a blocked row cannot be executed as a plain Promoted', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);
    const wrapper = mount(PromotionView);
    await flushPromises();
    await loadStudents(wrapper);
    await wrapper.find('[data-testid="select-target-session"]').setValue('sess-target');
    await wrapper.find('[data-testid="bulk-decision"]').setValue('PROMOTED');
    await wrapper.find('[data-testid="apply-bulk-decision"]').trigger('click');
    await wrapper.find('[data-testid="bulk-target-section"]').setValue('section-target');
    await wrapper.find('[data-testid="apply-bulk-target-section"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Blocked by this school');
    expect((wrapper.find('[data-testid="execute-promotions"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('BL-05: saving the promotion rules sends them for the loaded school', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows).mockResolvedValueOnce(previewRows);
    vi.mocked(api.updatePromotionPolicy).mockResolvedValueOnce({ schoolId: 'school-1', ...policy, blockOnFees: false });
    const wrapper = mount(PromotionView);
    await flushPromises();
    await loadStudents(wrapper);
    await wrapper.find('[data-testid="policy-block-fees"]').setValue(false);
    await wrapper.find('[data-testid="save-policy"]').trigger('click');
    await flushPromises();
    expect(api.updatePromotionPolicy).toHaveBeenCalledWith('token-1', {
      schoolId: 'school-1',
      minAttendancePercent: 75,
      minResultPercent: 40,
      blockOnAttendance: false,
      blockOnResults: false,
      blockOnFees: false,
    });
  });

  it('executes the explicitly chosen decisions (with conditions) and sends confirmed: true', async () => {
    mockReferenceData();
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(previewRows);
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(emptyPreview); // re-fetch after a successful execute
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
      confirmed: true,
      decisions: [
        { studentId: 'student-1', decision: 'PROMOTED', targetSectionId: 'section-target' },
        {
          studentId: 'student-2',
          decision: 'PROMOTED_WITH_CONDITIONS',
          targetSectionId: 'section-target',
          conditions: 'Clear the fees by June',
        },
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

    // Give the row an outcome and a target section first, so we can observe it actually get cleared.
    await wrapper.find('[data-testid="decision-student-1"]').setValue('PROMOTED');
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
    vi.mocked(api.previewPromotions).mockResolvedValueOnce(emptyPreview); // re-fetch after the eventual successful execute
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
      confirmed: true,
      decisions: [
        { studentId: 'student-1', decision: 'PROMOTED', targetSectionId: 'section-target' },
        {
          studentId: 'student-2',
          decision: 'PROMOTED_WITH_CONDITIONS',
          targetSectionId: 'section-target',
          conditions: 'Clear the fees by June',
        },
      ],
    });
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Confirm promotion decisions?',
      message:
        'Apply the chosen outcome for 2 student(s) into 2026-2027? 1 of them have warnings (results, attendance or fees). This cannot be undone automatically.',
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
