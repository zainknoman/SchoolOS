import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ParentProfileView from './ParentProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type ParentProfileDetail } from '../lib/api';

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ params: { id: 'p1' } }),
}));
vi.mock('../lib/api', () => ({
  api: { getParentProfile: vi.fn(), updateParent: vi.fn(), updateParentChildLink: vi.fn() },
}));

const PROFILE: ParentProfileDetail = {
  id: 'p1', identifier: 'sana@x.pk', name: 'Sana Khan', phone: '0300-1', childrenCount: 1,
  cnic: '42101-1234567-1', gender: 'FEMALE', dateOfBirth: '1985-03-04', alternatePhone: null, whatsappNumber: null,
  email: 'sana@x.pk', occupation: 'Doctor', employerName: null, designation: null, currentAddress: null, permanentAddress: null,
  children: [
    { studentId: 's1', studentName: 'Eshaal', grNumber: 'GR-1', className: 'Grade 3', sectionName: '3A', relationship: 'mother', isPrimary: false, isEmergencyContact: true },
  ],
};

const mountView = () => mount(ParentProfileView, { global: { stubs: { RouterLink: RouterLinkStub } } });

describe('ParentProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.getParentProfile).mockResolvedValue(PROFILE);
  });

  it('shows the parent details and linked children', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('[data-testid="profile-name"]').text()).toBe('Sana Khan');
    expect(wrapper.text()).toContain('42101-1234567-1');
    expect(wrapper.text()).toContain('Doctor');
    expect(wrapper.text()).toContain('Eshaal');
    expect(wrapper.text()).toContain('Grade 3 3A');
  });

  it('edits the profile and sends only non-empty email/gender/date', async () => {
    vi.mocked(api.updateParent).mockResolvedValue(undefined);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="edit-occupation"]').setValue('Surgeon');
    await wrapper.find('[data-testid="edit-current-line1"]').setValue('5 Rose St');
    await wrapper.find('[data-testid="save-profile"]').trigger('click');
    await flushPromises();

    const payload = vi.mocked(api.updateParent).mock.calls[0]![2];
    expect(payload).toMatchObject({ name: 'Sana Khan', occupation: 'Surgeon', gender: 'FEMALE', currentAddress: { line1: '5 Rose St' } });
    expect(payload.permanentAddress).toBeUndefined();
    expect(api.getParentProfile).toHaveBeenCalledTimes(2);
  });

  it('marks a guardian as primary for a child', async () => {
    vi.mocked(api.updateParentChildLink).mockResolvedValue({
      ...PROFILE, children: [{ ...PROFILE.children[0]!, isPrimary: true }],
    });
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="primary-s1"]').setValue(true);
    await flushPromises();

    expect(api.updateParentChildLink).toHaveBeenCalledWith('token-1', 'p1', 's1', { isPrimary: true });
    expect((wrapper.find('[data-testid="primary-s1"]').element as HTMLInputElement).checked).toBe(true);
  });

  it('shows an error when the profile cannot be loaded', async () => {
    vi.mocked(api.getParentProfile).mockRejectedValue(new Error('Parent not found'));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Parent not found');
  });
});
