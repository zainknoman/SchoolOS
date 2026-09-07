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
    replaceSectionTimetable: vi.fn(),
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
    vi.mocked(api.replaceSectionTimetable).mockReset();
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

    const rows = wrapper.findAll('[data-testid="entries-table"] tbody tr');
    expect(rows).toHaveLength(2);
    // Monday (day 1) sorts before Tuesday (day 2) even though the API returned Tuesday first.
    expect(rows[0]?.text()).toContain('Mathematics');
    expect(rows[1]?.text()).toContain('English');
  });

  it('renders the weekly grid view with each period in its day/period cell', async () => {
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
      {
        id: 't2',
        dayOfWeek: 2,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'English',
        teacher: null,
        room: null,
      },
    ]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    const gridWrap = wrapper.find('[data-testid="view-grid"]');
    expect(gridWrap.exists()).toBe(true);

    const mondayCell = wrapper.find('[data-testid="view-cell-1-1"]');
    expect(mondayCell.text()).toContain('Mathematics');
    expect(mondayCell.text()).toContain('Mr. Second Teacher');
    expect(mondayCell.text()).toContain('Rm 4B');

    // No teacher/room on this one — falls back to "No teacher" and omits the room clause entirely.
    const tuesdayCell = wrapper.find('[data-testid="view-cell-1-2"]');
    expect(tuesdayCell.text()).toContain('English');
    expect(tuesdayCell.text()).toContain('No teacher');
    expect(tuesdayCell.text()).not.toContain('Rm');

    // Wednesday period 1 has nothing scheduled — shows the empty dash, not a cell.
    expect(wrapper.find('[data-testid="view-empty-1-3"]').text()).toBe('—');
    expect(wrapper.find('[data-testid="view-cell-1-3"]').exists()).toBe(false);

    // The period header shows a real time drawn from an actual entry, not a placeholder.
    expect(gridWrap.text()).toContain('08:00–08:40');
  });

  it('does not render the weekly grid for an empty section', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(wrapper.find('[data-testid="view-grid"]').exists()).toBe(false);
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

  describe('bulk grid composer', () => {
    it('opens with a default Mon-Sat, 6-period empty grid for a section with no existing timetable', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="bulk-grid"]').exists()).toBe(true);
      // 6 period rows.
      for (let period = 1; period <= 6; period++) {
        expect(wrapper.find(`[data-testid="bulk-start-${period}"]`).exists()).toBe(true);
      }
      // Mon(1)..Sat(6) columns present, Sunday(0) not, by default.
      for (let day = 1; day <= 6; day++) {
        expect(wrapper.find(`[data-testid="bulk-subject-1-${day}"]`).exists()).toBe(true);
      }
      expect(wrapper.find('[data-testid="bulk-subject-1-0"]').exists()).toBe(false);
    });

    it('fills one cell and saves, posting only that entry to replaceSectionTimetable', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);
      vi.mocked(api.replaceSectionTimetable).mockResolvedValue(undefined);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
      await wrapper.find('[data-testid="bulk-subject-1-1"]').setValue('sub-1');
      await wrapper.find('[data-testid="bulk-teacher-1-1"]').setValue('teacher-1');
      await wrapper.find('[data-testid="bulk-default-room"]').setValue('4B');

      await wrapper.find('[data-testid="save-bulk"]').trigger('click');
      await flushPromises();

      expect(api.replaceSectionTimetable).toHaveBeenCalledWith('token-1', 'sec-1', [
        {
          subjectId: 'sub-1',
          teacherId: 'teacher-1',
          dayOfWeek: 1,
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          room: '4B',
        },
      ]);
      expect(wrapper.text()).toContain('Timetable saved (1 period).');
      // Composer closes back to the (now-reloaded) list view.
      expect(wrapper.find('[data-testid="bulk-grid"]').exists()).toBe(false);
    });

    it('unchecking a day removes its column and excludes it from the saved entries', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);
      vi.mocked(api.replaceSectionTimetable).mockResolvedValue(undefined);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
      await wrapper.find('[data-testid="bulk-subject-1-6"]').setValue('sub-1'); // Saturday

      await wrapper.find('[data-testid="bulk-day-6"]').trigger('change'); // uncheck Saturday
      await flushPromises();

      expect(wrapper.find('[data-testid="bulk-subject-1-6"]').exists()).toBe(false);

      await wrapper.find('[data-testid="save-bulk"]').trigger('click');
      await flushPromises();

      expect(api.replaceSectionTimetable).toHaveBeenCalledWith('token-1', 'sec-1', []);
    });

    it('changing periods-per-day resizes the grid', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="bulk-period-count"]').setValue(2);
      await flushPromises();

      expect(wrapper.find('[data-testid="bulk-start-1"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="bulk-start-2"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="bulk-start-3"]').exists()).toBe(false);
    });

    it('the save button stays disabled until every period with a filled cell has its time set', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      // Valid with nothing filled in at all (an intentional empty save clears the timetable).
      expect(wrapper.find('[data-testid="save-bulk"]').attributes('disabled')).toBeUndefined();

      // Fill a subject without its period's times — now invalid.
      await wrapper.find('[data-testid="bulk-subject-1-1"]').setValue('sub-1');
      expect(wrapper.find('[data-testid="save-bulk"]').attributes('disabled')).toBeDefined();

      // Fill in the times — valid again.
      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
      expect(wrapper.find('[data-testid="save-bulk"]').attributes('disabled')).toBeUndefined();
    });

    it('cancel closes the composer without saving', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="cancel-bulk"]').trigger('click');
      await flushPromises();

      expect(api.replaceSectionTimetable).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="bulk-grid"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="open-bulk"]').exists()).toBe(true);
    });

    it('pre-fills the grid from the section\'s existing timetable when reopened', async () => {
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
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="bulk-subject-1-1"]').element as HTMLSelectElement).toMatchObject({
        value: 'sub-1',
      });
      expect(wrapper.find('[data-testid="bulk-start-1"]').element as HTMLInputElement).toMatchObject({
        value: '08:00',
      });
      expect(wrapper.find('[data-testid="bulk-default-room"]').element as HTMLInputElement).toMatchObject({
        value: '4B',
      });
      expect(wrapper.text()).toContain("Pre-filled from this section's existing timetable");
    });

    it('shows the break duration between two periods, computed from their times', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
      await wrapper.find('[data-testid="bulk-start-2"]').setValue('09:00');
      await wrapper.find('[data-testid="bulk-end-2"]').setValue('09:40');

      expect(wrapper.find('[data-testid="bulk-break-1-1"]').text()).toBe('20 min');
    });

    it('marking a day "Custom times" reveals per-day time inputs, pre-filled from the shared defaults', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');

      expect(wrapper.find('[data-testid="bulk-day-start-1-5"]').exists()).toBe(false); // Friday, not yet custom

      await wrapper.find('[data-testid="bulk-custom-5"]').trigger('change'); // Friday
      await flushPromises();

      expect((wrapper.find('[data-testid="bulk-day-start-1-5"]').element as HTMLInputElement).value).toBe(
        '08:00',
      );
    });

    it('a custom day saves its own times, independent of the shared week schedule (early Friday finish)', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([]);
      vi.mocked(api.replaceSectionTimetable).mockResolvedValue(undefined);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      // Shared week default for period 1.
      await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
      await wrapper.find('[data-testid="bulk-subject-1-1"]').setValue('sub-1'); // Monday uses the default

      // Friday opts into its own (earlier-finishing) time for the same period.
      await wrapper.find('[data-testid="bulk-custom-5"]').trigger('change');
      await wrapper.find('[data-testid="bulk-day-start-1-5"]').setValue('08:00');
      await wrapper.find('[data-testid="bulk-day-end-1-5"]').setValue('08:30');
      await wrapper.find('[data-testid="bulk-subject-1-5"]').setValue('sub-1');

      await wrapper.find('[data-testid="save-bulk"]').trigger('click');
      await flushPromises();

      expect(api.replaceSectionTimetable).toHaveBeenCalledWith('token-1', 'sec-1', [
        expect.objectContaining({ dayOfWeek: 1, period: 1, startTime: '08:00', endTime: '08:40' }),
        expect.objectContaining({ dayOfWeek: 5, period: 1, startTime: '08:00', endTime: '08:30' }),
      ]);
    });

    it('opening the composer auto-detects a day whose existing times already differ and marks it custom', async () => {
      vi.mocked(api.sectionTimetable).mockResolvedValue([
        {
          id: 't1',
          dayOfWeek: 1,
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          subject: 'Mathematics',
          teacher: null,
          room: '4B',
        },
        {
          id: 't2',
          dayOfWeek: 5,
          period: 1,
          startTime: '08:00',
          endTime: '08:30', // Friday already runs a shorter period 1 than Monday
          subject: 'Mathematics',
          teacher: null,
          room: '4B',
        },
      ]);

      const wrapper = mount(TimetableView);
      await flushPromises();
      await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
      await flushPromises();
      await wrapper.find('[data-testid="open-bulk"]').trigger('click');
      await flushPromises();

      expect(
        (wrapper.find('[data-testid="bulk-custom-5"]').element as HTMLInputElement).checked,
      ).toBe(true);
      expect((wrapper.find('[data-testid="bulk-day-end-1-5"]').element as HTMLInputElement).value).toBe(
        '08:30',
      );
    });
  });
});
