// staff-console/src/views/HolidaysView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HolidaysView from './HolidaysView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listHolidays: vi.fn(),
    listCampuses: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('HolidaysView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The Seeds School', code: null, campusType: null, logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, openingDate: null, capacity: null, latitude: null, longitude: null, status: 'ACTIVE' as const, departments: [], alternatePhone: null, addressId: null, address: null, phone: null, email: null, studentCount: 0, staffCount: 0 },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists holidays and creates a new one scoped to a campus', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.createHoliday).mockResolvedValue(undefined);

    const wrapper = mount(HolidaysView);
    await flushPromises();

    expect(wrapper.text()).toContain('Eid Break');
    expect(wrapper.text()).toContain('Every campus');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-title"]').setValue('Winter Break');
    await wrapper.find('[data-testid="add-start-date"]').setValue('2026-12-20');
    await wrapper.find('[data-testid="add-end-date"]').setValue('2027-01-05');
    await wrapper.find('[data-testid="add-campus"]').setValue('c1');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createHoliday).toHaveBeenCalledWith('token-1', {
      title: 'Winter Break',
      startDate: '2026-12-20',
      endDate: '2027-01-05',
      campusId: 'c1',
    });
  });

  it('edits a holiday\'s title and dates', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.updateHoliday).mockResolvedValue(undefined);

    const wrapper = mount(HolidaysView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-h1"]').trigger('click');
    await wrapper.find('[data-testid="edit-title-h1"]').setValue('Eid-ul-Fitr Break');
    await wrapper.find('[data-testid="save-h1"]').trigger('click');
    await flushPromises();

    expect(api.updateHoliday).toHaveBeenCalledWith('token-1', 'h1', {
      title: 'Eid-ul-Fitr Break',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    });
  });

  it('deletes a holiday after confirmation, and does nothing if declined', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.deleteHoliday).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(HolidaysView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-h1"]').trigger('click');
    await flushPromises();
    expect(api.deleteHoliday).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-h1"]').trigger('click');
    await flushPromises();
    expect(api.deleteHoliday).toHaveBeenCalledWith('token-1', 'h1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this holiday?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows an error message when loading or saving fails', async () => {
    vi.mocked(api.listHolidays).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(HolidaysView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});