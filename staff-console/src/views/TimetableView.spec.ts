import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimetableView from './TimetableView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listSubjects: vi.fn(),
    listTeachers: vi.fn(),
    sectionTimetable: vi.fn(),
    createTimetableEntry: vi.fn(),
    updateTimetableEntry: vi.fn(),
    deleteTimetableEntry: vi.fn(),
  },
}));

describe('TimetableView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset().mockResolvedValue([
      { id: 'sec-1', name: '4B', className: 'Grade 4', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockReset().mockResolvedValue([
      { id: 'sub-1', name: 'Mathematics' },
      { id: 'sub-2', name: 'English' },
    ]);
    vi.mocked(api.listTeachers).mockReset().mockResolvedValue([
      { id: 'teacher-1', name: 'Mr. Second Teacher' },
    ]);
    vi.mocked(api.sectionTimetable).mockReset();
    vi.mocked(api.createTimetableEntry).mockReset();
    vi.mocked(api.updateTimetableEntry).mockReset();
    vi.mocked(api.deleteTimetableEntry).mockReset();
  });

  it('lists a section\'s periods ordered by day then period once a section is picked', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([
      {
        id: 't2',
        dayOfWeek: 2,
        period: 1,
        startTime: '08:40',
        endTime: '09:20',
        subject: 'English',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Mathematics',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
    ]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    // Monday (day 1) sorts before Tuesday (day 2) even though the API returned Tuesday first.
    expect(rows[0]?.text()).toContain('Mathematics');
    expect(rows[1]?.text()).toContain('English');
  });

  it('shows "No periods scheduled" for an empty section', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(wrapper.text()).toContain('No periods scheduled for this section yet.');
  });

  it('adds a new period via the add form', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);
    vi.mocked(api.createTimetableEntry).mockResolvedValue(undefined);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="add-period"]').setValue('1');
    await wrapper.find('[data-testid="add-start"]').setValue('08:00');
    await wrapper.find('[data-testid="add-end"]').setValue('08:40');
    await wrapper.find('[data-testid="add-subject"]').setValue('sub-1');
    await wrapper.find('[data-testid="add-teacher"]').setValue('teacher-1');
    await wrapper.find('[data-testid="add-room"]').setValue('4B');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createTimetableEntry).toHaveBeenCalledWith('token-1', {
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      teacherId: 'teacher-1',
      dayOfWeek: 1,
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
      room: '4B',
    });
    expect(wrapper.text()).toContain('Period added.');
  });

  it('the add button stays disabled until subject and both times are filled in', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(wrapper.find('[data-testid="add-submit"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="add-start"]').setValue('08:00');
    await wrapper.find('[data-testid="add-end"]').setValue('08:40');
    await wrapper.find('[data-testid="add-subject"]').setValue('sub-1');

    expect(wrapper.find('[data-testid="add-submit"]').attributes('disabled')).toBeUndefined();
  });

  it('edits an existing period inline and saves it', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Mathematics',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
    ]);
    vi.mocked(api.updateTimetableEntry).mockResolvedValue(undefined);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    await wrapper.find('[data-testid="edit-room-t1"]').setValue('4B-Annex');
    await wrapper.find('[data-testid="save-edit-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTimetableEntry).toHaveBeenCalledWith(
      'token-1',
      't1',
      expect.objectContaining({ room: '4B-Annex', subjectId: 'sub-1' }),
    );
    expect(wrapper.text()).toContain('Period updated.');
  });

  it('cancelling an edit leaves the entry unchanged', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Mathematics',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
    ]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    await wrapper.find('[data-testid="cancel-edit-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTimetableEntry).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Mathematics');
  });

  it('deletes a period', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Mathematics',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
    ]);
    vi.mocked(api.deleteTimetableEntry).mockResolvedValue(undefined);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(api.deleteTimetableEntry).toHaveBeenCalledWith('token-1', 't1');
    expect(wrapper.text()).toContain('Period removed.');
  });

  it('shows an error if a period fails to save', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);
    vi.mocked(api.createTimetableEntry).mockRejectedValue(new Error('Something went wrong.'));

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="add-start"]').setValue('08:00');
    await wrapper.find('[data-testid="add-end"]').setValue('08:40');
    await wrapper.find('[data-testid="add-subject"]').setValue('sub-1');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong.');
  });
});
