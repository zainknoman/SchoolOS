import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import BulkImportView from './BulkImportView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { previewBulkImport: vi.fn(), commitBulkImport: vi.fn(), downloadBulkImportSample: vi.fn() },
}));

// useFocusTarget() (wired for the command palette's "Run a bulk import" deep link) calls
// useRoute(), so every mount needs a router in scope — same pattern FeeManagementView.spec.ts uses.
async function mountView(query: Record<string, string> = {}, attachToBody = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/bulk-import', name: 'admin-bulk-import', component: BulkImportView }],
  });
  await router.push({ path: '/admin/bulk-import', query });
  await router.isReady();
  return mount(BulkImportView, {
    global: { plugins: [router] },
    ...(attachToBody ? { attachTo: document.body } : {}),
  });
}

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
    vi.mocked(api.downloadBulkImportSample).mockReset();
  });

  it('disables the sample download button until an entity is chosen, including the new Staff option', async () => {
    const wrapper = await mountView();
    const options = wrapper.findAll('option').map((o) => o.text());
    expect(options).toContain('Staff');

    expect((wrapper.find('[data-testid="download-sample"]').element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find('[data-testid="select-entity"]').setValue('staff');
    expect((wrapper.find('[data-testid="download-sample"]').element as HTMLButtonElement).disabled).toBe(false);
  });

  it('focuses the entity select when deep-linked with ?focus=entity (command-palette action)', async () => {
    const wrapper = await mountView({ focus: 'entity' }, true);
    await flushPromises();

    expect(wrapper.find('[data-testid="select-entity"]').element).toBe(document.activeElement);
    wrapper.unmount();
  });

  it('downloads the sample file for the selected entity', async () => {
    vi.mocked(api.downloadBulkImportSample).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await wrapper.find('[data-testid="select-entity"]').setValue('staff');

    await wrapper.find('[data-testid="download-sample"]').trigger('click');
    await flushPromises();

    expect(api.downloadBulkImportSample).toHaveBeenCalledWith('token-1', 'staff');
  });

  it('disables Commit until a preview with zero errors has run', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({
      rows: [{ line: 2, data: { grNumber: 'GR-1' }, errors: ['name is required'] }],
      validCount: 0,
      errorCount: 1,
    });

    const wrapper = await mountView();
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

    const wrapper = await mountView();
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

    const wrapper = await mountView();
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
