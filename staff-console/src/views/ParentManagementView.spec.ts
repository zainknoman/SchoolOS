// staff-console/src/views/ParentManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ParentManagementView from './ParentManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  GUARDIAN_RELATIONSHIP_OPTIONS: [
    { value: 'FATHER', label: 'Father' },
    { value: 'MOTHER', label: 'Mother' },
    { value: 'GUARDIAN', label: 'Guardian' },
    { value: 'OTHER', label: 'Other' },
  ],
  api: {
    listAdminParents: vi.fn(),
    listAdminParentsPage: vi.fn(),
    createParent: vi.fn(),
    updateParent: vi.fn(),
    deleteParent: vi.fn(),
    lookupParent: vi.fn(),
    listAdminStudents: vi.fn(),
    linkParentChild: vi.fn(),
  },
}));
const pushMock = vi.fn();
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: pushMock }),
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('ParentManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    // BL-40: the table loads a server page; serve it from whatever list a test configured.
    vi.mocked(api.listAdminParentsPage).mockImplementation(async () => {
      const items = await api.listAdminParents('token-1');
      return { items, total: items.length };
    });
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@schoolos.edu.pk', name: 'Existing Parent', phone: '0300-1111111', childrenCount: 2 },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('BL-23: finds an existing parent by exact login and links them to one of our students', async () => {
    vi.mocked(api.lookupParent).mockResolvedValue({ id: 'p9', identifier: 'father@x.pk', name: 'Shared Father' });
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's5', grNumber: 'GR-5', name: 'Hamza', sectionName: '1A', className: 'Class 1', campusName: 'Main', parentNames: [] },
    ]);
    vi.mocked(api.linkParentChild).mockResolvedValue(undefined as never);
    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="open-find-parent"]').trigger('click');
    await wrapper.find('[data-testid="find-key"]').setValue('father@x.pk');
    await wrapper.find('[data-testid="find-submit"]').trigger('click');
    await flushPromises();
    expect(api.lookupParent).toHaveBeenCalledWith('token-1', { identifier: 'father@x.pk' });
    expect(wrapper.find('[data-testid="find-result"]').text()).toContain('Shared Father');

    await wrapper.find('[data-testid="find-student"]').setValue('s5');
    await wrapper.find('[data-testid="find-relationship"]').setValue('FATHER');
    await wrapper.find('[data-testid="find-link"]').trigger('click');
    await flushPromises();
    expect(api.linkParentChild).toHaveBeenCalledWith('token-1', 'p9', { studentId: 's5', relationshipType: 'FATHER' });
    expect(pushMock).toHaveBeenCalledWith('/admin/parents/p9');
  });

  it('BL-23: a CNIC is looked up as a CNIC; not found shows the message', async () => {
    vi.mocked(api.lookupParent).mockRejectedValue(new Error('No guardian with that key'));
    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="open-find-parent"]').trigger('click');
    await wrapper.find('[data-testid="find-key"]').setValue('35202-1234567-1');
    await wrapper.find('[data-testid="find-submit"]').trigger('click');
    await flushPromises();
    expect(api.lookupParent).toHaveBeenCalledWith('token-1', { cnic: '35202-1234567-1' });
    expect(wrapper.find('[data-testid="find-error"]').text()).toContain('No guardian');
  });

  it('lists parents (with their linked-children count) and creates a new one', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    expect(wrapper.text()).toContain('parent-x@schoolos.edu.pk');
    expect(wrapper.text()).toContain('2');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@schoolos.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-phone"]').setValue('0300-2222222');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@schoolos.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: '0300-2222222',
    });
  });

  it('creates a parent with no phone when the field is left blank', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@schoolos.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@schoolos.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: undefined,
    });
  });

  it('edits name/phone without changing the password when the password field is left blank', async () => {
    vi.mocked(api.updateParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="edit-p1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-p1"]').setValue('Renamed Parent');
    await wrapper.find('[data-testid="save-p1"]').trigger('click');
    await flushPromises();

    expect(api.updateParent).toHaveBeenCalledWith('token-1', 'p1', { name: 'Renamed Parent', phone: '0300-1111111' });
  });

  it('deletes a parent after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteParent).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="delete-p1"]').trigger('click');
    await flushPromises();
    expect(api.deleteParent).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-p1"]').trigger('click');
    await flushPromises();
    expect(api.deleteParent).toHaveBeenCalledWith('token-1', 'p1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this parent?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when create fails on a duplicate identifier', async () => {
    vi.mocked(api.createParent).mockRejectedValue(new Error('This identifier is already in use.'));

    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('dupe@schoolos.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('Dupe');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already in use');
  });
});

describe('ParentManagementView — profile link', () => {
  it('links each row to the parent profile page', async () => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@schoolos.edu.pk', name: 'Existing Parent', phone: null, childrenCount: 1 },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
    const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    expect(wrapper.findComponent<typeof RouterLinkStub>('[data-testid="view-profile-p1"]').props('to')).toBe('/admin/parents/p1');
  });

  it('loads the first page from the server and re-queries on search (BL-40)', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(ParentManagementView, { global: { stubs: { RouterLink: RouterLinkStub } } });
      await flushPromises();
      expect(api.listAdminParentsPage).toHaveBeenCalledWith('token-1', { page: 1, limit: 25, q: undefined });

      await wrapper.find('[data-testid="entity-search"]').setValue('ali');
      vi.advanceTimersByTime(350);
      await flushPromises();
      expect(api.listAdminParentsPage).toHaveBeenLastCalledWith('token-1', { page: 1, limit: 25, q: 'ali' });
    } finally {
      vi.useRealTimers();
    }
  });
});
