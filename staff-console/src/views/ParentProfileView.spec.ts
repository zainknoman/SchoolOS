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
  GUARDIAN_RELATIONSHIP_OPTIONS: [
    { value: 'FATHER', label: 'Father' },
    { value: 'MOTHER', label: 'Mother' },
    { value: 'GUARDIAN', label: 'Guardian' },
    { value: 'OTHER', label: 'Other' },
  ],
  api: {
    getParentProfile: vi.fn(),
    updateParent: vi.fn(),
    updateParentChildLink: vi.fn(),
    resetParentPassword: vi.fn(),
    linkParentChild: vi.fn(),
    unlinkParentChild: vi.fn(),
    listAdminStudents: vi.fn(),
  },
}));
const confirmMock = vi.fn();
vi.mock('../lib/useConfirm', () => ({ useConfirm: () => ({ confirm: confirmMock }) }));

const PROFILE: ParentProfileDetail = {
  id: 'p1', identifier: 'sana@x.pk', name: 'Sana Khan', phone: '0300-1', childrenCount: 1,
  cnic: '42101-1234567-1', gender: 'FEMALE', dateOfBirth: '1985-03-04', alternatePhone: null, whatsappNumber: null,
  email: 'sana@x.pk', occupation: 'Doctor', employerName: null, designation: null, currentAddress: null, permanentAddress: null,
  children: [
    { studentId: 's1', studentName: 'Eshaal', grNumber: 'GR-1', className: 'Grade 3', sectionName: '3A', relationship: 'mother', relationshipType: 'MOTHER', primarySlot: null, isPrimary: false, isEmergencyContact: true },
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

  it('BL-04: changing the relationship sends the typed value', async () => {
    vi.mocked(api.updateParentChildLink).mockResolvedValue(PROFILE);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="relationship-s1"]').setValue('GUARDIAN');
    await flushPromises();

    expect(api.updateParentChildLink).toHaveBeenCalledWith('token-1', 'p1', 's1', { relationshipType: 'GUARDIAN' });
  });

  it('BL-04: a third primary guardian is refused — the message shows and the page reloads', async () => {
    vi.mocked(api.updateParentChildLink).mockRejectedValue(
      new Error('This student already has two primary guardians; make one of them non-primary first'),
    );
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="primary-s1"]').setValue(true);
    await flushPromises();

    expect(wrapper.find('[data-testid="link-error"]').text()).toContain('two primary guardians');
    expect(api.getParentProfile).toHaveBeenCalledTimes(2);
  });

  it('BL-23: links another student with a relationship, and removes a link after confirmation', async () => {
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1', name: 'Eshaal', sectionName: '3A', className: 'Grade 3', campusName: 'Main', parentNames: [] },
      { id: 's2', grNumber: 'GR-2', name: 'Ahmed', sectionName: '6B', className: 'Grade 6', campusName: 'Main', parentNames: [] },
    ]);
    vi.mocked(api.linkParentChild).mockResolvedValue(PROFILE);
    vi.mocked(api.unlinkParentChild).mockResolvedValue(undefined);
    confirmMock.mockResolvedValue(true);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-link-child"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="link-student"]').setValue('s2');
    await wrapper.find('[data-testid="link-relationship"]').setValue('FATHER');
    await wrapper.find('[data-testid="link-submit"]').trigger('click');
    await flushPromises();
    expect(api.linkParentChild).toHaveBeenCalledWith('token-1', 'p1', {
      studentId: 's2',
      relationshipType: 'FATHER',
      isPrimary: false,
    });

    await wrapper.find('[data-testid="unlink-s1"]').trigger('click');
    await flushPromises();
    expect(api.unlinkParentChild).toHaveBeenCalledWith('token-1', 'p1', 's1');
  });

  it('shows an error when the profile cannot be loaded', async () => {
    vi.mocked(api.getParentProfile).mockRejectedValue(new Error('Parent not found'));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Parent not found');
  });

  it('resets the password after confirmation and shows the one-time password once (BL-64)', async () => {
    confirmMock.mockResolvedValue(true);
    vi.mocked(api.resetParentPassword).mockResolvedValue({ temporaryPassword: 'Hq7M-wR3k-Tz9c', mustChangePassword: true });
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="reset-password"]').trigger('click');
    await flushPromises();

    expect(api.resetParentPassword).toHaveBeenCalledWith('token-1', 'p1');
    expect(wrapper.find('[data-testid="temp-password"]').text()).toBe('Hq7M-wR3k-Tz9c');
    await wrapper.find('[data-testid="temp-password-done"]').trigger('click');
    expect(wrapper.find('[data-testid="temp-password-panel"]').exists()).toBe(false);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    confirmMock.mockResolvedValue(false);
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('[data-testid="reset-password"]').trigger('click');
    await flushPromises();
    expect(api.resetParentPassword).not.toHaveBeenCalled();
  });

  it('shows the server message when the reset is refused', async () => {
    confirmMock.mockResolvedValue(true);
    vi.mocked(api.resetParentPassword).mockRejectedValue(new Error('E-mail password reset is active'));
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('[data-testid="reset-password"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="profile-error"]').text()).toContain('E-mail password reset is active');
  });
});
