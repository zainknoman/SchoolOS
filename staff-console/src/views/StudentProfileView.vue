<!-- staff-console/src/views/StudentProfileView.vue -->
<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type AddressInput, type StudentProfileDetail } from '../lib/api';
import { GENDER_OPTIONS, STUDENT_STATUS_OPTIONS, BLOOD_GROUP_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '../lib/student-profile.constants';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import EntityTable from '../components/EntityTable.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { initialsFromName } from '../lib/format';

const auth = useAuthStore();
const { confirm } = useConfirm();
const route = useRoute();
const studentId = route.params.id as string;

const profile = ref<StudentProfileDetail | null>(null);
const pageErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    profile.value = await api.getStudentProfile(auth.accessToken, studentId);
  } catch (err) {
    pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this student.';
  }
}
load();

// Every field here is always a definite string (never undefined) so it can bind to FormField's
// `modelValue: string | boolean` prop — AddressInput's fields are optional (string | undefined),
// which only matters at the API payload boundary, not in this always-populated form state.
function emptyAddress() {
  return { line1: '', line2: '', area: '', city: '', district: '', province: '', postalCode: '', country: '' };
}
function addressPayload(a: ReturnType<typeof emptyAddress>): AddressInput | undefined {
  return a.line1.trim() ? a : undefined;
}

// --- Profile section (identity/contact/academic + addresses) --------------------------------
const isEditingProfile = ref(false);
const profileErrorMessage = ref<string | null>(null);
const isSavingProfile = ref(false);

const profileForm = reactive({
  firstName: '', middleName: '', lastName: '', preferredName: '',
  gender: '', dateOfBirth: '', placeOfBirth: '', nationality: '', religion: '', bFormNumber: '',
  status: 'ACTIVE', admissionDate: '', leavingDate: '', leavingReason: '',
  studentMobile: '', studentEmail: '',
});
const currentAddressForm = reactive(emptyAddress());
const permanentAddressForm = reactive(emptyAddress());

function startEditProfile() {
  if (!profile.value) return;
  const p = profile.value;
  profileForm.firstName = p.firstName ?? '';
  profileForm.middleName = p.middleName ?? '';
  profileForm.lastName = p.lastName ?? '';
  profileForm.preferredName = p.preferredName ?? '';
  profileForm.gender = p.gender ?? '';
  profileForm.dateOfBirth = p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '';
  profileForm.placeOfBirth = p.placeOfBirth ?? '';
  profileForm.nationality = p.nationality ?? '';
  profileForm.religion = p.religion ?? '';
  profileForm.bFormNumber = p.bFormNumber ?? '';
  profileForm.status = p.status;
  profileForm.admissionDate = p.admissionDate ? p.admissionDate.slice(0, 10) : '';
  profileForm.leavingDate = p.leavingDate ? p.leavingDate.slice(0, 10) : '';
  profileForm.leavingReason = p.leavingReason ?? '';
  profileForm.studentMobile = p.studentMobile ?? '';
  profileForm.studentEmail = p.studentEmail ?? '';
  Object.assign(currentAddressForm, p.currentAddress ? { ...emptyAddress(), ...p.currentAddress } : emptyAddress());
  Object.assign(permanentAddressForm, p.permanentAddress ? { ...emptyAddress(), ...p.permanentAddress } : emptyAddress());
  profileErrorMessage.value = null;
  isEditingProfile.value = true;
}

function cancelEditProfile() {
  isEditingProfile.value = false;
  profileErrorMessage.value = null;
}

async function onSaveProfile() {
  if (!auth.accessToken) return;
  profileErrorMessage.value = null;
  isSavingProfile.value = true;
  try {
    await api.updateStudentProfile(auth.accessToken, studentId, {
      firstName: profileForm.firstName || undefined,
      middleName: profileForm.middleName || undefined,
      lastName: profileForm.lastName || undefined,
      preferredName: profileForm.preferredName || undefined,
      gender: (profileForm.gender || undefined) as StudentProfileDetail['gender'] & string | undefined,
      dateOfBirth: profileForm.dateOfBirth || undefined,
      placeOfBirth: profileForm.placeOfBirth || undefined,
      nationality: profileForm.nationality || undefined,
      religion: profileForm.religion || undefined,
      bFormNumber: profileForm.bFormNumber || undefined,
      status: profileForm.status as StudentProfileDetail['status'],
      admissionDate: profileForm.admissionDate || undefined,
      leavingDate: profileForm.leavingDate || undefined,
      leavingReason: profileForm.leavingReason || undefined,
      studentMobile: profileForm.studentMobile || undefined,
      studentEmail: profileForm.studentEmail || undefined,
      currentAddress: addressPayload(currentAddressForm),
      permanentAddress: addressPayload(permanentAddressForm),
    });
    await load();
    isEditingProfile.value = false;
  } catch (err) {
    profileErrorMessage.value = err instanceof Error ? err.message : 'Could not save this profile.';
  } finally {
    isSavingProfile.value = false;
  }
}

// --- Profile photo (top-right avatar) ----------------------------------------------------------
const photoInputRef = ref<HTMLInputElement | null>(null);
const photoPreviewUrl = ref<string | null>(null);
const photoErrorMessage = ref<string | null>(null);
const isSavingPhoto = ref(false);

function triggerPhotoInput() {
  photoInputRef.value?.click();
}

async function onPhotoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file || !auth.accessToken) return;

  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value);
  photoPreviewUrl.value = URL.createObjectURL(file);

  photoErrorMessage.value = null;
  isSavingPhoto.value = true;
  try {
    const uploaded = await api.uploadFile(auth.accessToken, file);
    await api.updateStudentProfile(auth.accessToken, studentId, { profilePhotoFileId: uploaded.id });
    await load();
  } catch (err) {
    photoErrorMessage.value = err instanceof Error ? err.message : 'Could not upload this photo.';
  } finally {
    isSavingPhoto.value = false;
  }
}

onBeforeUnmount(() => {
  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value);
});

// --- Current Enrollment section (roll number + remarks) --------------------------------------
const isEditingEnrollment = ref(false);
const enrollmentErrorMessage = ref<string | null>(null);
const isSavingEnrollment = ref(false);
const enrollmentForm = reactive({ rollNumber: '', remarks: '' });

function startEditEnrollment() {
  const enrollment = profile.value?.enrollments[0];
  enrollmentForm.rollNumber = enrollment?.rollNumber ?? '';
  enrollmentForm.remarks = enrollment?.remarks ?? '';
  enrollmentErrorMessage.value = null;
  isEditingEnrollment.value = true;
}

function cancelEditEnrollment() {
  isEditingEnrollment.value = false;
  enrollmentErrorMessage.value = null;
}

async function onSaveEnrollment() {
  if (!auth.accessToken) return;
  enrollmentErrorMessage.value = null;
  isSavingEnrollment.value = true;
  try {
    await api.updateStudentCurrentEnrollment(auth.accessToken, studentId, {
      rollNumber: enrollmentForm.rollNumber || undefined,
      remarks: enrollmentForm.remarks || undefined,
    });
    await load();
    isEditingEnrollment.value = false;
  } catch (err) {
    enrollmentErrorMessage.value = err instanceof Error ? err.message : 'Could not save the enrollment.';
  } finally {
    isSavingEnrollment.value = false;
  }
}

// --- Previous School section ------------------------------------------------------------------
const isEditingPreviousSchool = ref(false);
const previousSchoolErrorMessage = ref<string | null>(null);
const isSavingPreviousSchool = ref(false);
const previousSchoolForm = reactive({
  schoolName: '', contactNumber: '', email: '', lastClassAttended: '',
  admissionDate: '', leavingDate: '', leavingCertificateNumber: '', leavingCertificateDate: '',
  reasonForLeaving: '', academicRemarks: '',
});
const previousSchoolAddressForm = reactive(emptyAddress());

function startEditPreviousSchool() {
  const ps = profile.value?.previousSchool;
  previousSchoolForm.schoolName = ps?.schoolName ?? '';
  previousSchoolForm.contactNumber = ps?.contactNumber ?? '';
  previousSchoolForm.email = ps?.email ?? '';
  previousSchoolForm.lastClassAttended = ps?.lastClassAttended ?? '';
  previousSchoolForm.admissionDate = ps?.admissionDate ? ps.admissionDate.slice(0, 10) : '';
  previousSchoolForm.leavingDate = ps?.leavingDate ? ps.leavingDate.slice(0, 10) : '';
  previousSchoolForm.leavingCertificateNumber = ps?.leavingCertificateNumber ?? '';
  previousSchoolForm.leavingCertificateDate = ps?.leavingCertificateDate ? ps.leavingCertificateDate.slice(0, 10) : '';
  previousSchoolForm.reasonForLeaving = ps?.reasonForLeaving ?? '';
  previousSchoolForm.academicRemarks = ps?.academicRemarks ?? '';
  Object.assign(previousSchoolAddressForm, ps?.address ? { ...emptyAddress(), ...ps.address } : emptyAddress());
  previousSchoolErrorMessage.value = null;
  isEditingPreviousSchool.value = true;
}

function cancelEditPreviousSchool() {
  isEditingPreviousSchool.value = false;
  previousSchoolErrorMessage.value = null;
}

async function onSavePreviousSchool() {
  if (!auth.accessToken || !previousSchoolForm.schoolName.trim()) return;
  previousSchoolErrorMessage.value = null;
  isSavingPreviousSchool.value = true;
  try {
    await api.upsertStudentPreviousSchool(auth.accessToken, studentId, {
      schoolName: previousSchoolForm.schoolName.trim(),
      contactNumber: previousSchoolForm.contactNumber || undefined,
      email: previousSchoolForm.email || undefined,
      lastClassAttended: previousSchoolForm.lastClassAttended || undefined,
      admissionDate: previousSchoolForm.admissionDate || undefined,
      leavingDate: previousSchoolForm.leavingDate || undefined,
      leavingCertificateNumber: previousSchoolForm.leavingCertificateNumber || undefined,
      leavingCertificateDate: previousSchoolForm.leavingCertificateDate || undefined,
      reasonForLeaving: previousSchoolForm.reasonForLeaving || undefined,
      academicRemarks: previousSchoolForm.academicRemarks || undefined,
      address: addressPayload(previousSchoolAddressForm),
    });
    await load();
    isEditingPreviousSchool.value = false;
  } catch (err) {
    previousSchoolErrorMessage.value = err instanceof Error ? err.message : 'Could not save the previous school.';
  } finally {
    isSavingPreviousSchool.value = false;
  }
}

// --- Emergency Contacts section -----------------------------------------------------------------
const contactsErrorMessage = ref<string | null>(null);
const isSavingContact = ref(false);

const newContact = reactive({ name: '', relationship: '', phone: '', alternatePhone: '', email: '', priority: '1', isPrimary: false });
function resetNewContact() {
  newContact.name = '';
  newContact.relationship = '';
  newContact.phone = '';
  newContact.alternatePhone = '';
  newContact.email = '';
  newContact.priority = '1';
  newContact.isPrimary = false;
}

async function onAddContact() {
  if (!auth.accessToken || !newContact.name.trim() || !newContact.relationship.trim() || !newContact.phone.trim()) return;
  contactsErrorMessage.value = null;
  isSavingContact.value = true;
  try {
    await api.createStudentEmergencyContact(auth.accessToken, studentId, {
      name: newContact.name.trim(),
      relationship: newContact.relationship.trim(),
      phone: newContact.phone.trim(),
      alternatePhone: newContact.alternatePhone || undefined,
      email: newContact.email || undefined,
      priority: Number(newContact.priority) || 1,
      isPrimary: newContact.isPrimary,
    });
    resetNewContact();
    await load();
  } catch (err) {
    contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this contact.';
  } finally {
    isSavingContact.value = false;
  }
}

const editingContactId = ref<string | null>(null);
const editContactForm = reactive({ name: '', relationship: '', phone: '', alternatePhone: '', email: '', priority: '1', isPrimary: false });

function startEditContact(contact: StudentProfileDetail['emergencyContacts'][number]) {
  editingContactId.value = contact.id;
  editContactForm.name = contact.name;
  editContactForm.relationship = contact.relationship;
  editContactForm.phone = contact.phone;
  editContactForm.alternatePhone = contact.alternatePhone ?? '';
  editContactForm.email = contact.email ?? '';
  editContactForm.priority = String(contact.priority);
  editContactForm.isPrimary = contact.isPrimary;
}

function cancelEditContact() {
  editingContactId.value = null;
}

async function onSaveContact(contactId: string) {
  if (!auth.accessToken || !editContactForm.name.trim()) return;
  contactsErrorMessage.value = null;
  try {
    await api.updateStudentEmergencyContact(auth.accessToken, studentId, contactId, {
      name: editContactForm.name.trim(),
      relationship: editContactForm.relationship.trim(),
      phone: editContactForm.phone.trim(),
      alternatePhone: editContactForm.alternatePhone || undefined,
      email: editContactForm.email || undefined,
      priority: Number(editContactForm.priority) || 1,
      isPrimary: editContactForm.isPrimary,
    });
    editingContactId.value = null;
    await load();
  } catch (err) {
    contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not save this contact.';
  }
}

async function onDeleteContact(contactId: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this emergency contact?', message: 'This cannot be undone.', danger: true }))) return;
  contactsErrorMessage.value = null;
  try {
    await api.deleteStudentEmergencyContact(auth.accessToken, studentId, contactId);
    await load();
  } catch (err) {
    contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this contact.';
  }
}

// --- Medical/Welfare Info section -------------------------------------------------------------
const isEditingMedicalInfo = ref(false);
const medicalInfoErrorMessage = ref<string | null>(null);
const isSavingMedicalInfo = ref(false);
const medicalInfoForm = reactive({
  bloodGroup: '', allergies: '', medicalConditions: '', specialEducationalNeeds: '',
  medicationNotes: '', emergencyMedicalNotes: '',
});

function startEditMedicalInfo() {
  const m = profile.value?.medicalInfo;
  medicalInfoForm.bloodGroup = m?.bloodGroup ?? '';
  medicalInfoForm.allergies = m?.allergies ?? '';
  medicalInfoForm.medicalConditions = m?.medicalConditions ?? '';
  medicalInfoForm.specialEducationalNeeds = m?.specialEducationalNeeds ?? '';
  medicalInfoForm.medicationNotes = m?.medicationNotes ?? '';
  medicalInfoForm.emergencyMedicalNotes = m?.emergencyMedicalNotes ?? '';
  medicalInfoErrorMessage.value = null;
  isEditingMedicalInfo.value = true;
}

function cancelEditMedicalInfo() {
  isEditingMedicalInfo.value = false;
  medicalInfoErrorMessage.value = null;
}

async function onSaveMedicalInfo() {
  if (!auth.accessToken) return;
  medicalInfoErrorMessage.value = null;
  isSavingMedicalInfo.value = true;
  try {
    await api.upsertStudentMedicalInfo(auth.accessToken, studentId, {
      bloodGroup: medicalInfoForm.bloodGroup || undefined,
      allergies: medicalInfoForm.allergies || undefined,
      medicalConditions: medicalInfoForm.medicalConditions || undefined,
      specialEducationalNeeds: medicalInfoForm.specialEducationalNeeds || undefined,
      medicationNotes: medicalInfoForm.medicationNotes || undefined,
      emergencyMedicalNotes: medicalInfoForm.emergencyMedicalNotes || undefined,
    });
    await load();
    isEditingMedicalInfo.value = false;
  } catch (err) {
    medicalInfoErrorMessage.value = err instanceof Error ? err.message : 'Could not save medical info.';
  } finally {
    isSavingMedicalInfo.value = false;
  }
}

// --- Documents section ---------------------------------------------------------------------
const documentsErrorMessage = ref<string | null>(null);
const isSavingDocument = ref(false);
const newDocument = reactive({ documentType: '', expiryDate: '', notes: '' });
const newDocumentFile = ref<File | null>(null);

function onNewDocumentFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  newDocumentFile.value = input.files?.[0] ?? null;
}

function resetNewDocument() {
  newDocument.documentType = '';
  newDocument.expiryDate = '';
  newDocument.notes = '';
  newDocumentFile.value = null;
}

async function onAddDocument() {
  if (!auth.accessToken || !newDocument.documentType || !newDocumentFile.value) return;
  documentsErrorMessage.value = null;
  isSavingDocument.value = true;
  try {
    const uploaded = await api.uploadFile(auth.accessToken, newDocumentFile.value);
    await api.addStudentDocument(auth.accessToken, studentId, {
      documentType: newDocument.documentType,
      fileId: uploaded.id,
      expiryDate: newDocument.expiryDate || undefined,
      notes: newDocument.notes || undefined,
    });
    resetNewDocument();
    await load();
  } catch (err) {
    documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this document.';
  } finally {
    isSavingDocument.value = false;
  }
}

function documentTone(status: string): 'success' | 'warning' | 'critical' {
  if (status === 'VERIFIED') return 'success';
  if (status === 'REJECTED') return 'critical';
  return 'warning';
}

async function onVerifyDocument(documentId: string, verified: boolean) {
  if (!auth.accessToken) return;
  documentsErrorMessage.value = null;
  try {
    await api.verifyStudentDocument(auth.accessToken, studentId, documentId, verified);
    await load();
  } catch (err) {
    documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not update this document.';
  }
}
</script>

<template>
  <div class="student-profile">
    <div class="page-header">
      <h1 v-if="profile">{{ profile.name }}</h1>
      <h1 v-else>Student Profile</h1>

      <div v-if="profile" class="photo-widget">
        <button
          type="button"
          class="photo-avatar"
          data-testid="profile-photo-trigger"
          :disabled="isSavingPhoto"
          @click="triggerPhotoInput"
        >
          <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="" class="photo-avatar-img" />
          <template v-else>{{ initialsFromName(profile.name) }}</template>
        </button>
        <label class="sr-only" for="profile-photo-input">Student photo</label>
        <input
          id="profile-photo-input"
          ref="photoInputRef"
          type="file"
          accept="image/*"
          class="sr-only"
          data-testid="profile-photo-input"
          @change="onPhotoFileSelected"
        />
        <span class="photo-hint">{{ isSavingPhoto ? 'Uploading…' : (profile.profilePhotoFileId ? 'Change photo' : 'Upload photo') }}</span>
      </div>
    </div>
    <p v-if="photoErrorMessage" class="error" role="alert" data-testid="profile-photo-error">{{ photoErrorMessage }}</p>
    <p v-if="pageErrorMessage" class="error" role="alert">{{ pageErrorMessage }}</p>

    <div v-if="profile" class="sections">
      <section class="profile-section">
        <div class="section-header">
          <h2>Profile</h2>
          <Button v-if="!isEditingProfile" data-testid="edit-profile" @click="startEditProfile">Edit</Button>
        </div>
        <p v-if="profileErrorMessage" data-testid="profile-error" class="error" role="alert">{{ profileErrorMessage }}</p>

        <dl v-if="!isEditingProfile" class="detail-grid">
          <dt>GR Number</dt><dd>{{ profile.grNumber }}</dd>
          <dt>Full name</dt><dd>{{ profile.name }}</dd>
          <dt>Preferred name</dt><dd>{{ profile.preferredName ?? '—' }}</dd>
          <dt>Gender</dt><dd>{{ profile.gender ?? '—' }}</dd>
          <dt>Date of birth</dt><dd>{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</dd>
          <dt>Nationality</dt><dd>{{ profile.nationality ?? '—' }}</dd>
          <dt>Religion</dt><dd>{{ profile.religion ?? '—' }}</dd>
          <dt>B-Form number</dt><dd>{{ profile.bFormNumber ?? '—' }}</dd>
          <dt>Status</dt><dd>{{ profile.status }}</dd>
          <dt>Admission date</dt><dd>{{ profile.admissionDate ? profile.admissionDate.slice(0, 10) : '—' }}</dd>
          <dt>Mobile</dt><dd>{{ profile.studentMobile ?? '—' }}</dd>
          <dt>Email</dt><dd>{{ profile.studentEmail ?? '—' }}</dd>
          <dt>Current address</dt>
          <dd>{{ profile.currentAddress ? [profile.currentAddress.line1, profile.currentAddress.city].filter(Boolean).join(', ') : '—' }}</dd>
          <dt>Permanent address</dt>
          <dd>{{ profile.permanentAddress ? [profile.permanentAddress.line1, profile.permanentAddress.city].filter(Boolean).join(', ') : '—' }}</dd>
        </dl>

        <div v-else class="edit-form">
          <div class="inline-form">
            <FormField v-model="profileForm.firstName" label="First name" type="text" data-testid="profile-firstName" placeholder="First name" grow />
            <FormField v-model="profileForm.middleName" label="Middle name" type="text" data-testid="profile-middleName" placeholder="Middle name" grow />
            <FormField v-model="profileForm.lastName" label="Last name" type="text" data-testid="profile-lastName" placeholder="Last name" grow />
            <FormField v-model="profileForm.preferredName" label="Preferred name" type="text" data-testid="profile-preferredName" placeholder="Preferred name" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
            <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" />
            <FormField v-model="profileForm.placeOfBirth" label="Place of birth" type="text" data-testid="profile-placeOfBirth" placeholder="Place of birth" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.nationality" label="Nationality" type="text" data-testid="profile-nationality" placeholder="Nationality" grow />
            <FormField v-model="profileForm.religion" label="Religion" type="text" data-testid="profile-religion" placeholder="Religion" grow />
            <FormField v-model="profileForm.bFormNumber" label="B-Form number" type="text" data-testid="profile-bFormNumber" placeholder="B-Form number" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.status" label="Status" type="select" data-testid="profile-status" :options="STUDENT_STATUS_OPTIONS" />
            <FormField v-model="profileForm.admissionDate" label="Admission date" type="date" data-testid="profile-admissionDate" />
            <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" />
          </div>
          <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />
          <div class="inline-form">
            <FormField v-model="profileForm.studentMobile" label="Mobile" type="text" data-testid="profile-studentMobile" placeholder="Mobile" grow />
            <FormField v-model="profileForm.studentEmail" label="Email" type="email" data-testid="profile-studentEmail" placeholder="Email" grow />
          </div>
          <h3>Current address</h3>
          <div class="inline-form">
            <FormField v-model="currentAddressForm.line1" label="Line 1" type="text" data-testid="profile-currentAddress-line1" placeholder="Line 1" grow />
            <FormField v-model="currentAddressForm.line2" label="Line 2" type="text" data-testid="profile-currentAddress-line2" placeholder="Line 2" grow />
            <FormField v-model="currentAddressForm.area" label="Area" type="text" data-testid="profile-currentAddress-area" placeholder="Area" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="currentAddressForm.city" label="City" type="text" data-testid="profile-currentAddress-city" placeholder="City" grow />
            <FormField v-model="currentAddressForm.province" label="Province" type="text" data-testid="profile-currentAddress-province" placeholder="Province" grow />
            <FormField v-model="currentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-currentAddress-postalCode" placeholder="Postal code" grow />
          </div>

          <h3>Permanent address</h3>
          <div class="inline-form">
            <FormField v-model="permanentAddressForm.line1" label="Line 1" type="text" data-testid="profile-permanentAddress-line1" placeholder="Line 1" grow />
            <FormField v-model="permanentAddressForm.line2" label="Line 2" type="text" data-testid="profile-permanentAddress-line2" placeholder="Line 2" grow />
            <FormField v-model="permanentAddressForm.area" label="Area" type="text" data-testid="profile-permanentAddress-area" placeholder="Area" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="permanentAddressForm.city" label="City" type="text" data-testid="profile-permanentAddress-city" placeholder="City" grow />
            <FormField v-model="permanentAddressForm.province" label="Province" type="text" data-testid="profile-permanentAddress-province" placeholder="Province" grow />
            <FormField v-model="permanentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-permanentAddress-postalCode" placeholder="Postal code" grow />
          </div>

          <div class="form-actions">
            <Button data-testid="profile-save" :disabled="isSavingProfile" @click="onSaveProfile">Save</Button>
            <Button variant="secondary" data-testid="profile-cancel" @click="cancelEditProfile">Cancel</Button>
          </div>
        </div>
      </section>

      <section class="profile-section">
        <div class="section-header">
          <h2>Current Enrollment</h2>
          <Button v-if="!isEditingEnrollment && profile.enrollments[0]" data-testid="edit-enrollment" @click="startEditEnrollment">Edit</Button>
        </div>
        <p v-if="enrollmentErrorMessage" class="error" role="alert">{{ enrollmentErrorMessage }}</p>

        <p v-if="!profile.enrollments[0]">No active enrollment.</p>
        <template v-else>
          <dl v-if="!isEditingEnrollment" class="detail-grid">
            <dt>Class</dt><dd>{{ profile.enrollments[0].section.class.name }}{{ profile.enrollments[0].section.name }}</dd>
            <dt>Campus</dt><dd>{{ profile.enrollments[0].section.class.campus.name }}</dd>
            <dt>Roll number</dt><dd>{{ profile.enrollments[0].rollNumber ?? '—' }}</dd>
            <dt>Remarks</dt><dd>{{ profile.enrollments[0].remarks ?? '—' }}</dd>
          </dl>
          <div v-else class="edit-form">
            <FormField v-model="enrollmentForm.rollNumber" label="Roll number" type="text" data-testid="enrollment-rollNumber" placeholder="Roll number" grow />
            <FormField v-model="enrollmentForm.remarks" label="Remarks" type="textarea" data-testid="enrollment-remarks" placeholder="Remarks" />
            <div class="form-actions">
              <Button data-testid="enrollment-save" :disabled="isSavingEnrollment" @click="onSaveEnrollment">Save</Button>
              <Button variant="secondary" data-testid="enrollment-cancel" @click="cancelEditEnrollment">Cancel</Button>
            </div>
          </div>
        </template>
      </section>

      <section class="profile-section">
        <div class="section-header">
          <h2>Previous School</h2>
          <Button v-if="!isEditingPreviousSchool" data-testid="edit-previous-school" @click="startEditPreviousSchool">Edit</Button>
        </div>
        <p v-if="previousSchoolErrorMessage" class="error" role="alert">{{ previousSchoolErrorMessage }}</p>

        <template v-if="!isEditingPreviousSchool">
          <p v-if="!profile.previousSchool">No previous school on file.</p>
          <dl v-else class="detail-grid">
            <dt>School</dt><dd>{{ profile.previousSchool.schoolName }}</dd>
            <dt>Last class attended</dt><dd>{{ profile.previousSchool.lastClassAttended ?? '—' }}</dd>
            <dt>Contact</dt><dd>{{ profile.previousSchool.contactNumber ?? '—' }}</dd>
            <dt>Email</dt><dd>{{ profile.previousSchool.email ?? '—' }}</dd>
            <dt>Reason for leaving</dt><dd>{{ profile.previousSchool.reasonForLeaving ?? '—' }}</dd>
            <dt>Address</dt>
            <dd>{{ profile.previousSchool.address ? [profile.previousSchool.address.line1, profile.previousSchool.address.city].filter(Boolean).join(', ') : '—' }}</dd>
          </dl>
        </template>
        <div v-else class="edit-form">
          <div class="inline-form">
            <FormField v-model="previousSchoolForm.schoolName" label="School name" type="text" data-testid="previous-school-schoolName" placeholder="School name" grow />
            <FormField v-model="previousSchoolForm.lastClassAttended" label="Last class attended" type="text" data-testid="previous-school-lastClassAttended" placeholder="Last class attended" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="previousSchoolForm.contactNumber" label="Contact number" type="text" data-testid="previous-school-contactNumber" placeholder="Contact number" grow />
            <FormField v-model="previousSchoolForm.email" label="Email" type="email" data-testid="previous-school-email" placeholder="Email" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="previousSchoolForm.admissionDate" label="Admission date" type="date" data-testid="previous-school-admissionDate" />
            <FormField v-model="previousSchoolForm.leavingDate" label="Leaving date" type="date" data-testid="previous-school-leavingDate" />
          </div>
          <div class="inline-form">
            <FormField v-model="previousSchoolForm.leavingCertificateNumber" label="Leaving certificate #" type="text" data-testid="previous-school-leavingCertificateNumber" placeholder="Leaving certificate #" grow />
            <FormField v-model="previousSchoolForm.leavingCertificateDate" label="Leaving certificate date" type="date" data-testid="previous-school-leavingCertificateDate" />
          </div>
          <FormField v-model="previousSchoolForm.reasonForLeaving" label="Reason for leaving" type="textarea" data-testid="previous-school-reasonForLeaving" placeholder="Reason for leaving" />
          <FormField v-model="previousSchoolForm.academicRemarks" label="Academic remarks" type="textarea" data-testid="previous-school-academicRemarks" placeholder="Academic remarks" />

          <h3>Address</h3>
          <div class="inline-form">
            <FormField v-model="previousSchoolAddressForm.line1" label="Line 1" type="text" data-testid="previous-school-address-line1" placeholder="Line 1" grow />
            <FormField v-model="previousSchoolAddressForm.city" label="City" type="text" data-testid="previous-school-address-city" placeholder="City" grow />
          </div>

          <div class="form-actions">
            <Button data-testid="previous-school-save" :disabled="isSavingPreviousSchool" @click="onSavePreviousSchool">Save</Button>
            <Button variant="secondary" data-testid="previous-school-cancel" @click="cancelEditPreviousSchool">Cancel</Button>
          </div>
        </div>
      </section>

      <section class="profile-section">
        <h2>Emergency Contacts</h2>
        <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>

        <EntityTable
          :items="profile.emergencyContacts"
          :columns="[
            { key: 'name', label: 'Name' },
            { key: 'relationship', label: 'Relationship' },
            { key: 'phone', label: 'Phone' },
            { key: 'priority', label: 'Priority' },
            { key: 'isPrimary', label: 'Primary' },
          ]"
          row-key="id"
          :editing-id="editingContactId"
        >
          <template #cell-name="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-contact-name-${item.id}`" v-model="editContactForm.name" type="text" />
            <span v-else>{{ item.name }}</span>
          </template>
          <template #cell-relationship="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-contact-relationship-${item.id}`" v-model="editContactForm.relationship" type="text" />
            <span v-else>{{ item.relationship }}</span>
          </template>
          <template #cell-phone="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-contact-phone-${item.id}`" v-model="editContactForm.phone" type="text" />
            <span v-else>{{ item.phone }}</span>
          </template>
          <template #cell-priority="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-contact-priority-${item.id}`" v-model="editContactForm.priority" type="text" />
            <span v-else>{{ item.priority }}</span>
          </template>
          <template #cell-isPrimary="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-contact-isPrimary-${item.id}`" v-model="editContactForm.isPrimary" type="checkbox" />
            <span v-else>{{ item.isPrimary ? 'Yes' : 'No' }}</span>
          </template>
          <template #actions="{ item, editing }">
            <template v-if="editing">
              <Button :data-testid="`save-contact-${item.id}`" @click="onSaveContact(item.id)">Save</Button>
              <Button variant="secondary" @click="cancelEditContact">Cancel</Button>
            </template>
            <template v-else>
              <Button :data-testid="`edit-contact-${item.id}`" @click="startEditContact(item)">Edit</Button>
              <Button variant="secondary" :data-testid="`delete-contact-${item.id}`" @click="onDeleteContact(item.id)">Delete</Button>
            </template>
          </template>
        </EntityTable>

        <h3>Add contact</h3>
        <div class="inline-form">
          <FormField v-model="newContact.name" label="Name" type="text" data-testid="new-contact-name" placeholder="Name" grow />
          <FormField v-model="newContact.relationship" label="Relationship" type="text" data-testid="new-contact-relationship" placeholder="Relationship" grow />
          <FormField v-model="newContact.phone" label="Phone" type="text" data-testid="new-contact-phone" placeholder="Phone" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="newContact.alternatePhone" label="Alternate phone" type="text" data-testid="new-contact-alternatePhone" placeholder="Alternate phone" grow />
          <FormField v-model="newContact.email" label="Email" type="email" data-testid="new-contact-email" placeholder="Email" grow />
          <FormField v-model="newContact.priority" label="Priority" type="text" data-testid="new-contact-priority" placeholder="Priority" />
          <FormField v-model="newContact.isPrimary" label="Primary contact" type="checkbox" data-testid="new-contact-isPrimary" />
        </div>
        <Button data-testid="add-contact-submit" :disabled="isSavingContact" @click="onAddContact">Add Contact</Button>
      </section>

      <section class="profile-section">
        <div class="section-header">
          <h2>Medical / Welfare Info</h2>
          <Button v-if="!isEditingMedicalInfo" data-testid="edit-medical-info" @click="startEditMedicalInfo">Edit</Button>
        </div>
        <p v-if="medicalInfoErrorMessage" class="error" role="alert">{{ medicalInfoErrorMessage }}</p>

        <template v-if="!isEditingMedicalInfo">
          <p v-if="!profile.medicalInfo">No medical information on file.</p>
          <dl v-else class="detail-grid">
            <dt>Blood group</dt><dd>{{ profile.medicalInfo.bloodGroup ?? '—' }}</dd>
            <dt>Allergies</dt><dd>{{ profile.medicalInfo.allergies ?? '—' }}</dd>
            <dt>Medical conditions</dt><dd>{{ profile.medicalInfo.medicalConditions ?? '—' }}</dd>
            <dt>Special educational needs</dt><dd>{{ profile.medicalInfo.specialEducationalNeeds ?? '—' }}</dd>
            <dt>Medication notes</dt><dd>{{ profile.medicalInfo.medicationNotes ?? '—' }}</dd>
            <dt>Emergency medical notes</dt><dd>{{ profile.medicalInfo.emergencyMedicalNotes ?? '—' }}</dd>
          </dl>
        </template>
        <div v-else class="edit-form">
          <FormField v-model="medicalInfoForm.bloodGroup" label="Blood group" type="select" data-testid="medical-bloodGroup" placeholder="Blood group" :options="BLOOD_GROUP_OPTIONS" />
          <FormField v-model="medicalInfoForm.allergies" label="Allergies" type="textarea" data-testid="medical-allergies" placeholder="Allergies" />
          <FormField v-model="medicalInfoForm.medicalConditions" label="Medical conditions" type="textarea" data-testid="medical-medicalConditions" placeholder="Medical conditions" />
          <FormField v-model="medicalInfoForm.specialEducationalNeeds" label="Special educational needs" type="textarea" data-testid="medical-specialEducationalNeeds" placeholder="Special educational needs" />
          <FormField v-model="medicalInfoForm.medicationNotes" label="Medication notes" type="textarea" data-testid="medical-medicationNotes" placeholder="Medication notes" />
          <FormField v-model="medicalInfoForm.emergencyMedicalNotes" label="Emergency medical notes" type="textarea" data-testid="medical-emergencyMedicalNotes" placeholder="Emergency medical notes" />
          <div class="form-actions">
            <Button data-testid="medical-save" :disabled="isSavingMedicalInfo" @click="onSaveMedicalInfo">Save</Button>
            <Button variant="secondary" data-testid="medical-cancel" @click="cancelEditMedicalInfo">Cancel</Button>
          </div>
        </div>
      </section>

      <section class="profile-section">
        <h2>Documents</h2>
        <p v-if="documentsErrorMessage" class="error" role="alert">{{ documentsErrorMessage }}</p>

        <p v-if="!profile.documents.length">No documents on file.</p>
        <EntityTable
          v-else
          :items="profile.documents"
          :columns="[
            { key: 'documentType', label: 'Type' },
            { key: 'file', label: 'File' },
            { key: 'verificationStatus', label: 'Status' },
            { key: 'expiryDate', label: 'Expiry' },
          ]"
          row-key="id"
          :editing-id="null"
        >
          <template #cell-file="{ item }">{{ item.file.originalName }}</template>
          <template #cell-verificationStatus="{ item }">
            <StatusPill :tone="documentTone(item.verificationStatus)" :label="item.verificationStatus" />
          </template>
          <template #cell-expiryDate="{ item }">{{ item.expiryDate ? item.expiryDate.slice(0, 10) : '—' }}</template>
          <template #actions="{ item }">
            <template v-if="item.verificationStatus === 'PENDING'">
              <Button :data-testid="`verify-document-${item.id}`" @click="onVerifyDocument(item.id, true)">Verify</Button>
              <Button variant="secondary" :data-testid="`reject-document-${item.id}`" @click="onVerifyDocument(item.id, false)">Reject</Button>
            </template>
          </template>
        </EntityTable>

        <h3>Add document</h3>
        <div class="inline-form">
          <FormField v-model="newDocument.documentType" label="Document type" type="select" data-testid="new-document-type" placeholder="Document type" :options="DOCUMENT_TYPE_OPTIONS" />
          <FormField v-model="newDocument.expiryDate" label="Expiry date" type="date" data-testid="new-document-expiryDate" />
        </div>
        <div class="form-field">
          <label class="sr-only" for="new-document-file-input">File</label>
          <input id="new-document-file-input" type="file" data-testid="new-document-file" @change="onNewDocumentFileChange" />
        </div>
        <FormField v-model="newDocument.notes" label="Notes" type="textarea" data-testid="new-document-notes" placeholder="Notes" />
        <Button data-testid="add-document-submit" :disabled="isSavingDocument" @click="onAddDocument">Add Document</Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.student-profile {
  max-width: 900px;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.photo-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}
.photo-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
}
.photo-avatar:disabled {
  cursor: default;
  opacity: 0.7;
}
.photo-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-hint {
  font-size: var(--font-size-xs);
  color: var(--color-muted, #64748b);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.profile-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.detail-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-1) var(--space-3);
}
.detail-grid dt {
  font-weight: 600;
  color: var(--color-muted, #64748b);
}
.detail-grid dd {
  margin: 0;
}
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.form-actions {
  display: flex;
  gap: var(--space-2);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>