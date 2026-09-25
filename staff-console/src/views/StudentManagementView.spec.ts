// staff-console/src/views/StudentManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import StudentManagementView from './StudentManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

// useFocusTarget() (wired in Task 4) calls useRoute(), so every mount needs a router in scope —
// same pattern MessagesView.spec.ts already uses for its own ?conversationId= deep link.
async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/students', name: 'admin-students', component: StudentManagementView }],
  });
  await router.push('/admin/students');
  await router.isReady();
  return mount(StudentManagementView, { global: { plugins: [router] } });
}

vi.mock('../lib/api', () => ({
  GUARDIAN_RELATIONSHIP_OPTIONS: [
    { value: 'FATHER', label: 'Father' },
    { value: 'MOTHER', label: 'Mother' },
    { value: 'GUARDIAN', label: 'Guardian' },
    { value: 'OTHER', label: 'Other' },
  ],
  api: {
    listSections: vi.fn(),
    listAdminParents: vi.fn(),
    listAdminStudents: vi.fn(),
    listAdminStudentsPage: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
    unarchiveRecord: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('StudentManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    // BL-40: the table loads a server page; serve it from whatever list a test configured.
    vi.mocked(api.listAdminStudentsPage).mockImplementation(async () => {
      const items = await api.listAdminStudents('token-1');
      return { items, total: items.length };
    });
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@schoolos.edu.pk', name: 'Existing Parent', phone: null, childrenCount: 1 },
    ]);
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
        parentNames: ['Existing Parent'],
      },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists students with their section and parent names', async () => {
    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Eshaal Sample');
    expect(wrapper.text()).toContain('3A');
    expect(wrapper.text()).toContain('Existing Parent');
  });

  it('links each row to that student\'s profile page', async () => {
    const wrapper = await mountView();
    await flushPromises();

    const link = wrapper.find('[data-testid="view-profile-s1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/admin/students/s1');
  });

  it('opens the Add Student modal automatically when deep-linked with ?focus=gr-number', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/admin/students', name: 'admin-students', component: StudentManagementView }],
    });
    await router.push('/admin/students?focus=gr-number');
    await router.isReady();
    const wrapper = mount(StudentManagementView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find('[data-testid="add-gr-number"]').exists()).toBe(true);
  });

  it('creates a student linked to an existing parent (the default mode)', async () => {
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 's2', grNumber: 'GR-2001', name: 'New Student',
      sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
      parentNames: ['Existing Parent'],
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-gr-number"]').setValue('GR-2001');
    await wrapper.find('[data-testid="add-name"]').setValue('New Student');
    await wrapper.find('[data-testid="add-section"]').setValue('sec1');
    await wrapper.find('[data-testid="add-parent-select"]').setValue('p1');
    await wrapper.find('[data-testid="add-relationship"]').setValue('FATHER');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudent).toHaveBeenCalledWith('token-1', {
      grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1', relationshipType: 'FATHER',
    });
  });

  it('creates a student with a brand-new parent when the "+ New Parent" toggle is on', async () => {
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 's3', grNumber: 'GR-2002', name: 'Another Student',
      sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
      parentNames: ['Inline Parent'],
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-gr-number"]').setValue('GR-2002');
    await wrapper.find('[data-testid="add-name"]').setValue('Another Student');
    await wrapper.find('[data-testid="add-section"]').setValue('sec1');
    await wrapper.find('[data-testid="toggle-new-parent"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="add-parent-select"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-parent-identifier"]').setValue('inline-parent@schoolos.edu.pk');
    await wrapper.find('[data-testid="new-parent-password"]').setValue('InlinePass1!');
    await wrapper.find('[data-testid="new-parent-name"]').setValue('Inline Parent');
    await wrapper.find('[data-testid="add-relationship"]').setValue('FATHER');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudent).toHaveBeenCalledWith('token-1', {
      grNumber: 'GR-2002', name: 'Another Student', sectionId: 'sec1',
      newParent: { identifier: 'inline-parent@schoolos.edu.pk', password: 'InlinePass1!', name: 'Inline Parent', phone: undefined },
      relationshipType: 'FATHER',
    });
  });

  it('edits only name/grNumber', async () => {
    vi.mocked(api.updateStudent).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-s1"]').setValue('Renamed Student');
    await wrapper.find('[data-testid="save-s1"]').trigger('click');
    await flushPromises();

    expect(api.updateStudent).toHaveBeenCalledWith('token-1', 's1', { grNumber: 'GR-1001', name: 'Renamed Student' });
  });

  it('BL-07: "Show archived" lists archived students with a Restore action', async () => {
    vi.mocked(api.unarchiveRecord).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="toggle-archived"]').trigger('click');
    await flushPromises();
    expect(api.listAdminStudentsPage).toHaveBeenLastCalledWith('token-1', { page: 1, limit: 25, q: undefined }, true);
    expect(wrapper.find('[data-testid="delete-s1"]').exists()).toBe(false);

    await wrapper.find('[data-testid="restore-s1"]').trigger('click');
    await flushPromises();
    expect(api.unarchiveRecord).toHaveBeenCalledWith('token-1', 'students', 's1');
  });

  it('deletes a student after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteStudent).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStudent).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStudent).toHaveBeenCalledWith('token-1', 's1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Archive this student?',
      message: expect.stringContaining('All records are kept'),
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by real attendance/fee/leave history', async () => {
    vi.mocked(api.deleteStudent).mockRejectedValue(new Error('Cannot delete this Student: other records still reference it.'));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Student');
  });

  it('loads the first page from the server and re-queries on search (BL-40)', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await mountView();
      await flushPromises();
      expect(api.listAdminStudentsPage).toHaveBeenCalledWith('token-1', { page: 1, limit: 25, q: undefined }, false);

      await wrapper.find('[data-testid="entity-search"]').setValue('ali');
      vi.advanceTimersByTime(350);
      await flushPromises();
      expect(api.listAdminStudentsPage).toHaveBeenLastCalledWith('token-1', { page: 1, limit: 25, q: 'ali' }, false);
    } finally {
      vi.useRealTimers();
    }
  });
});
