// staff-console/src/views/TermsManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TermsManagementView from './TermsManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listAcademicSessions: vi.fn(),
    listTerms: vi.fn(),
    createTerm: vi.fn(),
    updateTerm: vi.fn(),
    deleteTerm: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('TermsManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists terms for the selected academic session and creates a new one', async () => {
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 't1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.createTerm).mockResolvedValue({
      id: 't2',
      academicSessionId: 'sess-1',
      label: 'Term 2',
      order: 2,
      startDate: '2027-01-05',
      endDate: '2027-06-30',
    });

    const wrapper = mount(TermsManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Term 1');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-label"]').setValue('Term 2');
    await wrapper.find('[data-testid="add-order"]').setValue('2');
    await wrapper.find('[data-testid="add-start-date"]').setValue('2027-01-05');
    await wrapper.find('[data-testid="add-end-date"]').setValue('2027-06-30');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createTerm).toHaveBeenCalledWith('token-1', {
      academicSessionId: 'sess-1',
      label: 'Term 2',
      order: 2,
      startDate: '2027-01-05',
      endDate: '2027-06-30',
    });
  });

  it('edits a term', async () => {
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 't1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.updateTerm).mockResolvedValue({
      id: 't1',
      academicSessionId: 'sess-1',
      label: 'Term One',
      order: 1,
      startDate: '2026-08-01',
      endDate: '2026-12-15',
    });

    const wrapper = mount(TermsManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    await wrapper.find('[data-testid="edit-label-t1"]').setValue('Term One');
    await wrapper.find('[data-testid="save-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTerm).toHaveBeenCalledWith('token-1', 't1', {
      label: 'Term One',
      order: 1,
      startDate: '2026-08-01',
      endDate: '2026-12-15',
    });
  });

  it('deletes a term after confirmation', async () => {
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 't1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.deleteTerm).mockResolvedValue(undefined);

    const wrapper = mount(TermsManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();
    expect(api.deleteTerm).toHaveBeenCalledWith('token-1', 't1');
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(api.listTerms).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(TermsManagementView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
