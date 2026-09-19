<!-- staff-console/src/views/SchoolProfileView.vue -->
<!-- One screen for viewing, editing and adding a school (`/admin/schools/new` has no :id), so the
     three modes look identical — there is no separate edit/add popup. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type OrgStatus, type SchoolSummary } from '../lib/api';
import OrgProfileHeader from '../components/OrgProfileHeader.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const schoolId = computed(() => (route.params.id as string | undefined) ?? null);
const isNew = computed(() => schoolId.value === null);

const school = ref<SchoolSummary | null>(null);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);
const saveErrorMessage = ref<string | null>(null);
const isEditing = ref(isNew.value);
const isSaving = ref(false);

function emptyForm() {
  return {
    name: '', code: '', status: 'ACTIVE', address: '', phone: '', alternatePhone: '', email: '', website: '',
    principalName: '', principalPhone: '', principalEmail: '', registrationNumber: '', establishedDate: '',
    schoolType: '', educationBoard: '', timezone: '', currency: '', logoFileId: null as string | null,
  };
}
const form = reactive(emptyForm());

function fillForm(s: SchoolSummary | null) {
  Object.assign(form, emptyForm());
  if (!s) return;
  Object.assign(form, {
    name: s.name, code: s.code ?? '', status: s.status ?? 'ACTIVE', address: s.address ?? '', phone: s.phone ?? '',
    alternatePhone: s.alternatePhone ?? '', email: s.email ?? '', website: s.website ?? '',
    principalName: s.principalName ?? '', principalPhone: s.principalPhone ?? '', principalEmail: s.principalEmail ?? '',
    registrationNumber: s.registrationNumber ?? '', establishedDate: s.establishedDate ? s.establishedDate.slice(0, 10) : '',
    schoolType: s.schoolType ?? '', educationBoard: s.educationBoard ?? '', timezone: s.timezone ?? '',
    currency: s.currency ?? '', logoFileId: s.logoFileId ?? null,
  });
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
  fillForm(school.value);
  clearLogoPreview();
  saveErrorMessage.value = null;
  isEditing.value = true;
}

function cancelEdit() {
  if (isNew.value) {
    router.push('/admin/schools');
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

async function onSave() {
  if (!auth.accessToken || !form.name.trim()) return;
  saveErrorMessage.value = null;
  isSaving.value = true;
  try {
    if (isNew.value) {
      await api.createSchool(auth.accessToken, buildPayload());
      toast.success('School added.');
      router.push('/admin/schools');
    } else {
      await api.updateSchool(auth.accessToken, schoolId.value!, buildPayload());
      await load();
      clearLogoPreview();
      isEditing.value = false;
      toast.success('School updated.');
    }
  } catch (err) {
    saveErrorMessage.value = err instanceof Error ? err.message : `Could not ${isNew.value ? 'create' : 'update'} this school.`;
  } finally {
    isSaving.value = false;
  }
}

async function load() {
  if (isNew.value) {
    fillForm(null);
    isEditing.value = true;
    return;
  }
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    // No single-school endpoint exists — the list already carries every field this page shows.
    const [schools, allCampuses] = await Promise.all([
      api.listSchools(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
    const found = schools.find((s) => s.id === schoolId.value) ?? null;
    if (!found) {
      errorMessage.value = 'School not found.';
      return;
    }
    school.value = found;
    campuses.value = allCampuses.filter((c) => c.schoolId === schoolId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this school.';
  }
}
load();
// The list's "Edit" link opens this screen straight into edit mode.
if (route.query?.edit === '1') watch(school, (v) => v && !isEditing.value && startEdit(), { once: true });

const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : value);
const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : null);

const chips = computed(() =>
  [school.value?.code, school.value?.schoolType, school.value?.educationBoard].filter((v): v is string => !!v),
);
const stats = computed(() => [
  { label: 'Campuses', value: school.value?.campusCount ?? 0 },
  { label: 'Students', value: school.value?.studentCount ?? 0 },
  { label: 'Staff', value: school.value?.staffCount ?? 0 },
]);
// Edit mode shows the just-picked preview; view mode shows the saved logo. No logo → initials.
const headerLogoUrl = computed(() => {
  if (isEditing.value) return displayLogoUrl.value;
  return school.value?.logoFileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, school.value.logoFileId) : null;
});
const headerStatus = computed(() => (isEditing.value ? form.status : school.value?.status) ?? 'ACTIVE');
</script>

<template>
  <div class="org-profile">
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <template v-if="school || isNew">
      <OrgProfileHeader
        :name="isEditing ? form.name || 'New school' : school!.name"
        :status-label="headerStatus === 'ACTIVE' ? 'Active' : 'Inactive'"
        :status-tone="headerStatus === 'ACTIVE' ? 'success' : 'neutral'"
        back-to="/admin/schools"
        back-label="Schools"
        :logo-url="headerLogoUrl"
        :chips="isNew ? [] : chips"
        :stats="isNew ? [] : stats"
      >
        <template #actions>
          <template v-if="isEditing">
            <Button variant="secondary" data-testid="cancel-edit" :disabled="isSaving" @click="cancelEdit">Cancel</Button>
            <Button :data-testid="isNew ? 'add-submit' : 'save-submit'" :disabled="isSaving || !form.name.trim()" @click="onSave">
              {{ isNew ? 'Add school' : 'Save' }}
            </Button>
          </template>
          <Button v-else data-testid="edit-profile" @click="startEdit">Edit</Button>
        </template>
      </OrgProfileHeader>
      <p v-if="saveErrorMessage" class="error" role="alert">{{ saveErrorMessage }}</p>

      <template v-if="isEditing">
        <ProfileSectionCard icon="home" title="Overview">
          <div class="field-grid">
            <FormField v-model="form.name" label="School name" type="text" data-testid="field-name" placeholder="School name" />
            <FormField v-model="form.code" label="Code" type="text" data-testid="field-code" placeholder="Code" />
            <FormField v-model="form.status" label="Status" type="select" data-testid="field-status" :options="STATUS_OPTIONS" />
            <FormField v-model="form.registrationNumber" label="Registration no." type="text" data-testid="field-registration-number" placeholder="Registration number" />
            <FormField v-model="form.schoolType" label="School type" type="text" data-testid="field-school-type" placeholder="e.g. K-12" />
            <FormField v-model="form.educationBoard" label="Education board" type="text" data-testid="field-education-board" placeholder="Education board" />
            <FormField v-model="form.establishedDate" label="Established" type="date" data-testid="field-established-date" />
            <FormField v-model="form.timezone" label="Timezone" type="text" data-testid="field-timezone" placeholder="e.g. Asia/Karachi" />
            <FormField v-model="form.currency" label="Currency" type="text" data-testid="field-currency" placeholder="e.g. PKR" />
            <FormField v-model="form.website" label="Website" type="text" data-testid="field-website" placeholder="Website" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="chat" title="Contact">
          <div class="field-grid">
            <FormField v-model="form.phone" label="Phone" type="text" data-testid="field-phone" placeholder="Phone" />
            <FormField v-model="form.alternatePhone" label="Alternate phone" type="text" data-testid="field-alternate-phone" placeholder="Alternate phone" />
            <FormField v-model="form.email" label="Email" type="email" data-testid="field-email" placeholder="Email" />
            <FormField v-model="form.address" label="Address" type="text" data-testid="field-address" placeholder="Address" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="user-circle" title="Principal">
          <div class="field-grid">
            <FormField v-model="form.principalName" label="Name" type="text" data-testid="field-principal-name" placeholder="Principal name" />
            <FormField v-model="form.principalPhone" label="Phone" type="text" data-testid="field-principal-phone" placeholder="Principal phone" />
            <FormField v-model="form.principalEmail" label="Email" type="email" data-testid="field-principal-email" placeholder="Principal email" />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="file-text" title="Logo">
          <div class="logo-row">
            <img v-if="displayLogoUrl" :src="displayLogoUrl" alt="" class="logo-preview" />
            <div>
              <label class="sr-only" for="school-logo-input">School logo</label>
              <input id="school-logo-input" type="file" accept="image/*" data-testid="field-logo-input" @change="onLogoFileSelected" />
              <p v-if="isUploadingLogo">Uploading…</p>
              <p v-if="logoErrorMessage" class="error" role="alert">{{ logoErrorMessage }}</p>
            </div>
          </div>
        </ProfileSectionCard>
      </template>

      <template v-else-if="school">
        <ProfileSectionCard icon="home" title="Overview">
          <div class="field-grid">
            <div class="field"><span class="field-label">Registration no.</span><span class="field-value mono">{{ show(school.registrationNumber) }}</span></div>
            <div class="field"><span class="field-label">School type</span><span class="field-value">{{ show(school.schoolType) }}</span></div>
            <div class="field"><span class="field-label">Education board</span><span class="field-value">{{ show(school.educationBoard) }}</span></div>
            <div class="field"><span class="field-label">Established</span><span class="field-value mono">{{ show(dateOnly(school.establishedDate)) }}</span></div>
            <div class="field"><span class="field-label">Timezone</span><span class="field-value">{{ show(school.timezone) }}</span></div>
            <div class="field"><span class="field-label">Currency</span><span class="field-value">{{ show(school.currency) }}</span></div>
            <div class="field"><span class="field-label">Website</span><span class="field-value">{{ show(school.website) }}</span></div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="chat" title="Contact">
          <div class="field-grid">
            <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(school.phone) }}</span></div>
            <div class="field"><span class="field-label">Alternate phone</span><span class="field-value mono">{{ show(school.alternatePhone) }}</span></div>
            <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(school.email) }}</span></div>
            <div class="field"><span class="field-label">Address</span><span class="field-value address-block">{{ show(school.address) }}</span></div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="user-circle" title="Principal">
          <div class="field-grid">
            <div class="field"><span class="field-label">Name</span><span class="field-value">{{ show(school.principalName) }}</span></div>
            <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(school.principalPhone) }}</span></div>
            <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(school.principalEmail) }}</span></div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon="grid" title="Campuses">
          <p v-if="campuses.length === 0" class="muted" data-testid="no-campuses">This school has no campuses yet.</p>
          <ul v-else class="campus-list">
            <li v-for="campus in campuses" :key="campus.id">
              <RouterLink :data-testid="`campus-link-${campus.id}`" :to="`/admin/campuses/${campus.id}`">{{ campus.name }}</RouterLink>
              <span class="muted mono">{{ campus.studentCount }} students · {{ campus.staffCount }} staff</span>
            </li>
          </ul>
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
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.campus-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.campus-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.campus-list li:last-child {
  border-bottom: none;
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
