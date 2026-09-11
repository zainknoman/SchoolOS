// staff-console/src/views/ParentManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ParentManagementView from './ParentManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listAdminParents: vi.fn(),
    createParent: vi.fn(),
    updateParent: vi.fn(),
    deleteParent: vi.fn(),
  },
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
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'Existing Parent', phone: '0300-1111111', childrenCount: 2 },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists parents (with their linked-children count) and creates a new one', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('parent-x@seeds.edu.pk');
    expect(wrapper.text()).toContain('2');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-phone"]').setValue('0300-2222222');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: '0300-2222222',
    });
  });

  it('creates a parent with no phone when the field is left blank', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: undefined,
    });
  });

  it('edits name/phone without changing the password when the password field is left blank', async () => {
    vi.mocked(api.updateParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
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

    const wrapper = mount(ParentManagementView);
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

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-identifier"]').setValue('dupe@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('Dupe');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already in use');
  });
});
