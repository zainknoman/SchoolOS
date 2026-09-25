<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type AddressInput, type AddressDetail, type StaffProfileDetail, type TeachingAssignmentRow } from '../lib/api';
import { GENDER_OPTIONS, EMPLOYEE_TYPE_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '../lib/staff-profile.constants';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppIcon from '../components/AppIcon.vue';
import Tabs from '../components/AppTabs.vue';
import { initialsFromName } from '../lib/format';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import { useConfirm } from '../lib/useConfirm';
import StatusPill from '../components/StatusPill.vue';
import AppModal from '../components/AppModal.vue';
import ProfileIdentityCard from '../components/ProfileIdentityCard.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import { useToast } from '../lib/useToast';

const PROFILE_TABS = [
  { id: 'profile', label: 'Personal Info', icon: 'user-circle' as const },
  { id: 'contacts', label: 'Emergency Contacts', icon: 'users' as const },
  { id: 'experience', label: 'Experience', icon: 'briefcase' as const },
  { id: 'documents', label: 'Documents', icon: 'file-text' as const },
];
// BL-25: a teacher's profile also shows their teaching-assignment history.
const profileTabs = computed(() =>
  profile.value?.teacher
    ? [...PROFILE_TABS, { id: 'teaching', label: 'Teaching History', icon: 'clock' as const }]
    : PROFILE_TABS,
);
const activeTab = ref('profile');

const auth = useAuthStore();
const route = useRoute();
const { confirm } = useConfirm();
const toast = useToast();
const staffId = route.params.id as string;

const profile = ref<StaffProfileDetail | null>(null);
const pageErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  pageErrorMessage.value = null;
  try {
    profile.value = await api.getStaffProfile(auth.accessToken, staffId);
  } catch (err) {
    pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this staff member.';
  }
  if (profile.value?.teacher) await loadTeachingHistory(profile.value.teacher.id);
}

const teachingHistory = ref<TeachingAssignmentRow[]>([]);
const teachingHistoryError = ref<string | null>(null);
async function loadTeachingHistory(teacherId: string) {
  if (!auth.accessToken) return;
  teachingHistoryError.value = null;
  try {
    teachingHistory.value = await api.listTeachingAssignments(auth.accessToken, { teacherId });
  } catch (err) {
    teachingHistoryError.value = err instanceof Error ? err.message : 'Could not load the teaching history.';
  }
}
function assignmentLabel(row: TeachingAssignmentRow): string {
  const what = row.role === 'CLASS_TEACHER' ? 'Class teacher' : (row.subjectName ?? 'Subject');
  return `${what} · ${row.className} ${row.sectionName} · ${row.sessionLabel}`;
}
function assignmentPeriod(row: TeachingAssignmentRow): string {
  const from = row.startDateUnknown ? `before ${row.startDate.slice(0, 10)}` : row.startDate.slice(0, 10);
  return `${from} → ${row.endDate ? row.endDate.slice(0, 10) : 'current'}`;
}
load();

// --- Header presentation helpers (derived only from data already on the profile) --------------
function employeeTypeLabel(type: StaffProfileDetail['employeeType']): string {
  return EMPLOYEE_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

const EMPLOYMENT_STATUS_LABELS: Record<StaffProfileDetail['employmentStatus'], string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
  RESIGNED: 'Resigned',
};
function staffStatusLabel(status: StaffProfileDetail['employmentStatus']): string {
  return EMPLOYMENT_STATUS_LABELS[status];
}
function staffStatusTone(status: StaffProfileDetail['employmentStatus']): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ON_LEAVE') return 'warning';
  if (status === 'TERMINATED') return 'critical';
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
  const joining = profile.value?.joiningDate;
  if (!joining) return null;
  const years = Math.max(0, yearsSince(joining)) + 1;
  return `${years}${ordinalSuffix(years)} year at school`;
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

// --- Profile section (identity/contact/employment + addresses) ------------------------------
const isEditingProfile = ref(false);
const profileErrorMessage = ref<string | null>(null);
const isSavingProfile = ref(false);

const profileForm = reactive({
  firstName: '', middleName: '', lastName: '',
  gender: '', dateOfBirth: '', cnic: '', mobile: '', email: '',
  joiningDate: '', employmentStatus: 'ACTIVE', leavingDate: '', leavingReason: '',
});
const currentAddressForm = reactive(emptyAddress());
const permanentAddressForm = reactive(emptyAddress());

function startEditProfile() {
  if (!profile.value) return;
  const p = profile.value;
  profileForm.firstName = p.firstName ?? '';
  profileForm.middleName = p.middleName ?? '';
  profileForm.lastName = p.lastName ?? '';
  profileForm.gender = p.gender ?? '';
  profileForm.dateOfBirth = p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '';
  profileForm.cnic = p.cnic ?? '';
  profileForm.mobile = p.mobile ?? '';
  profileForm.email = p.email ?? '';
  profileForm.joiningDate = p.joiningDate ? p.joiningDate.slice(0, 10) : '';
  profileForm.employmentStatus = p.employmentStatus;
  profileForm.leavingDate = p.leavingDate ? p.leavingDate.slice(0, 10) : '';
  profileForm.leavingReason = p.leavingReason ?? '';
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
    await api.updateStaffProfile(auth.accessToken, staffId, {
      firstName: profileForm.firstName || undefined,
      middleName: profileForm.middleName || undefined,
      lastName: profileForm.lastName || undefined,
      gender: (profileForm.gender || undefined) as StaffProfileDetail['gender'] & string | undefined,
      dateOfBirth: profileForm.dateOfBirth || undefined,
      cnic: profileForm.cnic || undefined,
      mobile: profileForm.mobile || undefined,
      email: profileForm.email || undefined,
      joiningDate: profileForm.joiningDate || undefined,
      employmentStatus: profileForm.employmentStatus as StaffProfileDetail['employmentStatus'],
      leavingDate: profileForm.leavingDate || undefined,
      leavingReason: profileForm.leavingReason || undefined,
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
    await api.updateStaffProfile(auth.accessToken, staffId, { profilePhotoFileId: uploaded.id });
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

// --- Emergency Contacts section ----------------------------------------------------------------
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
    await api.createStaffEmergencyContact(auth.accessToken, staffId, {
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

function startEditContact(contact: StaffProfileDetail['emergencyContacts'][number]) {
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
    await api.updateStaffEmergencyContact(auth.accessToken, staffId, contactId, {
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
    await api.deleteStaffEmergencyContact(auth.accessToken, staffId, contactId);
    await load();
    toast.success('Emergency contact deleted.');
  } catch (err) {
    contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this contact.';
  }
}

// --- Experience section -------------------------------------------------------------------
const experienceErrorMessage = ref<string | null>(null);
const isSavingExperience = ref(false);
const showAddExperienceModal = ref(false);

const newExperience = reactive({ organization: '', role: '', fromDate: '', toDate: '', description: '' });
function resetNewExperience() {
  newExperience.organization = '';
  newExperience.role = '';
  newExperience.fromDate = '';
  newExperience.toDate = '';
  newExperience.description = '';
}

async function onAddExperience() {
  if (!auth.accessToken || !newExperience.organization.trim() || !newExperience.role.trim()) return;
  experienceErrorMessage.value = null;
  isSavingExperience.value = true;
  try {
    await api.createStaffExperience(auth.accessToken, staffId, {
      organization: newExperience.organization.trim(),
      role: newExperience.role.trim(),
      fromDate: newExperience.fromDate || undefined,
      toDate: newExperience.toDate || undefined,
      description: newExperience.description || undefined,
    });
    resetNewExperience();
    showAddExperienceModal.value = false;
    await load();
    toast.success('Experience entry added.');
  } catch (err) {
    experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not add this experience entry.';
  } finally {
    isSavingExperience.value = false;
  }
}

function openAddExperienceModal() {
  experienceErrorMessage.value = null;
  showAddExperienceModal.value = true;
}

const editingExperienceId = ref<string | null>(null);
const editExperienceForm = reactive({ organization: '', role: '', fromDate: '', toDate: '', description: '' });

function startEditExperience(entry: StaffProfileDetail['experience'][number]) {
  editingExperienceId.value = entry.id;
  editExperienceForm.organization = entry.organization;
  editExperienceForm.role = entry.role;
  editExperienceForm.fromDate = entry.fromDate ? entry.fromDate.slice(0, 10) : '';
  editExperienceForm.toDate = entry.toDate ? entry.toDate.slice(0, 10) : '';
  editExperienceForm.description = entry.description ?? '';
}

function cancelEditExperience() {
  editingExperienceId.value = null;
}

async function onSaveExperience(experienceId: string) {
  if (!auth.accessToken || !editExperienceForm.organization.trim() || !editExperienceForm.role.trim()) return;
  experienceErrorMessage.value = null;
  try {
    await api.updateStaffExperience(auth.accessToken, staffId, experienceId, {
      organization: editExperienceForm.organization.trim(),
      role: editExperienceForm.role.trim(),
      fromDate: editExperienceForm.fromDate || undefined,
      toDate: editExperienceForm.toDate || undefined,
      description: editExperienceForm.description || undefined,
    });
    editingExperienceId.value = null;
    await load();
    toast.success('Experience entry updated.');
  } catch (err) {
    experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not save this experience entry.';
  }
}

async function onDeleteExperience(experienceId: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this experience entry?', message: 'This cannot be undone.', danger: true }))) return;
  experienceErrorMessage.value = null;
  try {
    await api.deleteStaffExperience(auth.accessToken, staffId, experienceId);
    await load();
    toast.success('Experience entry deleted.');
  } catch (err) {
    experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this experience entry.';
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
    await api.addStaffDocument(auth.accessToken, staffId, {
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
    await api.verifyStaffDocument(auth.accessToken, staffId, documentId, verified);
    await load();
    toast.success(verified ? 'Document verified.' : 'Document verification cleared.');
  } catch (err) {
    documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not update this document.';
  }
}

// --- Login (teacher-type staff only) ---------------------------------------------------------
const loginErrorMessage = ref<string | null>(null);
const isSavingLogin = ref(false);
const newLoginPassword = ref('');

async function onResetLoginPassword() {
  const teacherId = profile.value?.teacher?.id;
  if (!auth.accessToken || !teacherId || !newLoginPassword.value) return;
  loginErrorMessage.value = null;
  isSavingLogin.value = true;
  try {
    await api.updateTeacher(auth.accessToken, teacherId, { password: newLoginPassword.value });
    newLoginPassword.value = '';
    toast.success('Login password reset.');
  } catch (err) {
    loginErrorMessage.value = err instanceof Error ? err.message : 'Could not reset this password.';
  } finally {
    isSavingLogin.value = false;
  }
}

async function onDeleteLogin() {
  const teacherId = profile.value?.teacher?.id;
  if (!auth.accessToken || !teacherId) return;
  if (
    !(await confirm({
      title: 'Delete this teacher login?',
      message: 'This removes their staff-console access. The staff record itself is not deleted.',
      danger: true,
    }))
  ) {
    return;
  }
  loginErrorMessage.value = null;
  try {
    await api.deleteTeacher(auth.accessToken, teacherId);
    await load();
    toast.success('Login deleted.');
  } catch (err) {
    loginErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this login.';
  }
}
</script>

<template>
  <div class="staff-profile">
    <ProfileIdentityCard
      v-if="profile"
      :name="profile.name"
      :initials="initialsFromName(profile.name)"
      :photo-url="displayPhotoUrl"
      photo-label="Staff photo"
      :school-name="profile.campus.school.name"
      :campus-label="profile.campus.code ? `${profile.campus.code} - ${profile.campus.name}` : profile.campus.name"
      :is-saving-photo="isSavingPhoto"
      :subtitle-tag="employeeTypeLabel(profile.employeeType)"
      :status-label="staffStatusLabel(profile.employmentStatus)"
      :status-tone="staffStatusTone(profile.employmentStatus)"
      :age-label="ageLabel"
      :tenure-label="tenureLabel"
      :contacts-label="contactsLabel"
      :documents-label="documentsLabel"
      :compact="isEditingProfile"
      @edit-profile="onHeaderEditProfile"
      @photo-file-change="onPhotoFileSelected"
    />
    <div v-else-if="!pageErrorMessage" class="identity-skeleton" data-testid="staff-profile-skeleton">
      <span class="skeleton-avatar" />
      <div class="skeleton-lines">
        <span class="skeleton-line" style="width: 40%; height: 1.4rem" />
        <span class="skeleton-line" style="width: 60%" />
      </div>
    </div>

    <p v-if="photoErrorMessage" class="error" role="alert" data-testid="profile-photo-error">{{ photoErrorMessage }}</p>
    <ErrorRetry v-if="pageErrorMessage" :message="pageErrorMessage" @retry="load" />

    <div v-if="profile" class="sections">
      <Tabs :tabs="profileTabs" v-model="activeTab" variant="pill">
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
                  <div class="field"><span class="field-label">Full name</span><span class="field-value">{{ profile.name }}</span></div>
                  <div class="field"><span class="field-label">Employee type</span><span class="field-value">{{ employeeTypeLabel(profile.employeeType) }}</span></div>
                  <div class="field"><span class="field-label">Gender</span><span class="field-value">{{ profile.gender ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Date of birth</span><span class="field-value mono">{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</span></div>
                  <div class="field"><span class="field-label">CNIC</span><span class="field-value mono">{{ profile.cnic ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Linked teacher account</span><span class="field-value">{{ profile.teacher ? profile.teacher.name : '—' }}</span></div>
                </div>
              </div>
              <div class="field-group">
                <div class="group-title">Employment &amp; contact</div>
                <div class="field-grid">
                  <div class="field"><span class="field-label">Status</span><span class="field-value">{{ staffStatusLabel(profile.employmentStatus) }}</span></div>
                  <div class="field"><span class="field-label">Joining date</span><span class="field-value mono">{{ profile.joiningDate ? profile.joiningDate.slice(0, 10) : '—' }}</span></div>
                  <div class="field"><span class="field-label">Leaving date</span><span class="field-value mono">{{ profile.leavingDate ? profile.leavingDate.slice(0, 10) : '—' }}</span></div>
                  <div class="field"><span class="field-label">Mobile</span><span class="field-value mono">{{ profile.mobile ?? '—' }}</span></div>
                  <div class="field"><span class="field-label">Email</span><span class="field-value">{{ profile.email ?? '—' }}</span></div>
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
                  <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
                  <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" mono />
                  <FormField v-model="profileForm.cnic" label="CNIC" type="text" data-testid="profile-cnic" placeholder="CNIC" mono grow />
                </div>
              </div>

              <div class="field-group">
                <div class="group-title">Employment &amp; contact</div>
                <div class="field-grid-edit">
                  <FormField v-model="profileForm.mobile" label="Mobile" type="text" data-testid="profile-mobile" placeholder="Mobile" mono grow />
                  <FormField v-model="profileForm.email" label="Email" type="email" data-testid="profile-email" placeholder="Email" grow />
                  <FormField v-model="profileForm.joiningDate" label="Joining date" type="date" data-testid="profile-joiningDate" mono />
                  <FormField v-model="profileForm.employmentStatus" label="Employment status" type="select" data-testid="profile-employmentStatus" :options="EMPLOYMENT_STATUS_OPTIONS" />
                  <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" mono />
                </div>
                <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />
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

          <ProfileSectionCard v-if="profile.employeeType === 'TEACHER' && profile.teacher" icon="lock" title="Login Access" data-testid="login-section">
            <p v-if="loginErrorMessage" class="error" role="alert">{{ loginErrorMessage }}</p>
            <div class="field-grid">
              <div class="field"><span class="field-label">Login email</span><span class="field-value mono">{{ profile.teacher.user.identifier }}</span></div>
            </div>
            <div class="field-grid-edit">
              <FormField
                v-model="newLoginPassword"
                label="New password"
                type="password"
                data-testid="login-new-password"
                placeholder="New password"
                grow
              />
            </div>
            <div class="form-actions">
              <Button data-testid="login-reset-password" :disabled="isSavingLogin || !newLoginPassword" @click="onResetLoginPassword">
                Reset password
              </Button>
              <Button variant="secondary" data-testid="login-delete" @click="onDeleteLogin">Delete teacher login</Button>
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
              message="Add someone the school can call in an emergency."
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
            subtitle="Who should the school call first in an emergency?"
            icon="users"
          >
            <div class="add-form">
              <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>
              <div class="form-grid">
                <FormField v-model="newContact.name" label="Name" type="text" data-testid="new-contact-name" placeholder="Full name" grow />
                <FormField v-model="newContact.relationship" label="Relationship" type="text" data-testid="new-contact-relationship" placeholder="e.g. Spouse, Sibling" grow />
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
                hint="Shown first across this staff member's record"
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

        <template #tab-experience>
          <ProfileSectionCard icon="briefcase" title="Experience">
            <template #actions>
              <Button data-testid="open-add-experience" @click="openAddExperienceModal">
                <AppIcon name="plus" :size="14" /> Add New
              </Button>
            </template>
            <p v-if="experienceErrorMessage" class="error" role="alert">{{ experienceErrorMessage }}</p>

            <EmptyState v-if="!profile.experience.length" icon="briefcase" title="No experience on file." cta-label="+ Add New" @cta="openAddExperienceModal" />
            <div v-else class="contact-grid">
              <div v-for="entry in profile.experience" :key="entry.id" class="contact-card">
                <template v-if="editingExperienceId === entry.id">
                  <div class="contact-edit-grid">
                    <label class="contact-edit-field">
                      <span class="field-label">Organization</span>
                      <input :data-testid="`edit-experience-organization-${entry.id}`" v-model="editExperienceForm.organization" type="text" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">Role</span>
                      <input :data-testid="`edit-experience-role-${entry.id}`" v-model="editExperienceForm.role" type="text" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">From</span>
                      <input :data-testid="`edit-experience-fromDate-${entry.id}`" v-model="editExperienceForm.fromDate" type="date" class="mono" />
                    </label>
                    <label class="contact-edit-field">
                      <span class="field-label">To</span>
                      <input :data-testid="`edit-experience-toDate-${entry.id}`" v-model="editExperienceForm.toDate" type="date" class="mono" />
                    </label>
                  </div>
                  <div class="contact-card-actions">
                    <Button :data-testid="`save-experience-${entry.id}`" @click="onSaveExperience(entry.id)">Save</Button>
                    <Button variant="secondary" @click="cancelEditExperience">Cancel</Button>
                  </div>
                </template>
                <template v-else>
                  <div class="contact-card-top">
                    <span class="contact-name">{{ entry.organization }}</span>
                  </div>
                  <div class="contact-relationship">{{ entry.role }}</div>
                  <div class="contact-phone mono">
                    {{ entry.fromDate ? entry.fromDate.slice(0, 10) : '—' }} – {{ entry.toDate ? entry.toDate.slice(0, 10) : 'Present' }}
                  </div>
                  <p v-if="entry.description" class="field-value">{{ entry.description }}</p>
                  <div class="contact-card-actions">
                    <Button :data-testid="`edit-experience-${entry.id}`" variant="secondary" @click="startEditExperience(entry)">
                      <AppIcon name="edit" :size="12" /> Edit
                    </Button>
                    <Button variant="secondary" :data-testid="`delete-experience-${entry.id}`" @click="onDeleteExperience(entry.id)">Delete</Button>
                  </div>
                </template>
              </div>
            </div>
          </ProfileSectionCard>

          <AppModal v-model="showAddExperienceModal" title="Add Experience" icon="briefcase">
            <div class="add-form">
              <p v-if="experienceErrorMessage" class="error" role="alert">{{ experienceErrorMessage }}</p>
              <div class="form-grid">
                <FormField v-model="newExperience.organization" label="Organization" type="text" data-testid="new-experience-organization" placeholder="Organization" grow />
                <FormField v-model="newExperience.role" label="Role" type="text" data-testid="new-experience-role" placeholder="Role" grow />
                <FormField v-model="newExperience.fromDate" label="From" type="date" data-testid="new-experience-fromDate" mono />
                <FormField v-model="newExperience.toDate" label="To" type="date" data-testid="new-experience-toDate" mono />
              </div>
              <FormField v-model="newExperience.description" label="Description" type="textarea" data-testid="new-experience-description" placeholder="Description" />
              <div class="form-actions">
                <Button data-testid="add-experience-submit" :disabled="isSavingExperience" @click="onAddExperience">
                  <AppIcon name="plus" :size="14" /> Add Experience
                </Button>
              </div>
            </div>
          </AppModal>
        </template>

        <template #tab-teaching>
          <ProfileSectionCard icon="clock" title="Teaching History">
            <p v-if="teachingHistoryError" class="error" role="alert">{{ teachingHistoryError }}</p>
            <p v-else-if="!teachingHistory.length" class="muted" data-testid="teaching-history-empty">No teaching assignments recorded yet.</p>
            <ul v-else class="teaching-history" data-testid="teaching-history">
              <li v-for="row in teachingHistory" :key="row.id" :data-testid="`teaching-row-${row.id}`">
                <span>{{ assignmentLabel(row) }}</span>
                <span class="mono">{{ assignmentPeriod(row) }}</span>
              </li>
            </ul>
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
.teaching-history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.teaching-history li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.muted {
  color: var(--color-muted);
}
/* Everything genuinely shared with StudentProfileView.vue (field grids, contact/experience/
   document cards, the identity skeleton, priority pills, forms, and their responsive
   breakpoints) now lives in src/assets/patterns.css — see rollout plan Section 4.1. Only
   what's specific to this page remains here. */
.staff-profile {
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
</style>
