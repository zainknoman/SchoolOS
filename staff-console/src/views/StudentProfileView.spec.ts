// staff-console/src/views/StudentProfileView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import StudentProfileView from './StudentProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type StudentProfileDetail } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

async function mountView(studentId = 's1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/students/:id', name: 'admin-student-profile', component: StudentProfileView }],
  });
  await router.push(`/admin/students/${studentId}`);
  await router.isReady();
  return mount(StudentProfileView, { global: { plugins: [router] } });
}

function baseProfile(overrides: Partial<StudentProfileDetail> = {}): StudentProfileDetail {
  return {
    id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
    firstName: 'Eshaal', middleName: null, lastName: 'Sample', preferredName: null,
    gender: 'FEMALE', dateOfBirth: '2016-03-14', placeOfBirth: null, nationality: 'Pakistani',
    religion: null, bFormNumber: null, profilePhotoFileId: null, status: 'ACTIVE',
    admissionDate: '2022-08-01', leavingDate: null, leavingReason: null,
    studentMobile: null, studentEmail: null,
    currentAddress: null, permanentAddress: null,
    previousSchool: null, emergencyContacts: [], medicalInfo: null, documents: [],
    enrollments: [],
    ...overrides,
  };
}

vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getStudentProfile: vi.fn(),
    updateStudentProfile: vi.fn(),
    updateStudentCurrentEnrollment: vi.fn(),
    upsertStudentPreviousSchool: vi.fn(),
    createStudentEmergencyContact: vi.fn(),
    updateStudentEmergencyContact: vi.fn(),
    deleteStudentEmergencyContact: vi.fn(),
    upsertStudentMedicalInfo: vi.fn(),
    uploadFile: vi.fn(),
    addStudentDocument: vi.fn(),
    verifyStudentDocument: vi.fn(),
  },
}));

describe('StudentProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  const activeEnrollment = {
    id: 'enr-1', rollNumber: '12', remarks: null,
    section: { id: 'sec-1', name: '3A', class: { id: 'c-1', name: 'Grade 3', campus: { id: 'cam-1', name: 'PECHS Campus' } } },
    };

    it('shows the current enrollment and edits roll number/remarks', async () => {
        vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ enrollments: [activeEnrollment] }));
        vi.mocked(api.updateStudentCurrentEnrollment).mockResolvedValue({ ...activeEnrollment, rollNumber: '15' });

        const wrapper = await mountView();
        await flushPromises();

        expect(wrapper.text()).toContain('Grade 3');
        expect(wrapper.text()).toContain('PECHS Campus');

        await wrapper.find('[data-testid="edit-enrollment"]').trigger('click');
        await wrapper.find('[data-testid="enrollment-rollNumber"]').setValue('15');
        await wrapper.find('[data-testid="enrollment-save"]').trigger('click');
        await flushPromises();

        expect(api.updateStudentCurrentEnrollment).toHaveBeenCalledWith('token-1', 's1', {
            rollNumber: '15', remarks: undefined,
        });
    });

    it('shows "No active enrollment" and no edit control when there is none', async () => {
        vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ enrollments: [] }));

        const wrapper = await mountView();
        await flushPromises();

        expect(wrapper.text()).toContain('No active enrollment');
        expect(wrapper.find('[data-testid="edit-enrollment"]').exists()).toBe(false);
    });

  it('loads and displays the student profile read-only', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());

    const wrapper = await mountView();
    await flushPromises();

    expect(api.getStudentProfile).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.text()).toContain('Eshaal Sample');
    expect(wrapper.text()).toContain('GR-1001');
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
  });

  it('shows a page-level error when the profile fails to load', async () => {
    vi.mocked(api.getStudentProfile).mockRejectedValue(new Error('Student not found'));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Student not found');
  });

  it('edits and saves profile fields', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.updateStudentProfile).mockResolvedValue(baseProfile({ firstName: 'Renamed' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="profile-firstName"]').setValue('Renamed');
    await wrapper.find('[data-testid="profile-save"]').trigger('click');
    await flushPromises();

    expect(api.updateStudentProfile).toHaveBeenCalledWith(
      'token-1',
      's1',
      expect.objectContaining({ firstName: 'Renamed' }),
    );
    expect(api.getStudentProfile).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
  });

  it('creates a new currentAddress when the student has none yet', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.updateStudentProfile).mockResolvedValue(baseProfile());

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="profile-currentAddress-line1"]').setValue('House 1, Street 2');
    await wrapper.find('[data-testid="profile-save"]').trigger('click');
    await flushPromises();

    expect(api.updateStudentProfile).toHaveBeenCalledWith(
      'token-1',
      's1',
      expect.objectContaining({ currentAddress: expect.objectContaining({ line1: 'House 1, Street 2' }) }),
    );
  });

  it('cancels an edit without saving', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="profile-firstName"]').setValue('Discard me');
    await wrapper.find('[data-testid="profile-cancel"]').trigger('click');

    expect(api.updateStudentProfile).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Eshaal Sample');
  });

  it('shows an error and stays in edit mode when saving the profile fails', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
    vi.mocked(api.updateStudentProfile).mockRejectedValue(new Error('This B-Form number is already in use.'));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    await wrapper.find('[data-testid="profile-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="profile-error"]').text()).toContain('B-Form number');
    expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(true);
  });

  it('adds a previous school when none exists yet', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ previousSchool: null }));
    vi.mocked(api.upsertStudentPreviousSchool).mockResolvedValue({
        id: 'ps1', schoolName: 'Old School', address: null, contactNumber: null, email: null,
        lastClassAttended: null, admissionDate: null, leavingDate: null, leavingCertificateNumber: null,
        leavingCertificateDate: null, reasonForLeaving: null, academicRemarks: null,
    });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No previous school on file');
    await wrapper.find('[data-testid="edit-previous-school"]').trigger('click');
    await wrapper.find('[data-testid="previous-school-schoolName"]').setValue('Old School');
    await wrapper.find('[data-testid="previous-school-save"]').trigger('click');
    await flushPromises();

    expect(api.upsertStudentPreviousSchool).toHaveBeenCalledWith(
        'token-1', 's1', expect.objectContaining({ schoolName: 'Old School' }),
    );
  });

  it('shows an existing previous school read-only, and its address when present', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({
        previousSchool: {
        id: 'ps1', schoolName: 'Beaconhouse Prep', address: { id: 'a1', line1: 'Old House', line2: null, area: null, city: 'Karachi', district: null, province: null, postalCode: null, country: 'Pakistan' },
        contactNumber: null, email: null, lastClassAttended: 'Grade 2', admissionDate: null, leavingDate: null,
        leavingCertificateNumber: null, leavingCertificateDate: null, reasonForLeaving: null, academicRemarks: null,
        },
    }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Beaconhouse Prep');
    expect(wrapper.text()).toContain('Old House');
  });

  const emergencyContact = {
    id: 'ec1', name: 'Amina Sample', relationship: 'Mother', phone: '0300-1234567',
    alternatePhone: null, email: null, address: null, priority: 1, isPrimary: true,
  };

  it('lists emergency contacts and adds a new one', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.createStudentEmergencyContact).mockResolvedValue({ ...emergencyContact, id: 'ec2', name: 'New Contact' });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Amina Sample');

    await wrapper.find('[data-testid="new-contact-name"]').setValue('New Contact');
    await wrapper.find('[data-testid="new-contact-relationship"]').setValue('Uncle');
    await wrapper.find('[data-testid="new-contact-phone"]').setValue('0311-0000000');
    await wrapper.find('[data-testid="add-contact-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudentEmergencyContact).toHaveBeenCalledWith('token-1', 's1', {
      name: 'New Contact', relationship: 'Uncle', phone: '0311-0000000',
      alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
    });
  });

  it('edits an emergency contact in place', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.updateStudentEmergencyContact).mockResolvedValue({ ...emergencyContact, name: 'Renamed Contact' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-contact-ec1"]').trigger('click');
    await wrapper.find('[data-testid="edit-contact-name-ec1"]').setValue('Renamed Contact');
    await wrapper.find('[data-testid="save-contact-ec1"]').trigger('click');
    await flushPromises();

    expect(api.updateStudentEmergencyContact).toHaveBeenCalledWith(
      'token-1', 's1', 'ec1', expect.objectContaining({ name: 'Renamed Contact' }),
    );
  });

  it('deletes an emergency contact after confirmation', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.deleteStudentEmergencyContact).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-contact-ec1"]').trigger('click');
    await flushPromises();

    expect(api.deleteStudentEmergencyContact).toHaveBeenCalledWith('token-1', 's1', 'ec1');
  });

  it('edits and saves medical info', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ medicalInfo: null }));
    vi.mocked(api.upsertStudentMedicalInfo).mockResolvedValue({
      id: 'm1', bloodGroup: 'O_POS', allergies: 'None known', medicalConditions: null,
      specialEducationalNeeds: null, medicationNotes: null, emergencyMedicalNotes: null,
    });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No medical information on file');
    await wrapper.find('[data-testid="edit-medical-info"]').trigger('click');
    await wrapper.find('[data-testid="medical-bloodGroup"]').setValue('O_POS');
    await wrapper.find('[data-testid="medical-allergies"]').setValue('None known');
    await wrapper.find('[data-testid="medical-save"]').trigger('click');
    await flushPromises();

    expect(api.upsertStudentMedicalInfo).toHaveBeenCalledWith('token-1', 's1', {
      bloodGroup: 'O_POS', allergies: 'None known', medicalConditions: undefined,
      specialEducationalNeeds: undefined, medicationNotes: undefined, emergencyMedicalNotes: undefined,
    });
  });

  const pendingDocument = {
    id: 'd1', documentType: 'BIRTH_CERTIFICATE',
    file: { id: 'f1', originalName: 'birth-cert.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
    expiryDate: null, verificationStatus: 'PENDING' as const, verifiedById: null, verifiedAt: null,
    notes: null, createdAt: '2026-09-14T00:00:00.000Z',
  };

  it('lists documents and uploads a new one', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f2' });
    vi.mocked(api.addStudentDocument).mockResolvedValue({ ...pendingDocument, id: 'd2' });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('birth-cert.pdf');

    await wrapper.find('[data-testid="new-document-type"]').setValue('CNIC');
    const fileInput = wrapper.find('[data-testid="new-document-file"]');
    const file = new File(['data'], 'cnic.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await wrapper.find('[data-testid="add-document-submit"]').trigger('click');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
    expect(api.addStudentDocument).toHaveBeenCalledWith('token-1', 's1', {
      documentType: 'CNIC', fileId: 'f2', expiryDate: undefined, notes: undefined,
    });
  });

  it('verifies a pending document', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.verifyStudentDocument).mockResolvedValue({ ...pendingDocument, verificationStatus: 'VERIFIED' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="verify-document-d1"]').trigger('click');
    await flushPromises();

    expect(api.verifyStudentDocument).toHaveBeenCalledWith('token-1', 's1', 'd1', true);
  });

  it('rejects a pending document', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.verifyStudentDocument).mockResolvedValue({ ...pendingDocument, verificationStatus: 'REJECTED' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="reject-document-d1"]').trigger('click');
    await flushPromises();

    expect(api.verifyStudentDocument).toHaveBeenCalledWith('token-1', 's1', 'd1', false);
  });

  it('hides verify/reject actions for a document that is already decided', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({
      documents: [{ ...pendingDocument, verificationStatus: 'VERIFIED' }],
    }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.find('[data-testid="verify-document-d1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="reject-document-d1"]').exists()).toBe(false);
  });

});