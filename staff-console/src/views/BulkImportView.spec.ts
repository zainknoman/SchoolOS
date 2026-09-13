import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BulkImportView from './BulkImportView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { previewBulkImport: vi.fn(), commitBulkImport: vi.fn() },
}));

function setFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  return wrapper.find('[data-testid="select-file"]').trigger('change');
}

describe('BulkImportView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.previewBulkImport).mockReset();
    vi.mocked(api.commitBulkImport).mockReset();
  });

  it('disables Commit until a preview with zero errors has run', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({
      rows: [{ line: 2, data: { grNumber: 'GR-1' }, errors: ['name is required'] }],
      validCount: 0,
      errorCount: 1,
    });

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber\nGR-1\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('name is required');
    expect((wrapper.find('[data-testid="commit-submit"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Commit once the preview has zero errors, then commits', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({
      rows: [{ line: 2, data: { grNumber: 'GR-1' }, errors: [] }],
      validCount: 1,
      errorCount: 0,
    });
    vi.mocked(api.commitBulkImport).mockResolvedValue({ createdCount: 1 });

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber,name,sectionId\nGR-1,Alice,sec-1\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();

    expect((wrapper.find('[data-testid="commit-submit"]').element as HTMLButtonElement).disabled).toBe(false);

    await wrapper.find('[data-testid="commit-submit"]').trigger('click');
    await flushPromises();

    expect(api.commitBulkImport).toHaveBeenCalledWith('token-1', 'students', file);
    expect(wrapper.text()).toContain('1 record(s) imported.');
  });

  it('shows the backend error message when commit is rejected', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({ rows: [], validCount: 0, errorCount: 0 });
    vi.mocked(api.commitBulkImport).mockRejectedValue(new Error('One or more rows are invalid; nothing was imported.'));

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="commit-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('One or more rows are invalid');
  });
});
