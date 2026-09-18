<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type OrgStatus, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface CampusFormState {
  schoolId: string;
  name: string;
  code: string;
  campusType: string;
  status: string;
  address: string;
  phone: string;
  alternatePhone: string;
  email: string;
  principalName: string;
  principalPhone: string;
  principalEmail: string;
  latitude: string;
  longitude: string;
  capacity: string;
  openingDate: string;
  departments: string;
  logoFileId: string | null;
}

function emptyForm(): CampusFormState {
  return {
    schoolId: '',
    name: '',
    code: '',
    campusType: '',
    status: 'ACTIVE',
    address: '',
    phone: '',
    alternatePhone: '',
    email: '',
    principalName: '',
    principalPhone: '',
    principalEmail: '',
    latitude: '',
    longitude: '',
    capacity: '',
    openingDate: '',
    departments: '',
    logoFileId: null,
  };
}

// Splits a comma-separated departments string into trimmed, non-empty entries. Returns undefined
// when there's nothing usable, so an empty field never sends an empty array.
function parseDepartments(raw: string): string[] | undefined {
  const parts = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parts.length > 0 ? parts : undefined;
}

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const schools = ref<SchoolSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showModal = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingId = ref<string | null>(null);
const isSaving = ref(false);
const form = reactive<CampusFormState>(emptyForm());

// --- Logo upload (mirrors SchoolManagementView.vue: upload immediately on file selection, keep a
// local object-URL preview, and store the returned file id to submit with the rest of the form) ---
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
    [schools.value, campuses.value] = await Promise.all([
      api.listSchools(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
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

function openEditModal(campus: CampusSummary) {
  resetForm();
  modalMode.value = 'edit';
  editingId.value = campus.id;
  form.name = campus.name;
  form.code = campus.code ?? '';
  form.campusType = campus.campusType ?? '';
  form.status = campus.status ?? 'ACTIVE';
  form.address = campus.address ?? '';
  form.phone = campus.phone ?? '';
  form.alternatePhone = campus.alternatePhone ?? '';
  form.email = campus.email ?? '';
  form.principalName = campus.principalName ?? '';
  form.principalPhone = campus.principalPhone ?? '';
  form.principalEmail = campus.principalEmail ?? '';
  form.latitude = campus.latitude != null ? String(campus.latitude) : '';
  form.longitude = campus.longitude != null ? String(campus.longitude) : '';
  form.capacity = campus.capacity != null ? String(campus.capacity) : '';
  form.openingDate = campus.openingDate ?? '';
  form.departments = (campus.departments ?? []).join(', ');
  form.logoFileId = campus.logoFileId ?? null;
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
    campusType: form.campusType.trim() || undefined,
    logoFileId: form.logoFileId || undefined,
    principalName: form.principalName.trim() || undefined,
    principalPhone: form.principalPhone.trim() || undefined,
    principalEmail: form.principalEmail.trim() || undefined,
    openingDate: form.openingDate || undefined,
    capacity: form.capacity.trim() ? Number(form.capacity) : undefined,
    latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
    longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
    status: (form.status || 'ACTIVE') as OrgStatus,
    departments: parseDepartments(form.departments),
    alternatePhone: form.alternatePhone.trim() || undefined,
    address: form.address.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
  };
}

async function onSubmit() {
  if (!auth.accessToken || !form.name.trim()) return;
  if (modalMode.value === 'add' && !form.schoolId) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    if (modalMode.value === 'edit' && editingId.value) {
      await api.updateCampus(auth.accessToken, editingId.value, buildPayload());
    } else {
      await api.createCampus(auth.accessToken, { schoolId: form.schoolId, ...buildPayload() });
    }
    const wasEdit = modalMode.value === 'edit';
    closeModal();
    await load();
    toast.success(wasEdit ? 'Campus updated.' : 'Campus added.');
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : `Could not ${modalMode.value === 'edit' ? 'update' : 'create'} this campus.`;
  } finally {
    isSaving.value = false;
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this campus?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteCampus(auth.accessToken, id);
    await load();
    toast.success('Campus deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this campus.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Campuses</h1>
      <Button data-testid="open-add-form" @click="openAddModal">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="campuses"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'status', label: 'Status' },
        { key: 'campusType', label: 'Type' },
        { key: 'schoolName', label: 'School' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
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
      <template #cell-campusType="{ item }">
        <span>{{ item.campusType ?? '—' }}</span>
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

    <AppModal v-model="showModal" :title="modalMode === 'edit' ? 'Edit Campus' : 'Add Campus'">
      <div class="campus-form">
        <section class="form-section">
          <h3>Basic</h3>
          <div v-if="modalMode === 'add'" class="inline-form">
            <FormField
              v-model="form.schoolId"
              label="School"
              type="select"
              data-testid="field-school"
              placeholder="Choose a school"
              :options="schools.map((s) => ({ value: s.id, label: s.name }))"
            />
          </div>
          <div class="inline-form">
            <FormField v-model="form.name" label="Campus name" type="text" data-testid="field-name" placeholder="Campus name" grow />
            <FormField v-model="form.code" label="Code" type="text" data-testid="field-code" placeholder="Code" />
          </div>
          <div class="inline-form">
            <FormField
              v-model="form.campusType"
              label="Campus type"
              type="text"
              data-testid="field-campus-type"
              placeholder="e.g. Main / Branch"
              grow
            />
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
          <h3>Location &amp; Capacity</h3>
          <div class="inline-form">
            <FormField v-model="form.latitude" label="Latitude" type="text" data-testid="field-latitude" placeholder="Latitude" grow />
            <FormField v-model="form.longitude" label="Longitude" type="text" data-testid="field-longitude" placeholder="Longitude" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="form.capacity" label="Capacity" type="text" data-testid="field-capacity" placeholder="Capacity" grow />
            <FormField v-model="form.openingDate" label="Opening date" type="date" data-testid="field-opening-date" />
          </div>
        </section>

        <section class="form-section">
          <h3>Departments</h3>
          <div class="inline-form">
            <FormField
              v-model="form.departments"
              label="Departments"
              type="text"
              data-testid="field-departments"
              placeholder="Comma-separated, e.g. Science, Admin, IT"
              grow
            />
          </div>
        </section>

        <section class="form-section">
          <h3>Logo</h3>
          <div class="logo-row">
            <img v-if="displayLogoUrl" :src="displayLogoUrl" alt="" class="logo-preview" />
            <div>
              <label class="sr-only" for="campus-logo-input">Campus logo</label>
              <input
                id="campus-logo-input"
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
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1000px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.campus-form {
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
