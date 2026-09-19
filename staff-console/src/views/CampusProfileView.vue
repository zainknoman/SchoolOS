<!-- staff-console/src/views/CampusProfileView.vue -->
<!-- One screen for viewing, editing and adding a campus (`/admin/campuses/new` has no :id), so the
     three modes look identical — there is no separate edit/add popup. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type OrgStatus, type ProvisionedLogin, type SchoolSummary } from '../lib/api';
import OrgProfileHeader from '../components/OrgProfileHeader.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import ProvisionLoginFields from '../components/ProvisionLoginFields.vue';
import CredentialsPanel from '../components/CredentialsPanel.vue';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

// Campus edit/delete are SUPER_ADMIN-only on the backend; a SCHOOL_ADMIN can view (and, school-wide, create).
const canEditCampus = computed(() => auth.role === 'SUPER_ADMIN');

const campusId = computed(() => (route.params.id as string | undefined) ?? null);
const isNew = computed(() => campusId.value === null);

const campus = ref<CampusSummary | null>(null);
const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);
const saveErrorMessage = ref<string | null>(null);
const isEditing = ref(isNew.value);
const isSaving = ref(false);
// Create-only login provisioning. The password / temporary password live only in memory and are cleared after use.
const provision = reactive({ enabled: false, identifier: '', password: '' });
const issuedLogin = ref<ProvisionedLogin | null>(null);

function finishCreate() {
  issuedLogin.value = null;
  provision.password = '';
  router.push('/admin/campuses');
}

function emptyForm() {
  return {
    schoolId: '', name: '', code: '', campusType: '', status: 'ACTIVE', address: '', phone: '', alternatePhone: '',
    email: '', principalName: '', principalPhone: '', principalEmail: '', latitude: '', longitude: '', capacity: '',
    openingDate: '', departments: '', logoFileId: null as string | null,
  };
}
const form = reactive(emptyForm());

function fillForm(c: CampusSummary | null) {
  Object.assign(form, emptyForm());
  if (!c) return;
  Object.assign(form, {
    schoolId: c.schoolId, name: c.name, code: c.code ?? '', campusType: c.campusType ?? '', status: c.status ?? 'ACTIVE',
    address: c.address ?? '', phone: c.phone ?? '', alternatePhone: c.alternatePhone ?? '', email: c.email ?? '',
    principalName: c.principalName ?? '', principalPhone: c.principalPhone ?? '', principalEmail: c.principalEmail ?? '',
    latitude: c.latitude != null ? String(c.latitude) : '', longitude: c.longitude != null ? String(c.longitude) : '',
    capacity: c.capacity != null ? String(c.capacity) : '', openingDate: c.openingDate ? c.openingDate.slice(0, 10) : '',
    departments: (c.departments ?? []).join(', '), logoFileId: c.logoFileId ?? null,
  });
}

// Splits a comma-separated departments string into trimmed, non-empty entries; undefined when
// there's nothing usable, so an empty field never sends an empty array.
function parseDepartments(raw: string): string[] | undefined {
  const parts = raw.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return parts.length > 0 ? parts : undefined;
}

// --- Logo upload: upload immediately on file selection, keep a local preview, submit the file id ---
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
    form.logoFileId = (await api.uploadFile(auth.accessToken, file)).id;
  } catch (err) {
    logoErrorMessage.value = err instanceof Error ? err.message : 'Could not upload this logo.';
  } finally {
    isUploadingLogo.value = false;
  }
}

function clearLogoPreview() {
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value);
  logoPreviewUrl.value = null;
  logoErrorMessage.value = null;
}
onBeforeUnmount(clearLogoPreview);

function startEdit() {
  fillForm(campus.value);
  clearLogoPreview();
  saveErrorMessage.value = null;
  isEditing.value = true;
}

function cancelEdit() {
  if (isNew.value) {
    router.push('/admin/campuses');
    return;
  }
  clearLogoPreview();
  saveErrorMessage.value = null;
  isEditing.value = false;
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

const canSave = computed(() => !!form.name.trim() && (!isNew.value || !!form.schoolId));

async function onSave() {
  if (!auth.accessToken || !canSave.value) return;
  saveErrorMessage.value = null;
  isSaving.value = true;
  try {
    if (isNew.value) {
      const created = await api.createCampus(auth.accessToken, {
        schoolId: form.schoolId,
        ...buildPayload(),
        ...(provision.enabled && provision.identifier.trim()
          ? { principal: { identifier: provision.identifier.trim(), ...(provision.password ? { password: provision.password } : {}) } }
          : {}),
      });
      toast.success('Campus added.');
      if (created.provisionedLogin) {
        issuedLogin.value = created.provisionedLogin;
        provision.password = '';
      } else {
        finishCreate();
      }
    } else {
      await api.updateCampus(auth.accessToken, campusId.value!, buildPayload());
      await load();
      clearLogoPreview();
      isEditing.value = false;
      toast.success('Campus updated.');
    }
  } catch (err) {
    saveErrorMessage.value = err instanceof Error ? err.message : `Could not ${isNew.value ? 'create' : 'update'} this campus.`;
  } finally {
    isSaving.value = false;
  }
}

function schoolsFromCampuses(list: CampusSummary[]): SchoolSummary[] {
  const seen = new Map<string, SchoolSummary>();
  for (const c of list) {
    if (!seen.has(c.schoolId)) seen.set(c.schoolId, { id: c.schoolId, name: c.schoolName } as SchoolSummary);
  }
  return [...seen.values()];
}

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    // No single-campus endpoint exists — the list already carries every field this page shows.
    // GET /schools is SUPER_ADMIN-only, so a SCHOOL_ADMIN's own school is derived from the campuses
    // list (already scoped to their school) — enough to pick the school when adding a campus.
    const [allCampuses, allSchools] = await Promise.all([
      api.listCampuses(auth.accessToken),
      auth.role === 'SUPER_ADMIN' ? api.listSchools(auth.accessToken) : Promise.resolve(null),
    ]);
    schools.value = allSchools ?? schoolsFromCampuses(allCampuses);
    if (isNew.value) {
      fillForm(null);
      isEditing.value = true;
      return;
    }
    const found = allCampuses.find((c) => c.id === campusId.value) ?? null;
    if (!found) {
      errorMessage.value = 'Campus not found.';
      return;
    }
    campus.value = found;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this campus.';
  }
}
load();
// The list's "Edit" link opens this screen straight into edit mode.
if (route.query?.edit === '1' && canEditCampus.value) watch(campus, (v) => v && !isEditing.value && startEdit(), { once: true });

const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : value);
const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : null);

const chips = computed(() => [campus.value?.schoolName, campus.value?.code, campus.value?.campusType].filter((v): v is string => !!v));
const stats = computed(() => [
  { label: 'Students', value: campus.value?.studentCount ?? 0 },
  { label: 'Staff', value: campus.value?.staffCount ?? 0 },
  { label: 'Capacity', value: campus.value?.capacity ?? '—' },
]);
// Edit mode shows the just-picked preview; view mode shows the saved logo. No logo → initials.
const headerLogoUrl = computed(() => {
  if (isEditing.value) return displayLogoUrl.value;
  return campus.value?.logoFileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, campus.value.logoFileId) : null;
});
const headerStatus = computed(() => (isEditing.value ? form.status : campus.value?.status) ?? 'ACTIVE');
</script>

<template>
  <div class="org-profile">
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <template v-if="campus || (isNew && !errorMessage)">
      <OrgProfileHeader
        :name="isEditing ? form.name || 'New campus' : campus!.name"
        :status-label="headerStatus === 'ACTIVE' ? 'Active' : 'Inactive'"
        :status-tone="headerStatus === 'ACTIVE' ? 'success' : 'neutral'"
        back-to="/admin/campuses"
        back-label="Campuses"
        :logo-url="headerLogoUrl"
        :chips="isNew ? [] : chips"
        :stats="isNew ? [] : stats"
      >
        <template #actions>
          <template v-if="isEditing">
            <Button variant="secondary" data-testid="cancel-edit" :disabled="isSaving" @click="cancelEdit">Cancel</Button>
            <Button :data-testid="isNew ? 'add-submit' : 'save-submit'" :disabled="isSaving || !canSave || !!issuedLogin" @click="onSave">
              {{ isNew ? 'Add campus' : 'Save' }}
            </Button>
          </template>
          <Button v-else-if="canEditCampus" data-testid="edit-profile" @click="startEdit">Edit</Button>
        </template>
      </OrgProfileHeader>
      <p v-if="saveErrorMessage" class="error" role="alert">{{ saveErrorMessage }}</p>

      <CredentialsPanel v-if="issuedLogin" :login="issuedLogin" @done="finishCreate" />

      <template v-else-if="isEditing">
        <ProfileSectionCard icon="home" title="Overview">
          <div class="field-grid">
            <FormField
              v-if="isNew"
              v-model="form.schoolId"
              label="School"
              type="select"
              data-testid="field-school"
              placeholder="Choose a school"
              :options="schools.map((s) => ({ value: s.id, label: s.name }))"
            />
            <FormField v-model="form.name" label="Campus name" type="text" data-testid="field-name" placeholder="Campus name" />
            <FormField v-model="form.code" label="Campus code" type="text" data-testid="field-code" placeholder="Code" />
            <FormField v-model="form.campusType" label="Campus type" type="text" data-testid="field-campus-type" placeholder="e.g. Main / Branch" />
            <FormField v-model="form.status" label="Status" type="select" data-testid="field-status" :options="STATUS_OPTIONS" />
            <FormField v-model="form.openingDate" label="Opening date" type="date" data-testid="field-opening-date" />
            <FormField v-model="form.capacity" label="Capacity" type="text" data-testid="field-capacity" placeholder="Capacity" />
            <FormField v-model="form.departments" label="Departments" type="text" data-testid="field-departments" placeholder="Comma-separated, e.g. Science, Admin, IT" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="chat" title="Contact & location">
          <div class="field-grid">
            <FormField v-model="form.phone" label="Phone" type="text" data-testid="field-phone" placeholder="Phone" />
            <FormField v-model="form.alternatePhone" label="Alternate phone" type="text" data-testid="field-alternate-phone" placeholder="Alternate phone" />
            <FormField v-model="form.email" label="Email" type="email" data-testid="field-email" placeholder="Email" />
            <FormField v-model="form.address" label="Address" type="text" data-testid="field-address" placeholder="Address" />
            <FormField v-model="form.latitude" label="Latitude" type="text" data-testid="field-latitude" placeholder="Latitude" />
            <FormField v-model="form.longitude" label="Longitude" type="text" data-testid="field-longitude" placeholder="Longitude" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="user-circle" title="Principal">
          <div class="field-grid">
            <FormField v-model="form.principalName" label="Name" type="text" data-testid="field-principal-name" placeholder="Principal name" />
            <FormField v-model="form.principalPhone" label="Phone" type="text" data-testid="field-principal-phone" placeholder="Principal phone" />
            <FormField v-model="form.principalEmail" label="Email" type="email" data-testid="field-principal-email" placeholder="Principal email" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard v-if="isNew" icon="user-circle" title="Login">
          <ProvisionLoginFields :model-value="provision" @update:model-value="Object.assign(provision, $event)" label="Campus principal login" />
        </ProfileSectionCard>

        <ProfileSectionCard icon="file-text" title="Logo">
          <div class="logo-row">
            <img v-if="displayLogoUrl" :src="displayLogoUrl" alt="" class="logo-preview" />
            <div>
              <label class="sr-only" for="campus-logo-input">Campus logo</label>
              <input id="campus-logo-input" type="file" accept="image/*" data-testid="field-logo-input" @change="onLogoFileSelected" />
              <p v-if="isUploadingLogo">Uploading…</p>
              <p v-if="logoErrorMessage" class="error" role="alert">{{ logoErrorMessage }}</p>
            </div>
          </div>
        </ProfileSectionCard>
      </template>

      <template v-else-if="campus">
        <ProfileSectionCard icon="home" title="Overview">
          <div class="field-grid">
            <div class="field">
              <span class="field-label">School</span>
              <span class="field-value"><RouterLink v-if="auth.role === 'SUPER_ADMIN'" data-testid="school-link" :to="`/admin/schools/${campus.schoolId}`">{{ campus.schoolName }}</RouterLink><template v-else>{{ campus.schoolName }}</template></span>
            </div>
            <div class="field"><span class="field-label">Campus code</span><span class="field-value mono">{{ show(campus.code) }}</span></div>
            <div class="field"><span class="field-label">Campus type</span><span class="field-value">{{ show(campus.campusType) }}</span></div>
            <div class="field"><span class="field-label">Opening date</span><span class="field-value mono">{{ show(dateOnly(campus.openingDate)) }}</span></div>
            <div class="field"><span class="field-label">Capacity</span><span class="field-value mono">{{ show(campus.capacity) }}</span></div>
            <div class="field">
              <span class="field-label">Departments</span>
              <span class="field-value">{{ campus.departments.length ? campus.departments.join(', ') : '—' }}</span>
            </div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="chat" title="Contact & location">
          <div class="field-grid">
            <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(campus.phone) }}</span></div>
            <div class="field"><span class="field-label">Alternate phone</span><span class="field-value mono">{{ show(campus.alternatePhone) }}</span></div>
            <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(campus.email) }}</span></div>
            <div class="field"><span class="field-label">Address</span><span class="field-value address-block">{{ show(campus.address) }}</span></div>
            <div class="field"><span class="field-label">Latitude</span><span class="field-value mono">{{ show(campus.latitude) }}</span></div>
            <div class="field"><span class="field-label">Longitude</span><span class="field-value mono">{{ show(campus.longitude) }}</span></div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="user-circle" title="Principal">
          <div class="field-grid">
            <div class="field"><span class="field-label">Name</span><span class="field-value">{{ show(campus.principalName) }}</span></div>
            <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(campus.principalPhone) }}</span></div>
            <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(campus.principalEmail) }}</span></div>
          </div>
        </ProfileSectionCard>
      </template>
    </template>
  </div>
</template>

<style scoped>
.org-profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.error {
  color: var(--color-destructive);
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
