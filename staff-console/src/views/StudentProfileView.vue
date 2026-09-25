<!-- staff-console/src/views/StudentProfileView.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type AddressInput,
  type AddressDetail,
  type StudentProfileDetail,
  type PromotionHistoryRow,
  type PromotionDecision,
} from '../lib/api';
import { GENDER_OPTIONS, STUDENT_STATUS_OPTIONS, BLOOD_GROUP_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '../lib/student-profile.constants';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppIcon from '../components/AppIcon.vue';
import EntityTable from '../components/EntityTable.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import StatusPill from '../components/StatusPill.vue';
import Tabs from '../components/AppTabs.vue';
import AppModal from '../components/AppModal.vue';
import ProfileIdentityCard from '../components/ProfileIdentityCard.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { initialsFromName } from '../lib/format';
import { useToast } from '../lib/useToast';

const PROFILE_TABS = [
  { id: 'profile', label: 'Personal Info', icon: 'user-circle' as const },
  { id: 'academic', label: 'Academic Record', icon: 'chalkboard' as const },
  { id: 'contacts', label: 'Family & Contacts', icon: 'users' as const },
  { id: 'medical', label: 'Medical & Welfare', icon: 'leaf' as const },
  { id: 'documents', label: 'Documents', icon: 'file-text' as const },
];
const activeTab = ref('profile');

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();
const route = useRoute();
const studentId = route.params.id as string;

const profile = ref<StudentProfileDetail | null>(null);
const pageErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  pageErrorMessage.value = null;
  try {
    profile.value = await api.getStudentProfile(auth.accessToken, studentId);
  } catch (err) {
    pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this student.';
  }
}
load();

// --- Header presentation helpers (derived only from data already on the profile) --------------
const activeEnrollment = computed(() => profile.value?.enrollments[0] ?? null);

const studentCampusLabel = computed(() => {
  const campus = activeEnrollment.value?.section.class.campus;
  if (!campus) return null;
  return campus.code ? `${campus.code} - ${campus.name}` : campus.name;
});

const headerClassSection = computed(() => {
  const enrollment = activeEnrollment.value;
  return enrollment ? `${enrollment.section.class.name} · ${enrollment.section.name}` : null;
});

const STUDENT_STATUS_LABELS: Record<StudentProfileDetail['status'], string> = {
  ACTIVE: 'Active',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn',
  GRADUATED: 'Graduated',
  // BL-61: retired; only unmigrated rows still carry it (they are on the M7 review list)
  LEFT: 'Left (needs review)',
};
function studentStatusLabel(status: StudentProfileDetail['status']): string {
  return STUDENT_STATUS_LABELS[status];
}
function studentStatusTone(status: StudentProfileDetail['status']): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'GRADUATED') return 'info';
  if (status === 'WITHDRAWN') return 'critical';
  return 'neutral';
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}
function yearsSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const monthDiff = now.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) years--;
  return years;
}

const ageLabel = computed(() => {
  const dob = profile.value?.dateOfBirth;
  if (!dob) return null;
  const years = yearsSince(dob);
  return Number.isFinite(years) && years >= 0 ? `${years} yrs` : null;
});

const tenureLabel = computed(() => {
  const admission = profile.value?.admissionDate;
  if (!admission) return null;
  const years = Math.max(0, yearsSince(admission)) + 1;
  return `${years}${ordinalSuffix(years)} year enrolled`;
});

const contactsLabel = computed(() => {
  const count = profile.value?.emergencyContacts.length ?? 0;
  return `${count} contact${count === 1 ? '' : 's'} on file`;
});

const documentsLabel = computed(() => {
  const docs = profile.value?.documents ?? [];
  const verified = docs.filter((d) => d.verificationStatus === 'VERIFIED').length;
  return `${verified}/${docs.length} documents verified`;
});

function formatAddress(address: AddressDetail | null): string {
  if (!address) return '—';
  const firstLine = [address.line1, address.line2, address.area].filter(Boolean).join(', ');
  const cityLine = [address.city, address.province].filter(Boolean).join(', ');
  const secondLine = [cityLine, address.postalCode].filter(Boolean).join(' · ');
  return [firstLine, secondLine].filter(Boolean).join('\n') || '—';
}

function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

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

function onHeaderEditProfile() {
  activeTab.value = 'profile';
  startEditProfile();
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
      // BL-61: LEFT can no longer be written; an unmigrated LEFT row keeps it until someone picks a final status
      status: profileForm.status === 'LEFT' ? undefined : (profileForm.status as Exclude<StudentProfileDetail['status'], 'LEFT'>),
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
    toast.success('Profile updated.');
  } catch (err) {
    profileErrorMessage.value = err instanceof Error ? err.message : 'Could not save this profile.';
  } finally {
    isSavingProfile.value = false;
  }
}

// --- Profile photo (identity card avatar) ----------------------------------------------------
const photoPreviewUrl = ref<string | null>(null);
const photoErrorMessage = ref<string | null>(null);
const isSavingPhoto = ref(false);

// The locally-chosen file preview (set only while this session has picked a new file) takes
// precedence; otherwise fall back to the persisted photo already on the profile, so it survives
// a page refresh instead of only ever showing during an in-session upload.
const displayPhotoUrl = computed(() => {
  if (photoPreviewUrl.value) return photoPreviewUrl.value;
  const fileId = profile.value?.profilePhotoFileId;
  return fileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, fileId) : null;
});

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
    toast.success('Photo updated.');
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
    toast.success('Enrollment updated.');
  } catch (err) {
    enrollmentErrorMessage.value = err instanceof Error ? err.message : 'Could not save the enrollment.';
  } finally {
    isSavingEnrollment.value = false;
  }
}

// --- Academic History section (read-only promotion decisions) --------------------------------
const promotionHistory = ref<PromotionHistoryRow[]>([]);
const academicHistoryErrorMessage = ref<string | null>(null);

async function loadAcademicHistory() {
  if (!auth.accessToken) return;
  try {
    promotionHistory.value = await api.getPromotionHistory(auth.accessToken, studentId);
  } catch (err) {
    academicHistoryErrorMessage.value = err instanceof Error ? err.message : 'Could not load academic history.';
  }
}
loadAcademicHistory();

const DECISION_LABELS: Record<PromotionDecision, string> = {
  PROMOTED: 'Promoted',
  PROMOTED_WITH_CONDITIONS: 'Promoted with conditions',
  RETAINED: 'Retained',
  TRANSFERRED: 'Transferred',
  GRADUATED: 'Graduated',
  WITHDRAWN: 'Withdrawn',
};

function decisionLabel(decision: PromotionDecision): string {
  return DECISION_LABELS[decision];
}

function decisionTone(decision: PromotionDecision): 'success' | 'warning' | 'critical' | 'info' {
  if (decision === 'PROMOTED' || decision === 'GRADUATED') return 'success';
  if (decision === 'RETAINED') return 'warning';
  if (decision === 'WITHDRAWN') return 'critical';
  return 'info';
}

function promotionLegLabel(leg: PromotionHistoryRow['from'] | PromotionHistoryRow['to']): string {
  return leg ? `${leg.className} · ${leg.sectionName} · ${leg.sessionLabel}` : '—';
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
    toast.success('Previous school updated.');
  } catch (err) {
    previousSchoolErrorMessage.value = err instanceof Error ? err.message : 'Could not save the previous school.';
  } finally {
    isSavingPreviousSchool.value = false;
  }
}

// --- Emergency Contacts section -----------------------------------------------------------------
const contactsErrorMessage = ref<string | null>(null);
const isSavingContact = ref(false);
const showAddContactModal = ref(false);

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
    showAddContactModal.value = false;
    await load();
    toast.success('Emergency contact added.');
  } catch (err) {
    contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this contact.';
  } finally {
    isSavingContact.value = false;
  }
}

function openAddContactModal() {
  contactsErrorMessage.value = null;
  showAddContactModal.value = true;
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
    toast.success('Emergency contact updated.');
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
    toast.success('Emergency contact deleted.');
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
    toast.success('Medical info updated.');
  } catch (err) {
    medicalInfoErrorMessage.value = err instanceof Error ? err.message : 'Could not save medical info.';
  } finally {
    isSavingMedicalInfo.value = false;
  }
}

// --- Documents section ---------------------------------------------------------------------
const documentsErrorMessage = ref<string | null>(null);
const isSavingDocument = ref(false);
const showAddDocumentModal = ref(false);
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
    showAddDocumentModal.value = false;
    await load();
    toast.success('Document added.');
  } catch (err) {
    documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this document.';
  } finally {
    isSavingDocument.value = false;
  }
}

function openAddDocumentModal() {
  documentsErrorMessage.value = null;
  showAddDocumentModal.value = true;
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
    toast.success(verified ? 'Document verified.' : 'Document verification cleared.');
  } catch (err) {
    documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not update this document.';
  }
}
</script>

<template>
  <div class="student-profile">
    <ProfileIdentityCard
      v-if="profile"
      :name="profile.name"
      :initials="initialsFromName(profile.name)"
      :photo-url="displayPhotoUrl"
      photo-label="Student photo"
      :school-name="activeEnrollment?.section.class.campus.school.name ?? null"
      :campus-label="studentCampusLabel"
      :is-saving-photo="isSavingPhoto"
      :id-chip="profile.grNumber"
      :subtitle-tag="headerClassSection"
      :secondary-tag="activeEnrollment?.rollNumber ? `Roll No. ${activeEnrollment.rollNumber}` : null"
      :status-label="studentStatusLabel(profile.status)"
      :status-tone="studentStatusTone(profile.status)"
      :age-label="ageLabel"
      :tenure-label="tenureLabel"
      :contacts-label="contactsLabel"
      :documents-label="documentsLabel"
      :compact="isEditingProfile"
      @edit-profile="onHeaderEditProfile"
      @photo-file-change="onPhotoFileSelected"
    />
    <div v-else-if="!pageErrorMessage" class="identity-skeleton" data-testid="student-profile-skeleton">
      <span class="skeleton-avatar" />
      <div class="skeleton-lines">
        <span class="skeleton-line" style="width: 40%; height: 1.4rem" />
        <span class="skeleton-line" style="width: 60%" />
      </div>
    </div>

    <p v-if="photoErrorMessage" class="error" role="alert" data-testid="profile-photo-error">{{ photoErrorMessage }}</p>
    <ErrorRetry v-if="pageErrorMessage" :message="pageErrorMessage" @retry="load" />

    <div v-if="profile" class="sections">
      <Tabs :tabs="PROFILE_TABS" v-model="activeTab" variant="pill">
        <template #tab-profile>
          <ProfileSectionCard icon="user-circle" title="Personal Info">
            <template #actions>
              <Button v-if="!isEditingProfile" variant="secondary" data-testid="edit-profile" @click="startEditProfile">
                <AppIcon name="edit" :size="13" /> Edit
              </Button>
            </template>
            <p v-if="profileErrorMessage" data-testid="profile-error" class="error" role="alert">{{ profileErrorMessage }}</p>

            <template v-if="!isEditingProfile">
              <div class="field-group">
                <div class="group-title">Identity</div>
                <div class="field-grid">
                  <div class="field"><span class="field-label">GR Number</span><span class="field-value mono">{{ profile.grNumber }}</span></div>
                  <div class="field"><span class="field-label">Full name</span><span class="field-value">{{ profile.name }}</span></div>
                  <div class="field"><span class="field-label">Preferred name</span><span class="field-value">{{ profile.preferredName ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Gender</span><span class="field-value">{{ profile.gender ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Date of birth</span><span class="field-value mono">{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</span></div>
                  <div class="field"><span class="field-label">Nationality</span><span class="field-value">{{ profile.nationality ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Religion</span><span class="field-value">{{ profile.religion ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">B-Form number</span><span class="field-value mono">{{ profile.bFormNumber ?? '—' }}</span></div>
                </div>
              </div>
              <div class="field-group">
                <div class="group-title">Status &amp; contact</div>
                <div class="field-grid">
                  <div class="field"><span class="field-label">Status</span><span class="field-value">{{ profile.status }}</span></div>
                  <div class="field"><span class="field-label">Admission date</span><span class="field-value mono">{{ profile.admissionDate ? profile.admissionDate.slice(0, 10) : '—' }}</span></div>
                  <div class="field"><span class="field-label">Mobile</span><span class="field-value mono">{{ profile.studentMobile ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Email</span><span class="field-value">{{ profile.studentEmail ?? '—' }}</span></div>
                </div>
              </div>
              <div class="field-group two-col">
                <div>
                  <div class="group-title">Current address</div>
                  <p class="field-value address-block">{{ formatAddress(profile.currentAddress) }}</p>
                </div>
                <div>
                  <div class="group-title">Permanent address</div>
                  <p class="field-value address-block">{{ formatAddress(profile.permanentAddress) }}</p>
                </div>
              </div>
            </template>

            <div v-else class="edit-form">
              <div class="field-group">
                <div class="group-title">Identity</div>
                <div class="field-grid-edit">
                  <FormField v-model="profileForm.firstName" label="First name" type="text" data-testid="profile-firstName" placeholder="First name" grow />
                  <FormField v-model="profileForm.middleName" label="Middle name" type="text" data-testid="profile-middleName" placeholder="Middle name" grow />
                  <FormField v-model="profileForm.lastName" label="Last name" type="text" data-testid="profile-lastName" placeholder="Last name" grow />
                  <FormField v-model="profileForm.preferredName" label="Preferred name" type="text" data-testid="profile-preferredName" placeholder="Preferred name" grow />
                  <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
                  <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" mono />
                  <FormField v-model="profileForm.placeOfBirth" label="Place of birth" type="text" data-testid="profile-placeOfBirth" placeholder="Place of birth" grow />
                  <FormField v-model="profileForm.nationality" label="Nationality" type="text" data-testid="profile-nationality" placeholder="Nationality" grow />
                  <FormField v-model="profileForm.religion" label="Religion" type="text" data-testid="profile-religion" placeholder="Religion" grow />
                  <FormField v-model="profileForm.bFormNumber" label="B-Form number" type="text" data-testid="profile-bFormNumber" placeholder="B-Form number" mono grow />
                </div>
              </div>

              <div class="field-group">
                <div class="group-title">Status &amp; admission</div>
                <div class="field-grid-edit">
                  <FormField v-model="profileForm.status" label="Status" type="select" data-testid="profile-status" :options="STUDENT_STATUS_OPTIONS" />
                  <FormField v-model="profileForm.admissionDate" label="Admission date" type="date" data-testid="profile-admissionDate" mono />
                  <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" mono />
                </div>
                <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />
              </div>

              <div class="field-group">
                <div class="group-title">Contact</div>
                <div class="field-grid-edit">
                  <FormField v-model="profileForm.studentMobile" label="Mobile" type="text" data-testid="profile-studentMobile" placeholder="Mobile" mono grow />
                  <FormField v-model="profileForm.studentEmail" label="Email" type="email" data-testid="profile-studentEmail" placeholder="Email" grow />
                </div>
              </div>

              <div class="field-group">
                <div class="group-title">Current address</div>
                <div class="field-grid-edit">
                  <FormField v-model="currentAddressForm.line1" label="Line 1" type="text" data-testid="profile-currentAddress-line1" placeholder="Line 1" grow />
                  <FormField v-model="currentAddressForm.line2" label="Line 2" type="text" data-testid="profile-currentAddress-line2" placeholder="Line 2" grow />
                  <FormField v-model="currentAddressForm.area" label="Area" type="text" data-testid="profile-currentAddress-area" placeholder="Area" grow />
                  <FormField v-model="currentAddressForm.city" label="City" type="text" data-testid="profile-currentAddress-city" placeholder="City" grow />
                  <FormField v-model="currentAddressForm.province" label="Province" type="text" data-testid="profile-currentAddress-province" placeholder="Province" grow />
                  <FormField v-model="currentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-currentAddress-postalCode" placeholder="Postal code" mono grow />
                </div>
              </div>

              <div class="field-group">
                <div class="group-title">Permanent address</div>
                <div class="field-grid-edit">
                  <FormField v-model="permanentAddressForm.line1" label="Line 1" type="text" data-testid="profile-permanentAddress-line1" placeholder="Line 1" grow />
                  <FormField v-model="permanentAddressForm.line2" label="Line 2" type="text" data-testid="profile-permanentAddress-line2" placeholder="Line 2" grow />
                  <FormField v-model="permanentAddressForm.area" label="Area" type="text" data-testid="profile-permanentAddress-area" placeholder="Area" grow />
                  <FormField v-model="permanentAddressForm.city" label="City" type="text" data-testid="profile-permanentAddress-city" placeholder="City" grow />
                  <FormField v-model="permanentAddressForm.province" label="Province" type="text" data-testid="profile-permanentAddress-province" placeholder="Province" grow />
                  <FormField v-model="permanentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-permanentAddress-postalCode" placeholder="Postal code" mono grow />
                </div>
              </div>

              <div class="form-actions">
                <Button data-testid="profile-save" :disabled="isSavingProfile" @click="onSaveProfile">
                  <AppIcon name="check" :size="14" /> Save changes
                </Button>
                <Button variant="secondary" data-testid="profile-cancel" @click="cancelEditProfile">Cancel</Button>
              </div>
            </div>
          </ProfileSectionCard>
        </template>

        <template #tab-academic>
          <ProfileSectionCard icon="chalkboard" title="Current Enrollment">
            <template #actions>
              <Button v-if="!isEditingEnrollment && activeEnrollment" variant="secondary" data-testid="edit-enrollment" @click="startEditEnrollment">
                <AppIcon name="edit" :size="13" /> Edit
              </Button>
            </template>
            <p v-if="enrollmentErrorMessage" class="error" role="alert">{{ enrollmentErrorMessage }}</p>

            <EmptyState v-if="!activeEnrollment" icon="chalkboard" title="No active enrollment." />
            <template v-else>
              <div v-if="!isEditingEnrollment" class="field-grid">
                <div class="field"><span class="field-label">Class</span><span class="field-value">{{ headerClassSection }}</span></div>
                <div class="field"><span class="field-label">Campus</span><span class="field-value">{{ activeEnrollment.section.class.campus.name }}</span></div>
                <div class="field"><span class="field-label">Roll number</span><span class="field-value mono">{{ activeEnrollment.rollNumber ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Remarks</span><span class="field-value">{{ activeEnrollment.remarks ?? '—' }}</span></div>
              </div>
              <div v-else class="edit-form">
                <div class="field-grid-edit">
                  <FormField v-model="enrollmentForm.rollNumber" label="Roll number" type="text" data-testid="enrollment-rollNumber" placeholder="Roll number" mono grow />
                </div>
                <FormField v-model="enrollmentForm.remarks" label="Remarks" type="textarea" data-testid="enrollment-remarks" placeholder="Remarks" />
                <div class="form-actions">
                  <Button data-testid="enrollment-save" :disabled="isSavingEnrollment" @click="onSaveEnrollment">
                    <AppIcon name="check" :size="14" /> Save
                  </Button>
                  <Button variant="secondary" data-testid="enrollment-cancel" @click="cancelEditEnrollment">Cancel</Button>
                </div>
              </div>
            </template>
          </ProfileSectionCard>

          <ProfileSectionCard icon="notebook" title="Academic History">
            <p v-if="academicHistoryErrorMessage" class="error" role="alert" data-testid="academic-history-error">{{ academicHistoryErrorMessage }}</p>
            <EmptyState v-if="!promotionHistory.length" icon="notebook" title="No academic history on file." />
            <div v-else class="academic-history-table">
            <EntityTable
              :items="promotionHistory"
              :columns="[
                { key: 'summary', label: 'Promotion' },
                { key: 'decision', label: 'Decision' },
                { key: 'decidedAt', label: 'Date' },
                { key: 'remarks', label: 'Remarks' },
              ]"
              row-key="id"
              :editing-id="null"
            >
              <template #cell-summary="{ item }">{{ promotionLegLabel(item.from) }} → {{ promotionLegLabel(item.to) }}</template>
              <template #cell-decision="{ item }">
                <StatusPill :tone="decisionTone(item.decision)" :label="decisionLabel(item.decision)" />
              </template>
              <template #cell-decidedAt="{ item }"><span class="mono">{{ item.decidedAt.slice(0, 10) }}</span></template>
              <template #cell-remarks="{ item }">{{ item.remarks ?? '—' }}</template>
            </EntityTable>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard icon="home" title="Previous School">
            <template #actions>
              <Button v-if="!isEditingPreviousSchool" variant="secondary" data-testid="edit-previous-school" @click="startEditPreviousSchool">
                <AppIcon name="edit" :size="13" /> Edit
              </Button>
            </template>
            <p v-if="previousSchoolErrorMessage" class="error" role="alert">{{ previousSchoolErrorMessage }}</p>

            <template v-if="!isEditingPreviousSchool">
              <EmptyState v-if="!profile.previousSchool" icon="home" title="No previous school on file." />
              <div v-else class="field-grid">
                <div class="field"><span class="field-label">School</span><span class="field-value">{{ profile.previousSchool.schoolName }}</span></div>
                <div class="field"><span class="field-label">Last class attended</span><span class="field-value">{{ profile.previousSchool.lastClassAttended ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Contact</span><span class="field-value mono">{{ profile.previousSchool.contactNumber ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Email</span><span class="field-value">{{ profile.previousSchool.email ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Reason for leaving</span><span class="field-value">{{ profile.previousSchool.reasonForLeaving ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Address</span><span class="field-value address-block">{{ formatAddress(profile.previousSchool.address) }}</span></div>
              </div>
            </template>
            <div v-else class="edit-form">
              <div class="field-grid-edit">
                <FormField v-model="previousSchoolForm.schoolName" label="School name" type="text" data-testid="previous-school-schoolName" placeholder="School name" grow />
                <FormField v-model="previousSchoolForm.lastClassAttended" label="Last class attended" type="text" data-testid="previous-school-lastClassAttended" placeholder="Last class attended" grow />
                <FormField v-model="previousSchoolForm.contactNumber" label="Contact number" type="text" data-testid="previous-school-contactNumber" placeholder="Contact number" mono grow />
                <FormField v-model="previousSchoolForm.email" label="Email" type="email" data-testid="previous-school-email" placeholder="Email" grow />
                <FormField v-model="previousSchoolForm.admissionDate" label="Admission date" type="date" data-testid="previous-school-admissionDate" mono />
                <FormField v-model="previousSchoolForm.leavingDate" label="Leaving date" type="date" data-testid="previous-school-leavingDate" mono />
                <FormField v-model="previousSchoolForm.leavingCertificateNumber" label="Leaving certificate #" type="text" data-testid="previous-school-leavingCertificateNumber" placeholder="Leaving certificate #" mono grow />
                <FormField v-model="previousSchoolForm.leavingCertificateDate" label="Leaving certificate date" type="date" data-testid="previous-school-leavingCertificateDate" mono />
              </div>
              <FormField v-model="previousSchoolForm.reasonForLeaving" label="Reason for leaving" type="textarea" data-testid="previous-school-reasonForLeaving" placeholder="Reason for leaving" />
              <FormField v-model="previousSchoolForm.academicRemarks" label="Academic remarks" type="textarea" data-testid="previous-school-academicRemarks" placeholder="Academic remarks" />

              <div class="group-title">Address</div>
              <div class="field-grid-edit">
                <FormField v-model="previousSchoolAddressForm.line1" label="Line 1" type="text" data-testid="previous-school-address-line1" placeholder="Line 1" grow />
                <FormField v-model="previousSchoolAddressForm.city" label="City" type="text" data-testid="previous-school-address-city" placeholder="City" grow />
              </div>

              <div class="form-actions">
                <Button data-testid="previous-school-save" :disabled="isSavingPreviousSchool" @click="onSavePreviousSchool">
                  <AppIcon name="check" :size="14" /> Save
                </Button>
                <Button variant="secondary" data-testid="previous-school-cancel" @click="cancelEditPreviousSchool">Cancel</Button>
              </div>
            </div>
          </ProfileSectionCard>
        </template>

        <template #tab-contacts>
          <ProfileSectionCard icon="users" title="Emergency Contacts">
            <template #actions>
              <Button data-testid="open-add-contact" @click="openAddContactModal">
                <AppIcon name="plus" :size="14" /> Add New
              </Button>
            </template>
            <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>

            <EmptyState
              v-if="!profile.emergencyContacts.length"
              icon="users"
              title="No emergency contacts yet."
              message="Add a parent or guardian so the school knows who to call first."
              cta-label="+ Add New"
              @cta="openAddContactModal"
            />
            <div v-else class="contact-grid">
              <div v-for="contact in profile.emergencyContacts" :key="contact.id" class="contact-card">
                <template v-if="editingContactId === contact.id">
                  <div class="contact-edit-grid">
                    <label class="contact-edit-field">
                      <span class="field-label">Name</span>
                      <input :data-testid="`edit-contact-name-${contact.id}`" v-model="editContactForm.name" type="text" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">Relationship</span>
                      <input :data-testid="`edit-contact-relationship-${contact.id}`" v-model="editContactForm.relationship" type="text" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">Phone</span>
                      <input :data-testid="`edit-contact-phone-${contact.id}`" v-model="editContactForm.phone" type="text" class="mono" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">Priority</span>
                      <input :data-testid="`edit-contact-priority-${contact.id}`" v-model="editContactForm.priority" type="text" class="mono" />
                    </label>
                    <label class="contact-edit-checkbox">
                      <input :data-testid="`edit-contact-isPrimary-${contact.id}`" v-model="editContactForm.isPrimary" type="checkbox" />
                      Primary contact
                    </label>
                  </div>
                  <div class="contact-card-actions">
                    <Button :data-testid="`save-contact-${contact.id}`" @click="onSaveContact(contact.id)">Save</Button>
                    <Button variant="secondary" @click="cancelEditContact">Cancel</Button>
                  </div>
                </template>
                <template v-else>
                  <div class="contact-card-top">
                    <span class="contact-name">{{ contact.name }}</span>
                    <span v-if="contact.isPrimary" class="contact-primary-badge">Primary</span>
                  </div>
                  <div class="contact-relationship">{{ contact.relationship }}</div>
                  <div class="contact-phone mono">{{ contact.phone }}</div>
                  <div class="contact-card-actions">
                    <Button :data-testid="`edit-contact-${contact.id}`" variant="secondary" @click="startEditContact(contact)">
                      <AppIcon name="edit" :size="12" /> Edit
                    </Button>
                    <Button variant="secondary" :data-testid="`delete-contact-${contact.id}`" @click="onDeleteContact(contact.id)">Delete</Button>
                  </div>
                </template>
              </div>
            </div>
          </ProfileSectionCard>

          <AppModal
            v-model="showAddContactModal"
            title="Add Emergency Contact"
            subtitle="They'll be contacted first if we can't reach a parent."
            icon="users"
          >
            <div class="add-form">
              <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>
              <div class="form-grid">
                <FormField v-model="newContact.name" label="Name" type="text" data-testid="new-contact-name" placeholder="Full name" grow />
                <FormField v-model="newContact.relationship" label="Relationship" type="text" data-testid="new-contact-relationship" placeholder="e.g. Mother, Uncle" grow />
                <FormField v-model="newContact.phone" label="Phone" type="text" data-testid="new-contact-phone" placeholder="03XX XXXXXXX" mono grow />
                <FormField v-model="newContact.alternatePhone" label="Alternate phone" type="text" data-testid="new-contact-alternatePhone" placeholder="Optional" mono grow />
                <FormField v-model="newContact.email" label="Email" type="email" data-testid="new-contact-email" placeholder="Optional" grow />
              </div>

              <div class="priority-row">
                <div>
                  <span class="field-label">Contact priority</span>
                  <p class="field-hint">Who we call first, in order</p>
                </div>
                <div class="priority-pills">
                  <button
                    v-for="n in 4"
                    :key="n"
                    type="button"
                    class="priority-pill"
                    :class="{ active: Number(newContact.priority) === n }"
                    :data-testid="`new-contact-priority-${n}`"
                    @click="newContact.priority = String(n)"
                  >
                    {{ n }}
                  </button>
                </div>
              </div>

              <FormField
                v-model="newContact.isPrimary"
                label="Set as primary contact"
                hint="Shown first across the student's record"
                type="checkbox"
                data-testid="new-contact-isPrimary"
              />
              <div class="form-actions">
                <Button data-testid="add-contact-submit" :disabled="isSavingContact" @click="onAddContact">
                  <AppIcon name="plus" :size="14" /> Add Contact
                </Button>
              </div>
            </div>
          </AppModal>
        </template>

        <template #tab-medical>
          <ProfileSectionCard icon="leaf" title="Medical &amp; Welfare">
            <template #actions>
              <Button v-if="!isEditingMedicalInfo" variant="secondary" data-testid="edit-medical-info" @click="startEditMedicalInfo">
                <AppIcon name="edit" :size="13" /> Edit
              </Button>
            </template>
            <p v-if="medicalInfoErrorMessage" class="error" role="alert">{{ medicalInfoErrorMessage }}</p>

            <template v-if="!isEditingMedicalInfo">
              <EmptyState v-if="!profile.medicalInfo" icon="leaf" title="No medical information on file." />
              <div v-else class="field-grid">
                <div class="field"><span class="field-label">Blood group</span><span class="field-value mono">{{ profile.medicalInfo.bloodGroup ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Allergies</span><span class="field-value">{{ profile.medicalInfo.allergies ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Medical conditions</span><span class="field-value">{{ profile.medicalInfo.medicalConditions ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Special educational needs</span><span class="field-value">{{ profile.medicalInfo.specialEducationalNeeds ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Medication notes</span><span class="field-value">{{ profile.medicalInfo.medicationNotes ?? '—' }}</span></div>
                <div class="field"><span class="field-label">Emergency medical notes</span><span class="field-value">{{ profile.medicalInfo.emergencyMedicalNotes ?? '—' }}</span></div>
              </div>
            </template>
            <div v-else class="edit-form">
              <div class="field-grid-edit">
                <FormField v-model="medicalInfoForm.bloodGroup" label="Blood group" type="select" data-testid="medical-bloodGroup" placeholder="Blood group" :options="BLOOD_GROUP_OPTIONS" />
              </div>
              <FormField v-model="medicalInfoForm.allergies" label="Allergies" type="textarea" data-testid="medical-allergies" placeholder="Allergies" />
              <FormField v-model="medicalInfoForm.medicalConditions" label="Medical conditions" type="textarea" data-testid="medical-medicalConditions" placeholder="Medical conditions" />
              <FormField v-model="medicalInfoForm.specialEducationalNeeds" label="Special educational needs" type="textarea" data-testid="medical-specialEducationalNeeds" placeholder="Special educational needs" />
              <FormField v-model="medicalInfoForm.medicationNotes" label="Medication notes" type="textarea" data-testid="medical-medicationNotes" placeholder="Medication notes" />
              <FormField v-model="medicalInfoForm.emergencyMedicalNotes" label="Emergency medical notes" type="textarea" data-testid="medical-emergencyMedicalNotes" placeholder="Emergency medical notes" />
              <div class="form-actions">
                <Button data-testid="medical-save" :disabled="isSavingMedicalInfo" @click="onSaveMedicalInfo">
                  <AppIcon name="check" :size="14" /> Save
                </Button>
                <Button variant="secondary" data-testid="medical-cancel" @click="cancelEditMedicalInfo">Cancel</Button>
              </div>
            </div>
          </ProfileSectionCard>
        </template>

        <template #tab-documents>
          <ProfileSectionCard icon="file-text" title="Documents">
            <template #actions>
              <Button data-testid="open-add-document" @click="openAddDocumentModal">
                <AppIcon name="plus" :size="14" /> Add New
              </Button>
            </template>
            <p v-if="documentsErrorMessage" class="error" role="alert">{{ documentsErrorMessage }}</p>

            <EmptyState
              v-if="!profile.documents.length"
              icon="file-text"
              title="No documents on file."
              cta-label="+ Add New"
              @cta="openAddDocumentModal"
            />
            <div v-else class="document-grid">
              <div v-for="doc in profile.documents" :key="doc.id" class="document-card">
                <div class="document-card-top">
                  <span class="document-type">{{ documentTypeLabel(doc.documentType) }}</span>
                  <StatusPill :tone="documentTone(doc.verificationStatus)" :label="doc.verificationStatus" />
                </div>
                <div class="document-file mono">{{ doc.file.originalName }}</div>
                <div v-if="doc.expiryDate" class="document-expiry mono">Expires {{ doc.expiryDate.slice(0, 10) }}</div>
                <div v-if="doc.verificationStatus === 'PENDING'" class="document-card-actions">
                  <Button :data-testid="`verify-document-${doc.id}`" @click="onVerifyDocument(doc.id, true)">Verify</Button>
                  <Button variant="secondary" :data-testid="`reject-document-${doc.id}`" @click="onVerifyDocument(doc.id, false)">Reject</Button>
                </div>
              </div>
            </div>
          </ProfileSectionCard>

          <AppModal v-model="showAddDocumentModal" title="Add Document" icon="file-text">
            <div class="add-form">
              <p v-if="documentsErrorMessage" class="error" role="alert">{{ documentsErrorMessage }}</p>
              <div class="form-grid">
                <FormField v-model="newDocument.documentType" label="Document type" type="select" data-testid="new-document-type" placeholder="Document type" :options="DOCUMENT_TYPE_OPTIONS" />
                <FormField v-model="newDocument.expiryDate" label="Expiry date" type="date" data-testid="new-document-expiryDate" mono />
              </div>
              <div class="form-field">
                <label class="sr-only" for="new-document-file-input">File</label>
                <input id="new-document-file-input" type="file" data-testid="new-document-file" @change="onNewDocumentFileChange" />
              </div>
              <FormField v-model="newDocument.notes" label="Notes" type="textarea" data-testid="new-document-notes" placeholder="Notes" />
              <div class="form-actions">
                <Button data-testid="add-document-submit" :disabled="isSavingDocument" @click="onAddDocument">
                  <AppIcon name="plus" :size="14" /> Add Document
                </Button>
              </div>
            </div>
          </AppModal>
        </template>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
/* Everything genuinely shared with StaffProfileView.vue (field grids, contact/document cards,
   the identity skeleton, priority pills, forms, and their responsive breakpoints) now lives in
   src/assets/patterns.css — see rollout plan Section 4.1. Only what's specific to this page
   remains here. */
.student-profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.error {
  color: var(--color-destructive);
}
.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.sections :deep(.tab-panel) {
  gap: var(--space-4);
}

/* Academic History — a restyled, single-purpose skin for this one EntityTable instance only
   (via :deep(); EntityTable.vue itself is untouched, since it's shared by 20+ other screens). */
.academic-history-table :deep(th) {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
}
</style>
