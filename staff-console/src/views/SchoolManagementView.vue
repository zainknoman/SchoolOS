<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type OrgStatus, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface SchoolFormState {
  name: string;
  code: string;
  status: string;
  address: string;
  phone: string;
  alternatePhone: string;
  email: string;
  website: string;
  principalName: string;
  principalPhone: string;
  principalEmail: string;
  registrationNumber: string;
  establishedDate: string;
  schoolType: string;
  educationBoard: string;
  timezone: string;
  currency: string;
  logoFileId: string | null;
}

function emptyForm(): SchoolFormState {
  return {
    name: '',
    code: '',
    status: 'ACTIVE',
    address: '',
    phone: '',
    alternatePhone: '',
    email: '',
    website: '',
    principalName: '',
    principalPhone: '',
    principalEmail: '',
    registrationNumber: '',
    establishedDate: '',
    schoolType: '',
    educationBoard: '',
    timezone: '',
    currency: '',
    logoFileId: null,
  };
}

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showModal = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingId = ref<string | null>(null);
const isSaving = ref(false);
const form = reactive<SchoolFormState>(emptyForm());

// --- Logo upload (mirrors StudentProfileView.vue's profile-photo upload flow: upload immediately
// on file selection, keep a local object-URL preview, and store the returned file id to submit
// with the rest of the form) --------------------------------------------------------------------
const logoPreviewUrl = ref<string | null>(null);
const isUploadingLogo = ref(false);
const logoErrorMessage = ref<string | null>(null);

const displayLogoUrl = computed(() => {
  if (logoPreviewUrl.value) return logoPreviewUrl.value;
  return form.logoFileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, form.logoFileId) : null;
});

async function onLogoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file || !auth.accessToken) return;

  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value);
  logoPreviewUrl.value = URL.createObjectURL(file);

  logoErrorMessage.value = null;
  isUploadingLogo.value = true;
  try {
    const uploaded = await api.uploadFile(auth.accessToken, file);
    form.logoFileId = uploaded.id;
  } catch (err) {
    logoErrorMessage.value = err instanceof Error ? err.message : 'Could not upload this logo.';
  } finally {
    isUploadingLogo.value = false;
  }
}

onBeforeUnmount(() => {
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value);
});

async function load() {
  if (!auth.accessToken) return;
  try {
    schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools.';
  }
}
load();

function resetForm() {
  Object.assign(form, emptyForm());
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value);
  logoPreviewUrl.value = null;
  logoErrorMessage.value = null;
}

function openAddModal() {
  resetForm();
  modalMode.value = 'add';
  editingId.value = null;
  showModal.value = true;
}

function openEditModal(school: SchoolSummary) {
  resetForm();
  modalMode.value = 'edit';
  editingId.value = school.id;
  form.name = school.name;
  form.code = school.code ?? '';
  form.status = school.status ?? 'ACTIVE';
  form.address = school.address ?? '';
  form.phone = school.phone ?? '';
  form.alternatePhone = school.alternatePhone ?? '';
  form.email = school.email ?? '';
  form.website = school.website ?? '';
  form.principalName = school.principalName ?? '';
  form.principalPhone = school.principalPhone ?? '';
  form.principalEmail = school.principalEmail ?? '';
  form.registrationNumber = school.registrationNumber ?? '';
  form.establishedDate = school.establishedDate ?? '';
  form.schoolType = school.schoolType ?? '';
  form.educationBoard = school.educationBoard ?? '';
  form.timezone = school.timezone ?? '';
  form.currency = school.currency ?? '';
  form.logoFileId = school.logoFileId ?? null;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingId.value = null;
}

function buildPayload() {
  return {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    registrationNumber: form.registrationNumber.trim() || undefined,
    website: form.website.trim() || undefined,
    logoFileId: form.logoFileId || undefined,
    principalName: form.principalName.trim() || undefined,
    principalPhone: form.principalPhone.trim() || undefined,
    principalEmail: form.principalEmail.trim() || undefined,
    establishedDate: form.establishedDate || undefined,
    schoolType: form.schoolType.trim() || undefined,
    educationBoard: form.educationBoard.trim() || undefined,
    status: (form.status || 'ACTIVE') as OrgStatus,
    timezone: form.timezone.trim() || undefined,
    currency: form.currency.trim() || undefined,
    alternatePhone: form.alternatePhone.trim() || undefined,
    address: form.address.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
  };
}

async function onSubmit() {
  if (!auth.accessToken || !form.name.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    if (modalMode.value === 'edit' && editingId.value) {
      await api.updateSchool(auth.accessToken, editingId.value, buildPayload());
    } else {
      await api.createSchool(auth.accessToken, buildPayload());
    }
    const wasEdit = modalMode.value === 'edit';
    closeModal();
    await load();
    toast.success(wasEdit ? 'School updated.' : 'School added.');
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : `Could not ${modalMode.value === 'edit' ? 'update' : 'create'} this school.`;
  } finally {
    isSaving.value = false;
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSchool(auth.accessToken, id);
    await load();
    toast.success('School deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this school.';
  }
}
</script>

<template>
  <ListPageCard icon="home" title="Schools">
    <template #actions>
      <Button data-testid="open-add-form" @click="openAddModal">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="schools"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'status', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
        { key: 'campusCount', label: 'Campuses' },
        { key: 'studentCount', label: 'Students' },
        { key: 'staffCount', label: 'Staff' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-code="{ item }">
        <span>{{ item.code ?? '—' }}</span>
      </template>
      <template #cell-status="{ item }">
        <StatusPill
          :tone="item.status === 'INACTIVE' ? 'neutral' : 'success'"
          :label="item.status === 'INACTIVE' ? 'Inactive' : 'Active'"
        />
      </template>
      <template #cell-address="{ item }">
        <span>{{ item.address ?? '—' }}</span>
      </template>
      <template #cell-phone="{ item }">
        <span>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item }">
        <Button :data-testid="`edit-${item.id}`" @click="openEditModal(item)">Edit</Button>
        <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
          Delete
        </Button>
      </template>
    </EntityTable>

    <AppModal v-model="showModal" :title="modalMode === 'edit' ? 'Edit School' : 'Add School'">
      <div class="school-form">
        <section class="form-section">
          <h3>Basic</h3>
          <div class="inline-form">
            <FormField v-model="form.name" label="School name" type="text" data-testid="field-name" placeholder="School name" grow />
            <FormField v-model="form.code" label="Code" type="text" data-testid="field-code" placeholder="Code" />
            <FormField
              v-model="form.status"
              label="Status"
              type="select"
              data-testid="field-status"
              :options="STATUS_OPTIONS"
            />
          </div>
        </section>

        <section class="form-section">
          <h3>Contact</h3>
          <div class="inline-form">
            <FormField v-model="form.address" label="Address" type="text" data-testid="field-address" placeholder="Address" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="form.phone" label="Phone" type="text" data-testid="field-phone" placeholder="Phone" grow />
            <FormField
              v-model="form.alternatePhone"
              label="Alternate phone"
              type="text"
              data-testid="field-alternate-phone"
              placeholder="Alternate phone"
              grow
            />
          </div>
          <div class="inline-form">
            <FormField v-model="form.email" label="Email" type="email" data-testid="field-email" placeholder="Email" grow />
            <FormField v-model="form.website" label="Website" type="text" data-testid="field-website" placeholder="Website" grow />
          </div>
        </section>

        <section class="form-section">
          <h3>Leadership</h3>
          <div class="inline-form">
            <FormField
              v-model="form.principalName"
              label="Principal name"
              type="text"
              data-testid="field-principal-name"
              placeholder="Principal name"
              grow
            />
          </div>
          <div class="inline-form">
            <FormField
              v-model="form.principalPhone"
              label="Principal phone"
              type="text"
              data-testid="field-principal-phone"
              placeholder="Principal phone"
              grow
            />
            <FormField
              v-model="form.principalEmail"
              label="Principal email"
              type="email"
              data-testid="field-principal-email"
              placeholder="Principal email"
              grow
            />
          </div>
        </section>

        <section class="form-section">
          <h3>Details</h3>
          <div class="inline-form">
            <FormField
              v-model="form.registrationNumber"
              label="Registration number"
              type="text"
              data-testid="field-registration-number"
              placeholder="Registration number"
              grow
            />
            <FormField v-model="form.establishedDate" label="Established date" type="date" data-testid="field-established-date" />
          </div>
          <div class="inline-form">
            <FormField
              v-model="form.schoolType"
              label="School type"
              type="text"
              data-testid="field-school-type"
              placeholder="e.g. K-12"
              grow
            />
            <FormField
              v-model="form.educationBoard"
              label="Education board"
              type="text"
              data-testid="field-education-board"
              placeholder="Education board"
              grow
            />
          </div>
          <div class="inline-form">
            <FormField v-model="form.timezone" label="Timezone" type="text" data-testid="field-timezone" placeholder="e.g. Asia/Karachi" grow />
            <FormField v-model="form.currency" label="Currency" type="text" data-testid="field-currency" placeholder="e.g. PKR" grow />
          </div>
        </section>

        <section class="form-section">
          <h3>Logo</h3>
          <div class="logo-row">
            <img v-if="displayLogoUrl" :src="displayLogoUrl" alt="" class="logo-preview" />
            <div>
              <label class="sr-only" for="school-logo-input">School logo</label>
              <input
                id="school-logo-input"
                type="file"
                accept="image/*"
                data-testid="field-logo-input"
                @change="onLogoFileSelected"
              />
              <p v-if="isUploadingLogo">Uploading…</p>
              <p v-if="logoErrorMessage" class="error" role="alert">{{ logoErrorMessage }}</p>
            </div>
          </div>
        </section>

        <Button :data-testid="modalMode === 'edit' ? 'save-submit' : 'add-submit'" :disabled="isSaving" @click="onSubmit">
          {{ modalMode === 'edit' ? 'Save' : 'Add' }}
        </Button>
      </div>
    </AppModal>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.school-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.form-section h3 {
  font-size: var(--font-size-sm);
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
.logo-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.logo-preview {
  width: 4rem;
  height: 4rem;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
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
