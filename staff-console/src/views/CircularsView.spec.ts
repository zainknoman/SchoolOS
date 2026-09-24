import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import CircularsView from './CircularsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

// useFocusTarget() (wired in Task 4) calls useRoute(), so every mount needs a router in scope —
// same pattern MessagesView.spec.ts already uses for its own ?conversationId= deep link.
async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/circulars', name: 'admin-circulars', component: CircularsView }],
  });
  await router.push('/admin/circulars');
  await router.isReady();
  return mount(CircularsView, { global: { plugins: [router] } });
}

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listCirculars: vi.fn(),
    circularStats: vi.fn(),
    uploadFile: vi.fn(),
    publishCircular: vi.fn(),
    suggestCircularDraft: vi.fn(),
    listSchools: vi.fn(),
  },
}));

describe('CircularsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.listCirculars).mockReset();
    vi.mocked(api.circularStats).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.publishCircular).mockReset();
    vi.mocked(api.suggestCircularDraft).mockReset();
  });

  it('generates a draft suggestion and inserts it into the description, without publishing', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listCirculars).mockResolvedValue([]);
    vi.mocked(api.circularStats).mockResolvedValue({ delivered: 0, read: 0 });
    vi.mocked(api.suggestCircularDraft).mockResolvedValue({
      suggestion: 'The Parent-Teacher meeting is scheduled for Friday, 9 AM.',
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="suggest-draft-toggle"]').trigger('click');
    await wrapper.find('[data-testid="draft-context-input"]').setValue('Parent-teacher meeting next Friday');
    await wrapper.find('[data-testid="draft-context-submit"]').trigger('click');
    await flushPromises();

    expect(api.suggestCircularDraft).toHaveBeenCalledWith('token-1', 'Parent-teacher meeting next Friday');
    expect((wrapper.find('[data-testid="description-input"]').element as HTMLTextAreaElement).value).toBe(
      'The Parent-Teacher meeting is scheduled for Friday, 9 AM.',
    );
    expect(api.publishCircular).not.toHaveBeenCalled();
  });
  
  it('publishes a school-wide circular and shows delivered/read counts for existing ones', async () => {
    vi.mocked(api.listSections).mockResolvedValue([]);
    vi.mocked(api.listCirculars).mockResolvedValue([
      {
        id: 'circ-1',
        title: 'PTM',
        description: 'PTM in September.',
        scope: 'school',
        priority: 'normal',
        publishedAt: '2026-08-01T00:00:00.000Z',
        expiresAt: null,
        attachments: [],
        readAt: null,
      },
    ]);
    vi.mocked(api.circularStats).mockResolvedValue({ delivered: 2, read: 1 });
    vi.mocked(api.publishCircular).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Delivered 2');
    expect(wrapper.text()).toContain('Read 1');

    await wrapper.find('input[data-testid="title-input"]').setValue('New notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details here.');
    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();

    expect(api.publishCircular).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ title: 'New notice', description: 'Details here.', scope: 'school' }),
    );
    expect(wrapper.text()).toContain('published');
  });

  it('snapshots form fields before the upload loop so mid-upload edits do not change what gets published', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
      { id: 'sec-2', name: '3B', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listCirculars).mockResolvedValue([]);
    vi.mocked(api.publishCircular).mockResolvedValue(undefined);

    let resolveUpload: (value: { id: string }) => void = () => {};
    vi.mocked(api.uploadFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('input[data-testid="title-input"]').setValue('New notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details here.');
    await wrapper.find('select[data-testid="scope-select"]').setValue('section');
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');

    const fileInput = wrapper.find<HTMLInputElement>('[data-testid="file-input"]');
    const file = new File(['content'], 'notice.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');

    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();

    // Upload is in flight; fields should now be disabled...
    expect((wrapper.find('input[data-testid="title-input"]').element as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (wrapper.find('textarea[data-testid="description-input"]').element as HTMLTextAreaElement).disabled,
    ).toBe(true);
    expect((wrapper.find('select[data-testid="scope-select"]').element as HTMLSelectElement).disabled).toBe(
      true,
    );
    expect((wrapper.find('select[data-testid="section-select"]').element as HTMLSelectElement).disabled).toBe(
      true,
    );

    // ...and even if the underlying reactive state is changed mid-upload, the snapshot protects the payload.
    await wrapper.find('input[data-testid="title-input"]').setValue('Changed after clicking publish.');
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-2');

    resolveUpload({ id: 'file-1' });
    await flushPromises();

    expect(api.publishCircular).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        title: 'New notice',
        description: 'Details here.',
        scope: 'section',
        sectionId: 'sec-1',
        fileIds: ['file-1'],
      }),
    );
  });

  it('shows an error message if publishing fails', async () => {
    vi.mocked(api.listSections).mockResolvedValue([]);
    vi.mocked(api.listCirculars).mockResolvedValue([]);
    vi.mocked(api.publishCircular).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );

    const wrapper = await mountView();
    await flushPromises();
    await wrapper.find('input[data-testid="title-input"]').setValue('New notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details here.');
    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong');
  });

  it('a super admin must pick the school of a whole-school circular (BL-20)', async () => {
    useAuthStore().role = 'SUPER_ADMIN';
    vi.mocked(api.listSections).mockResolvedValue([]);
    vi.mocked(api.listCirculars).mockResolvedValue([]);
    vi.mocked(api.listSchools).mockResolvedValue([
      { id: 'school-b', name: 'School B' } as Awaited<ReturnType<typeof api.listSchools>>[number],
    ]);
    vi.mocked(api.publishCircular).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();
    await wrapper.find('input[data-testid="title-input"]').setValue('Notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details.');
    expect(wrapper.find('[data-testid="publish-circular"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="school-select"]').setValue('school-b');
    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();
    expect(api.publishCircular).toHaveBeenCalledWith('token-1', expect.objectContaining({ scope: 'school', schoolId: 'school-b' }));
  });
});
