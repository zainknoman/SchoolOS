<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type AddressInput, type StaffProfileDetail } from '../lib/api';
import { GENDER_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '../lib/staff-profile.constants';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import Tabs from '../components/Tabs.vue';
import { initialsFromName } from '../lib/format';
import EntityTable from '../components/EntityTable.vue';
import { useConfirm } from '../lib/useConfirm';
import StatusPill from '../components/StatusPill.vue';
import AppModal from '../components/AppModal.vue';

const PROFILE_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'contacts', label: 'Emergency Contacts' },
  { id: 'experience', label: 'Experience' },
  { id: 'documents', label: 'Documents' },
];
const activeTab = ref('profile');

const auth = useAuthStore();
const route = useRoute();
const { confirm } = useConfirm();
const staffId = route.params.id as string;

const profile = ref<StaffProfileDetail | null>(null);
const pageErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    profile.value = await api.getStaffProfile(auth.accessToken, staffId);
  } catch (err) {
    pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this staff member.';
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
  } catch (err) {
    profileErrorMessage.value = err instanceof Error ? err.message : 'Could not save this profile.';
  } finally {
    isSavingProfile.value = false;
  }
}

// --- Profile photo (top-right avatar) --------------------------------------------------------
const photoInputRef = ref<HTMLInputElement | null>(null);
const photoPreviewUrl = ref<string | null>(null);
const photoErrorMessage = ref<string | null>(null);
const isSavingPhoto = ref(false);

const displayPhotoUrl = computed(() => {
  if (photoPreviewUrl.value) return photoPreviewUrl.value;
  const fileId = profile.value?.profilePhotoFileId;
  return fileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, fileId) : null;
});

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
    await api.updateStaffProfile(auth.accessToken, staffId, { profilePhotoFileId: uploaded.id });
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
  } catch (err) {
    loginErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this login.';
  }
}

</script>

<template>
  <div class="staff-profile">
    <div class="page-header">
      <h1 v-if="profile">{{ profile.name }}</h1>
      <h1 v-else>Staff Profile</h1>

      <div v-if="profile" class="photo-widget">
        <button
          type="button"
          class="photo-avatar"
          data-testid="profile-photo-trigger"
          :disabled="isSavingPhoto"
          @click="triggerPhotoInput"
        >
          <img v-if="displayPhotoUrl" :src="displayPhotoUrl" alt="" class="photo-avatar-img" />
          <template v-else>{{ initialsFromName(profile.name) }}</template>
        </button>
        <label class="sr-only" for="profile-photo-input">Staff photo</label>
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
      <Tabs :tabs="PROFILE_TABS" v-model="activeTab">
        <template #tab-profile>
      <section class="profile-section">
        <div class="section-header">
          <h2>Profile</h2>
          <Button v-if="!isEditingProfile" data-testid="edit-profile" @click="startEditProfile">Edit</Button>
        </div>
        <p v-if="profileErrorMessage" data-testid="profile-error" class="error" role="alert">{{ profileErrorMessage }}</p>

        <dl v-if="!isEditingProfile" class="detail-grid">
          <dt>Full name</dt><dd>{{ profile.name }}</dd>
          <dt>Employee type</dt><dd>{{ profile.employeeType }}</dd>
          <dt>Employment status</dt><dd>{{ profile.employmentStatus }}</dd>
          <dt>Gender</dt><dd>{{ profile.gender ?? '—' }}</dd>
          <dt>Date of birth</dt><dd>{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</dd>
          <dt>CNIC</dt><dd>{{ profile.cnic ?? '—' }}</dd>
          <dt>Mobile</dt><dd>{{ profile.mobile ?? '—' }}</dd>
          <dt>Email</dt><dd>{{ profile.email ?? '—' }}</dd>
          <dt>Joining date</dt><dd>{{ profile.joiningDate ? profile.joiningDate.slice(0, 10) : '—' }}</dd>
          <dt>Leaving date</dt><dd>{{ profile.leavingDate ? profile.leavingDate.slice(0, 10) : '—' }}</dd>
          <dt>Linked teacher account</dt><dd>{{ profile.teacher ? profile.teacher.name : '—' }}</dd>
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
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
            <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" />
            <FormField v-model="profileForm.cnic" label="CNIC" type="text" data-testid="profile-cnic" placeholder="CNIC" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.mobile" label="Mobile" type="text" data-testid="profile-mobile" placeholder="Mobile" grow />
            <FormField v-model="profileForm.email" label="Email" type="email" data-testid="profile-email" placeholder="Email" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="profileForm.joiningDate" label="Joining date" type="date" data-testid="profile-joiningDate" />
            <FormField v-model="profileForm.employmentStatus" label="Employment status" type="select" data-testid="profile-employmentStatus" :options="EMPLOYMENT_STATUS_OPTIONS" />
            <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" />
          </div>
          <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />

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

      <section v-if="profile.employeeType === 'TEACHER' && profile.teacher" class="profile-section" data-testid="login-section">
        <h2>Login</h2>
        <p v-if="loginErrorMessage" class="error" role="alert">{{ loginErrorMessage }}</p>
        <dl class="detail-grid">
          <dt>Login email</dt><dd>{{ profile.teacher.user.identifier }}</dd>
        </dl>
        <div class="inline-form">
          <FormField
            v-model="newLoginPassword"
            label="New password"
            type="password"
            data-testid="login-new-password"
            placeholder="New password"
            grow
          />
          <Button data-testid="login-reset-password" :disabled="isSavingLogin || !newLoginPassword" @click="onResetLoginPassword">
            Reset password
          </Button>
        </div>
        <Button variant="secondary" data-testid="login-delete" @click="onDeleteLogin">Delete teacher login</Button>
      </section>
        </template>
        <template #tab-contacts>
      <section class="profile-section">
        <div class="section-header">
          <h2>Emergency Contacts</h2>
          <Button data-testid="open-add-contact" @click="openAddContactModal">+ Add New</Button>
        </div>
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
      </section>

      <AppModal v-model="showAddContactModal" title="Add Emergency Contact">
        <div class="add-form">
          <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>
          <div class="form-grid">
            <FormField v-model="newContact.name" label="Name" type="text" data-testid="new-contact-name" placeholder="Name" grow />
            <FormField v-model="newContact.relationship" label="Relationship" type="text" data-testid="new-contact-relationship" placeholder="Relationship" grow />
            <FormField v-model="newContact.phone" label="Phone" type="text" data-testid="new-contact-phone" placeholder="Phone" grow />
            <FormField v-model="newContact.alternatePhone" label="Alternate phone" type="text" data-testid="new-contact-alternatePhone" placeholder="Alternate phone" grow />
            <FormField v-model="newContact.email" label="Email" type="email" data-testid="new-contact-email" placeholder="Email" grow />
            <FormField v-model="newContact.priority" label="Priority" type="text" data-testid="new-contact-priority" placeholder="Priority" />
          </div>
          <FormField v-model="newContact.isPrimary" label="Primary contact" type="checkbox" data-testid="new-contact-isPrimary" />
          <Button data-testid="add-contact-submit" :disabled="isSavingContact" @click="onAddContact">Add Contact</Button>
        </div>
      </AppModal>
        </template>
        <template #tab-experience>
      <section class="profile-section">
        <div class="section-header">
          <h2>Experience</h2>
          <Button data-testid="open-add-experience" @click="openAddExperienceModal">+ Add New</Button>
        </div>
        <p v-if="experienceErrorMessage" class="error" role="alert">{{ experienceErrorMessage }}</p>

        <EntityTable
          :items="profile.experience"
          :columns="[
            { key: 'organization', label: 'Organization' },
            { key: 'role', label: 'Role' },
            { key: 'fromDate', label: 'From' },
            { key: 'toDate', label: 'To' },
          ]"
          row-key="id"
          :editing-id="editingExperienceId"
        >
          <template #cell-organization="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-experience-organization-${item.id}`" v-model="editExperienceForm.organization" type="text" />
            <span v-else>{{ item.organization }}</span>
          </template>
          <template #cell-role="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-experience-role-${item.id}`" v-model="editExperienceForm.role" type="text" />
            <span v-else>{{ item.role }}</span>
          </template>
          <template #cell-fromDate="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-experience-fromDate-${item.id}`" v-model="editExperienceForm.fromDate" type="date" />
            <span v-else>{{ item.fromDate ? item.fromDate.slice(0, 10) : '—' }}</span>
          </template>
          <template #cell-toDate="{ item, editing }">
            <input v-if="editing" :data-testid="`edit-experience-toDate-${item.id}`" v-model="editExperienceForm.toDate" type="date" />
            <span v-else>{{ item.toDate ? item.toDate.slice(0, 10) : '—' }}</span>
          </template>
          <template #actions="{ item, editing }">
            <template v-if="editing">
              <Button :data-testid="`save-experience-${item.id}`" @click="onSaveExperience(item.id)">Save</Button>
              <Button variant="secondary" @click="cancelEditExperience">Cancel</Button>
            </template>
            <template v-else>
              <Button :data-testid="`edit-experience-${item.id}`" @click="startEditExperience(item)">Edit</Button>
              <Button variant="secondary" :data-testid="`delete-experience-${item.id}`" @click="onDeleteExperience(item.id)">Delete</Button>
            </template>
          </template>
        </EntityTable>
      </section>

      <AppModal v-model="showAddExperienceModal" title="Add Experience">
        <div class="add-form">
          <p v-if="experienceErrorMessage" class="error" role="alert">{{ experienceErrorMessage }}</p>
          <div class="form-grid">
            <FormField v-model="newExperience.organization" label="Organization" type="text" data-testid="new-experience-organization" placeholder="Organization" grow />
            <FormField v-model="newExperience.role" label="Role" type="text" data-testid="new-experience-role" placeholder="Role" grow />
            <FormField v-model="newExperience.fromDate" label="From" type="date" data-testid="new-experience-fromDate" />
            <FormField v-model="newExperience.toDate" label="To" type="date" data-testid="new-experience-toDate" />
          </div>
          <FormField v-model="newExperience.description" label="Description" type="textarea" data-testid="new-experience-description" placeholder="Description" />
          <Button data-testid="add-experience-submit" :disabled="isSavingExperience" @click="onAddExperience">Add Experience</Button>
        </div>
      </AppModal>
        </template>
        <template #tab-documents>
      <section class="profile-section">
        <div class="section-header">
          <h2>Documents</h2>
          <Button data-testid="open-add-document" @click="openAddDocumentModal">+ Add New</Button>
        </div>
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
      </section>

      <AppModal v-model="showAddDocumentModal" title="Add Document">
        <div class="add-form">
          <p v-if="documentsErrorMessage" class="error" role="alert">{{ documentsErrorMessage }}</p>
          <div class="form-grid">
            <FormField v-model="newDocument.documentType" label="Document type" type="select" data-testid="new-document-type" placeholder="Document type" :options="DOCUMENT_TYPE_OPTIONS" />
            <FormField v-model="newDocument.expiryDate" label="Expiry date" type="date" data-testid="new-document-expiryDate" />
          </div>
          <div class="form-field">
            <label class="sr-only" for="new-document-file-input">File</label>
            <input id="new-document-file-input" type="file" data-testid="new-document-file" @change="onNewDocumentFileChange" />
          </div>
          <FormField v-model="newDocument.notes" label="Notes" type="textarea" data-testid="new-document-notes" placeholder="Notes" />
          <Button data-testid="add-document-submit" :disabled="isSavingDocument" @click="onAddDocument">Add Document</Button>
        </div>
      </AppModal>
        </template>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.staff-profile {
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
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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