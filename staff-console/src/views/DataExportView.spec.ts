import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DataExportView from './DataExportView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  DATA_EXPORT_DATASETS: ['students', 'guardians', 'enrolments', 'attendance', 'results', 'fees'],
  api: { downloadDataExport: vi.fn(), listAcademicSessions: vi.fn(), listSchools: vi.fn() },
}));

function setUser(role: string, isPrincipal = false) {
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  auth.role = role as never;
  auth.isPrincipal = isPrincipal;
}

describe('DataExportView (BL-41)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.downloadDataExport).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.listAcademicSessions)
      .mockReset()
      .mockResolvedValue([
        { id: 's1', schoolId: 'a', label: '2026', startDate: '', endDate: '', isActive: true },
        { id: 's2', schoolId: 'b', label: '2026-B', startDate: '', endDate: '', isActive: true },
      ]);
    vi.mocked(api.listSchools)
      .mockReset()
      .mockResolvedValue([{ id: 'a', name: 'School A' } as never, { id: 'b', name: 'School B' } as never]);
  });

  it('a school admin exports students with the chosen session and no sensitive fields', async () => {
    setUser('SCHOOL_ADMIN');
    const wrapper = mount(DataExportView);
    await flushPromises();
    expect(api.listSchools).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="export-school"]').exists()).toBe(false);

    await wrapper.find('[data-testid="export-session"]').setValue('s1');
    await wrapper.find('[data-testid="export-submit"]').trigger('click');
    await flushPromises();

    expect(api.downloadDataExport).toHaveBeenCalledWith('token-1', 'students', {
      schoolId: undefined,
      academicSessionId: 's1',
      from: undefined,
      to: undefined,
      includeSensitive: false,
    });
  });

  it('the sensitive option is disabled unless the admin is the principal', async () => {
    setUser('SCHOOL_ADMIN');
    const wrapper = mount(DataExportView);
    await flushPromises();
    const box = wrapper.find('[data-testid="export-sensitive"]').element as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(wrapper.text()).toContain('Only the principal or a super admin');

    setActivePinia(createPinia());
    setUser('SCHOOL_ADMIN', true);
    const principal = mount(DataExportView);
    await flushPromises();
    await principal.find('[data-testid="export-sensitive"]').setValue(true);
    await principal.find('[data-testid="export-submit"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(api.downloadDataExport).mock.calls[0]?.[2]).toMatchObject({ includeSensitive: true });
  });

  it('attendance asks for a date window instead of a session and has no sensitive option', async () => {
    setUser('SCHOOL_ADMIN', true);
    const wrapper = mount(DataExportView);
    await flushPromises();
    await wrapper.find('[data-testid="export-dataset"]').setValue('attendance');
    expect(wrapper.find('[data-testid="export-session"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="export-sensitive"]').exists()).toBe(false);
    await wrapper.find('[data-testid="export-from"]').setValue('2026-03-01');
    await wrapper.find('[data-testid="export-to"]').setValue('2026-03-31');
    await wrapper.find('[data-testid="export-submit"]').trigger('click');
    await flushPromises();
    expect(api.downloadDataExport).toHaveBeenCalledWith('token-1', 'attendance', {
      schoolId: undefined,
      academicSessionId: undefined,
      from: '2026-03-01',
      to: '2026-03-31',
      includeSensitive: false,
    });
  });

  it('a super admin must pick a school; sessions follow the school', async () => {
    setUser('SUPER_ADMIN');
    const wrapper = mount(DataExportView);
    await flushPromises();
    const submit = wrapper.find('[data-testid="export-submit"]').element as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await wrapper.find('[data-testid="export-school"]').setValue('b');
    const sessionLabels = wrapper.findAll('[data-testid="export-session"] option').map((o) => o.text());
    expect(sessionLabels).toEqual(['All sessions', '2026-B']);
    expect(submit.disabled).toBe(false);

    await wrapper.find('[data-testid="export-submit"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(api.downloadDataExport).mock.calls[0]?.[2]).toMatchObject({ schoolId: 'b' });
  });

  it('shows the server error (for example a refused scope)', async () => {
    setUser('SCHOOL_ADMIN');
    vi.mocked(api.downloadDataExport).mockRejectedValue(new Error('You may only export your own school'));
    const wrapper = mount(DataExportView);
    await flushPromises();
    await wrapper.find('[data-testid="export-submit"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('You may only export your own school');
  });
});
