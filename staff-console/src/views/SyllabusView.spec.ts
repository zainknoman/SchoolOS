import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SyllabusView from './SyllabusView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type SyllabusDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listSubjects: vi.fn(),
    listTerms: vi.fn(),
    listSyllabi: vi.fn(),
    getSyllabus: vi.fn(),
    createSyllabus: vi.fn(),
    updateSyllabus: vi.fn(),
    deleteSyllabus: vi.fn(),
  },
}));

vi.mock('../lib/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));

const detail = (over: Partial<SyllabusDetail> = {}): SyllabusDetail => ({
  id: 'syl-1',
  classId: 'c1',
  className: 'Grade 3',
  academicSessionId: 's1',
  sessionLabel: '2026',
  editable: true,
  subjectId: 'sub-1',
  subjectName: 'Science',
  overview: 'Living things',
  units: [
    {
      id: 'u1',
      order: 1,
      title: 'Plants',
      topics: 'Roots',
      termId: 't1',
      termLabel: 'Term 1',
      plannedStart: '2026-01-10T00:00:00.000Z',
      plannedEnd: '2026-02-10T00:00:00.000Z',
    },
  ],
  updatedAt: '2026-01-01',
  ...over,
});

function setRole(role: string) {
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  auth.role = role as never;
}

async function chooseClass(wrapper: ReturnType<typeof mount>) {
  await flushPromises();
  await wrapper.find('[data-testid="syllabus-class"]').setValue('c1');
  await flushPromises();
}

describe('SyllabusView (BL-26)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.listClasses).mockReset().mockResolvedValue([
      { id: 'c1', name: 'Grade 3', campusId: 'cp', campusName: 'Main', academicSessionId: 's1', academicSessionLabel: '2026' },
    ]);
    vi.mocked(api.listSubjects).mockReset().mockResolvedValue([
      { id: 'sub-1', name: 'Science', isActive: true },
      { id: 'sub-2', name: 'Maths', isActive: true },
      { id: 'sub-3', name: 'Latin', isActive: false },
    ]);
    vi.mocked(api.listTerms).mockReset().mockResolvedValue([
      { id: 't1', academicSessionId: 's1', label: 'Term 1', order: 1, startDate: '', endDate: '' },
    ]);
    vi.mocked(api.listSyllabi).mockReset().mockResolvedValue([
      {
        id: 'syl-1',
        classId: 'c1',
        className: 'Grade 3',
        academicSessionId: 's1',
        subjectId: 'sub-1',
        subjectName: 'Science',
        unitCount: 1,
        updatedAt: '',
      },
    ]);
    vi.mocked(api.getSyllabus).mockReset().mockResolvedValue(detail());
    vi.mocked(api.createSyllabus).mockReset();
    vi.mocked(api.updateSyllabus).mockReset();
    vi.mocked(api.deleteSyllabus).mockReset();
  });

  it('an admin can add a syllabus only for active subjects that have none yet', async () => {
    setRole('SCHOOL_ADMIN');
    vi.mocked(api.createSyllabus).mockResolvedValue(detail({ id: 'syl-2', subjectId: 'sub-2', subjectName: 'Maths', units: [] }));
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    const options = wrapper.findAll('[data-testid="syllabus-new-subject"] option').map((o) => o.text());
    expect(options).toContain('Maths');
    expect(options).not.toContain('Science');
    expect(options).not.toContain('Latin');

    await wrapper.find('[data-testid="syllabus-new-subject"]').setValue('sub-2');
    await wrapper.find('[data-testid="syllabus-create"]').trigger('click');
    await flushPromises();
    expect(api.createSyllabus).toHaveBeenCalledWith('token-1', { classId: 'c1', subjectId: 'sub-2' });
    expect(wrapper.find('[data-testid="syllabus-editor"]').text()).toContain('Maths');
  });

  it('an admin edits units, reorders them and saves the whole list', async () => {
    setRole('SCHOOL_ADMIN');
    vi.mocked(api.updateSyllabus).mockResolvedValue(detail());
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    await wrapper.find('[data-testid="syllabus-open-syl-1"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-testid="syllabus-add-unit"]').trigger('click');
    await wrapper.find('[data-testid="unit-title-1"]').setValue('Animals');
    await wrapper.find('[aria-label="Move unit 2 up"]').trigger('click');
    await wrapper.find('[data-testid="syllabus-save"]').trigger('click');
    await flushPromises();

    expect(api.updateSyllabus).toHaveBeenCalledWith('token-1', 'syl-1', {
      overview: 'Living things',
      units: [
        { title: 'Animals', topics: null, termId: null, plannedStart: null, plannedEnd: null },
        { title: 'Plants', topics: 'Roots', termId: 't1', plannedStart: '2026-01-10', plannedEnd: '2026-02-10' },
      ],
    });
  });

  it('a unit without a title is not sent', async () => {
    setRole('SCHOOL_ADMIN');
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    await wrapper.find('[data-testid="syllabus-open-syl-1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="syllabus-add-unit"]').trigger('click');
    await wrapper.find('[data-testid="syllabus-save"]').trigger('click');
    await flushPromises();
    expect(api.updateSyllabus).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Every unit needs a title.');
  });

  it('a teacher reads the syllabus without editing controls', async () => {
    setRole('TEACHER');
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    expect(api.listSubjects).not.toHaveBeenCalled();
    expect(api.listTerms).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="syllabus-create"]').exists()).toBe(false);
    await wrapper.find('[data-testid="syllabus-open-syl-1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="syllabus-save"]').exists()).toBe(false);
    const text = wrapper.find('[data-testid="syllabus-editor"]').text();
    expect(text).toContain('Plants');
    expect(text).toContain('Term 1');
    expect(text).toContain('2026-01-10');
  });

  it('an ended session is shown as read-only history, even to an admin', async () => {
    setRole('SCHOOL_ADMIN');
    vi.mocked(api.getSyllabus).mockResolvedValue(detail({ editable: false }));
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    await wrapper.find('[data-testid="syllabus-open-syl-1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="syllabus-history"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="syllabus-save"]').exists()).toBe(false);
  });

  it('delete asks for confirmation and removes it', async () => {
    setRole('SCHOOL_ADMIN');
    vi.mocked(api.deleteSyllabus).mockResolvedValue(undefined);
    const wrapper = mount(SyllabusView);
    await chooseClass(wrapper);
    await wrapper.find('[data-testid="syllabus-open-syl-1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="syllabus-delete"]').trigger('click');
    await flushPromises();
    expect(api.deleteSyllabus).toHaveBeenCalledWith('token-1', 'syl-1');
    expect(wrapper.find('[data-testid="syllabus-editor"]').exists()).toBe(false);
  });
});
