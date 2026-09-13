import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DiaryView from './DiaryView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listSubjects: vi.fn(),
    listSectionDiary: vi.fn(),
    uploadFile: vi.fn(),
    createDiaryEntry: vi.fn(),
    suggestDiaryDraft: vi.fn(),
  },
}));

describe('DiaryView', () => {
  
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.listSubjects).mockReset();
    vi.mocked(api.listSectionDiary).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.createDiaryEntry).mockReset();
    vi.mocked(api.suggestDiaryDraft).mockReset()
  });

  it('loads sections/subjects, posts an entry, and refreshes the list', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.createDiaryEntry).mockResolvedValue(undefined);

    const wrapper = mount(DiaryView);
    await flushPromises();

    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('select[data-testid="subject-select"]').setValue('sub-1');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Read chapter 3.');
    await wrapper.find('[data-testid="post-entry"]').trigger('click');
    await flushPromises();

    expect(api.createDiaryEntry).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ sectionId: 'sec-1', subjectId: 'sub-1', text: 'Read chapter 3.' }),
    );
    expect(wrapper.text()).toContain('posted');
  });

  it('snapshots form fields before the upload loop so mid-upload edits do not change what gets posted', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
      { id: 'sec-2', name: '3B', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.createDiaryEntry).mockResolvedValue(undefined);

    let resolveUpload: (value: { id: string }) => void = () => {};
    vi.mocked(api.uploadFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const wrapper = mount(DiaryView);
    await flushPromises();

    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('select[data-testid="subject-select"]').setValue('sub-1');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Read chapter 3.');

    const fileInput = wrapper.find<HTMLInputElement>('[data-testid="file-input"]');
    const file = new File(['content'], 'notes.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');

    await wrapper.find('[data-testid="post-entry"]').trigger('click');
    await flushPromises();

    // Upload is in flight; fields should now be disabled...
    expect((wrapper.find('select[data-testid="section-select"]').element as HTMLSelectElement).disabled).toBe(
      true,
    );
    expect((wrapper.find('textarea[data-testid="entry-text"]').element as HTMLTextAreaElement).disabled).toBe(
      true,
    );

    // ...and even if the underlying reactive state is changed mid-upload, the snapshot protects the payload.
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-2');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Changed after clicking post.');

    resolveUpload({ id: 'file-1' });
    await flushPromises();

    expect(api.createDiaryEntry).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        text: 'Read chapter 3.',
        fileIds: ['file-1'],
      }),
    );
  });

  it('shows an error message if posting fails', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.createDiaryEntry).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );

    const wrapper = mount(DiaryView);
    await flushPromises();
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('select[data-testid="subject-select"]').setValue('sub-1');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Read chapter 3.');
    await wrapper.find('[data-testid="post-entry"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong');
  });

  it('generates a draft suggestion and inserts it into the entry text, without publishing', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.suggestDiaryDraft).mockResolvedValue({
      suggestion: 'Please complete chapter 4 exercises by Monday.',
    });

    const wrapper = mount(DiaryView);
    await flushPromises();

    await wrapper.find('[data-testid="suggest-draft-toggle"]').trigger('click');
    await wrapper.find('[data-testid="draft-context-input"]').setValue('Homework reminder for chapter 4');
    await wrapper.find('[data-testid="draft-context-submit"]').trigger('click');
    await flushPromises();

    expect(api.suggestDiaryDraft).toHaveBeenCalledWith('token-1', 'Homework reminder for chapter 4');
    expect((wrapper.find('[data-testid="entry-text"]').element as HTMLTextAreaElement).value).toBe(
      'Please complete chapter 4 exercises by Monday.',
    );
    expect(api.createDiaryEntry).not.toHaveBeenCalled();
  });
});
