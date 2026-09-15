import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import StaffProfileView from './StaffProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type StaffProfileDetail } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

async function mountView(staffId = 'st1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/staff/:id', name: 'admin-staff-profile', component: StaffProfileView }],
  });
  await router.push(`/admin/staff/${staffId}`);
  await router.isReady();
  return mount(StaffProfileView, { global: { plugins: [router] } });
}

function baseProfile(overrides: Partial<StaffProfileDetail> = {}): StaffProfileDetail {
  return {
    id: 'st1', name: 'Nazir Ahmed', firstName: 'Nazir', middleName: null, lastName: 'Ahmed',
    employeeType: 'JANITORIAL', gender: 'MALE', dateOfBirth: null, cnic: null, mobile: '0300-1112233',
    email: null, profilePhotoFileId: null, currentAddress: null, permanentAddress: null,
    joiningDate: '2023-01-15', employmentStatus: 'ACTIVE', leavingDate: null, leavingReason: null,
    teacher: null, emergencyContacts: [], experience: [], documents: [],
    ...overrides,
  };
}

vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getStaffProfile: vi.fn(),
    updateStaffProfile: vi.fn(),
    uploadFile: vi.fn(),
    filePreviewUrl: vi.fn(),
    createStaffEmergencyContact: vi.fn(), 
    updateStaffEmergencyContact: vi.fn(),
    deleteStaffEmergencyContact: vi.fn(),
    createStaffExperience: vi.fn(), 
    updateStaffExperience: vi.fn(), 
    deleteStaffExperience: vi.fn(),
    addStaffDocument: vi.fn(), 
    verifyStaffDocument: vi.fn(),
  },
}));

describe('StaffProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('loads and displays the staff profile read-only', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());

    const wrapper = await mountView();
    await flushPromises();

    expect(api.getStaffProfile).toHaveBeenCalledWith('token-1', 'st1');
    expect(wrapper.text()).toContain('Nazir Ahmed');
    expect(wrapper.text()).toContain('JANITORIAL');
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
  });

  it('shows a page-level error when the profile fails to load', async () => {
    vi.mocked(api.getStaffProfile).mockRejectedValue(new Error('Staff member not found'));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Staff member not found');
  });

  it('shows the linked teacher account when present', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(
      baseProfile({ employeeType: 'TEACHER', teacher: { id: 't1', name: 'Ayesha Khan' } }),
    );

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Ayesha Khan');
  });

  it('edits identity/contact/employment fields', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.updateStaffProfile).mockResolvedValue(baseProfile({ mobile: '0300-9998877' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="profile-mobile"]').setValue('0300-9998877');
    await wrapper.find('[data-testid="profile-save"]').trigger('click');
    await flushPromises();

    expect(api.updateStaffProfile).toHaveBeenCalledWith('token-1', 'st1', expect.objectContaining({
      mobile: '0300-9998877',
    }));
  });

  it('shows an initials placeholder in the top-right photo avatar when no photo is on file', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({ profilePhotoFileId: null }));

    const wrapper = await mountView();
    await flushPromises();

    const trigger = wrapper.find('[data-testid="profile-photo-trigger"]');
    expect(trigger.text()).toBe('NA');
    expect(trigger.find('img').exists()).toBe(false);
  });

  it('uploads and saves a new photo chosen from the top-right avatar control', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f2' });
    vi.mocked(api.updateStaffProfile).mockResolvedValue(baseProfile({ profilePhotoFileId: 'f2' }));

    const wrapper = await mountView();
    await flushPromises();

    const fileInput = wrapper.find('[data-testid="profile-photo-input"]');
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
    expect(api.updateStaffProfile).toHaveBeenCalledWith('token-1', 'st1', { profilePhotoFileId: 'f2' });
  });
});

describe('emergency contacts', () => {
  it('adds a contact', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.createStaffEmergencyContact).mockResolvedValue({
      id: 'ec1', name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233',
      alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false,
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="new-contact-name"]').setValue('Bushra Ahmed');
    await wrapper.find('[data-testid="new-contact-relationship"]').setValue('Spouse');
    await wrapper.find('[data-testid="new-contact-phone"]').setValue('0300-1112233');
    await wrapper.find('[data-testid="add-contact-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', {
      name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233',
      alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
    });
  });

  it('edits and deletes a contact', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
      emergencyContacts: [
        { id: 'ec1', name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233', alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false },
      ],
    }));
    vi.mocked(api.updateStaffEmergencyContact).mockResolvedValue({
      id: 'ec1', name: 'Bushra A.', relationship: 'Spouse', phone: '0300-1112233', alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false,
    });
    vi.mocked(api.deleteStaffEmergencyContact).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-contact-ec1"]').trigger('click');
    await wrapper.find('[data-testid="edit-contact-name-ec1"]').setValue('Bushra A.');
    await wrapper.find('[data-testid="save-contact-ec1"]').trigger('click');
    await flushPromises();
    expect(api.updateStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', 'ec1', {
      name: 'Bushra A.', relationship: 'Spouse', phone: '0300-1112233',
      alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
    });

    await wrapper.find('[data-testid="delete-contact-ec1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', 'ec1');
  });
});

describe('experience', () => {
  it('adds an experience entry', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.createStaffExperience).mockResolvedValue({
      id: 'exp1', organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: null, toDate: null, description: null,
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="new-experience-organization"]').setValue('City Grammar School');
    await wrapper.find('[data-testid="new-experience-role"]').setValue('Janitorial Staff');
    await wrapper.find('[data-testid="add-experience-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStaffExperience).toHaveBeenCalledWith('token-1', 'st1', {
      organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: undefined, toDate: undefined, description: undefined,
    });
  });

  it('edits and deletes an experience entry', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
      experience: [
        { id: 'exp1', organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: '2020-01-01', toDate: '2022-12-31', description: null },
      ],
    }));
    vi.mocked(api.updateStaffExperience).mockResolvedValue({
      id: 'exp1', organization: 'City Grammar School', role: 'Senior Janitorial Staff', fromDate: '2020-01-01', toDate: '2022-12-31', description: null,
    });
    vi.mocked(api.deleteStaffExperience).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-experience-exp1"]').trigger('click');
    await wrapper.find('[data-testid="edit-experience-role-exp1"]').setValue('Senior Janitorial Staff');
    await wrapper.find('[data-testid="save-experience-exp1"]').trigger('click');
    await flushPromises();
    expect(api.updateStaffExperience).toHaveBeenCalledWith('token-1', 'st1', 'exp1', {
      organization: 'City Grammar School', role: 'Senior Janitorial Staff',
      fromDate: '2020-01-01', toDate: '2022-12-31', description: undefined,
    });

    await wrapper.find('[data-testid="delete-experience-exp1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStaffExperience).toHaveBeenCalledWith('token-1', 'st1', 'exp1');
  });
});

describe('documents', () => {
  it('uploads a file and adds a document', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f3' });
    vi.mocked(api.addStaffDocument).mockResolvedValue({
      id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
      expiryDate: null, verificationStatus: 'PENDING', verifiedById: null, verifiedAt: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z',
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="new-document-type"]').setValue('CNIC');
    const fileInput = wrapper.find('[data-testid="new-document-file"]');
    const file = new File(['data'], 'cnic.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await wrapper.find('[data-testid="add-document-submit"]').trigger('click');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
    expect(api.addStaffDocument).toHaveBeenCalledWith('token-1', 'st1', {
      documentType: 'CNIC', fileId: 'f3', expiryDate: undefined, notes: undefined,
    });
  });

  it('verifies and rejects a pending document', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
      documents: [
        { id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }, expiryDate: null, verificationStatus: 'PENDING', verifiedById: null, verifiedAt: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    }));
    vi.mocked(api.verifyStaffDocument).mockResolvedValue({
      id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }, expiryDate: null, verificationStatus: 'VERIFIED', verifiedById: 'admin-1', verifiedAt: '2026-01-02T00:00:00.000Z', notes: null, createdAt: '2026-01-01T00:00:00.000Z',
    });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="verify-document-doc1"]').trigger('click');
    await flushPromises();

    expect(api.verifyStaffDocument).toHaveBeenCalledWith('token-1', 'st1', 'doc1', true);
  });

  it('shows "No documents on file" when there are none', async () => {
    vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({ documents: [] }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No documents on file.');
  });
});