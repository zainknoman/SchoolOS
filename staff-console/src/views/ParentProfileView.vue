<!-- staff-console/src/views/ParentProfileView.vue -->
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type ParentAddressDetail, type ParentProfileDetail, type UpdateParentInput } from '../lib/api';
import { GENDER_OPTIONS } from '../lib/student-profile.constants';
import OrgProfileHeader from '../components/OrgProfileHeader.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const route = useRoute();
const toast = useToast();
const parentId = route.params.id as string;

const profile = ref<ParentProfileDetail | null>(null);
const pageError = ref<string | null>(null);
const formError = ref<string | null>(null);
const isEditing = ref(false);
const isSaving = ref(false);

const form = reactive({
  name: '',
  phone: '',
  alternatePhone: '',
  whatsappNumber: '',
  email: '',
  cnic: '',
  gender: '',
  dateOfBirth: '',
  occupation: '',
  employerName: '',
  designation: '',
  currentLine1: '',
  currentArea: '',
  currentCity: '',
  permanentLine1: '',
  permanentArea: '',
  permanentCity: '',
});

async function load() {
  if (!auth.accessToken) return;
  pageError.value = null;
  try {
    profile.value = await api.getParentProfile(auth.accessToken, parentId);
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : 'Could not load this parent.';
  }
}
load();

function startEdit() {
  const p = profile.value;
  if (!p) return;
  Object.assign(form, {
    name: p.name,
    phone: p.phone ?? '',
    alternatePhone: p.alternatePhone ?? '',
    whatsappNumber: p.whatsappNumber ?? '',
    email: p.email ?? '',
    cnic: p.cnic ?? '',
    gender: p.gender ?? '',
    dateOfBirth: p.dateOfBirth ?? '',
    occupation: p.occupation ?? '',
    employerName: p.employerName ?? '',
    designation: p.designation ?? '',
    currentLine1: p.currentAddress?.line1 ?? '',
    currentArea: p.currentAddress?.area ?? '',
    currentCity: p.currentAddress?.city ?? '',
    permanentLine1: p.permanentAddress?.line1 ?? '',
    permanentArea: p.permanentAddress?.area ?? '',
    permanentCity: p.permanentAddress?.city ?? '',
  });
  formError.value = null;
  isEditing.value = true;
}

function addressPayload(line1: string, area: string, city: string) {
  if (!line1.trim()) return undefined;
  return { line1: line1.trim(), ...(area.trim() ? { area: area.trim() } : {}), ...(city.trim() ? { city: city.trim() } : {}) };
}

async function onSave() {
  if (!auth.accessToken || !form.name.trim()) {
    formError.value = 'Name is required.';
    return;
  }
  formError.value = null;
  isSaving.value = true;
  try {
    const payload: UpdateParentInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      alternatePhone: form.alternatePhone.trim(),
      whatsappNumber: form.whatsappNumber.trim(),
      cnic: form.cnic.trim(),
      occupation: form.occupation.trim(),
      employerName: form.employerName.trim(),
      designation: form.designation.trim(),
      // Email / gender / date are validated server-side, so an empty value is simply not sent.
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
      currentAddress: addressPayload(form.currentLine1, form.currentArea, form.currentCity),
      permanentAddress: addressPayload(form.permanentLine1, form.permanentArea, form.permanentCity),
    };
    await api.updateParent(auth.accessToken, parentId, payload);
    isEditing.value = false;
    await load();
    toast.success('Parent updated.');
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not save this parent.';
  } finally {
    isSaving.value = false;
  }
}

async function onToggle(studentId: string, field: 'isPrimary' | 'isEmergencyContact', value: boolean) {
  if (!auth.accessToken) return;
  formError.value = null;
  try {
    profile.value = await api.updateParentChildLink(auth.accessToken, parentId, studentId, { [field]: value });
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not update this link.';
  }
}

const show = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v);
const addressText = (a: ParentAddressDetail | null) =>
  a ? [a.line1, a.line2, a.area, a.city, a.province].filter(Boolean).join(', ') : null;
const genderLabel = (g: string | null) => GENDER_OPTIONS.find((o) => o.value === g)?.label ?? null;

const stats = computed(() => [{ label: 'Children', value: profile.value?.childrenCount ?? 0 }]);
const chips = computed(() => [profile.value?.identifier].filter((v): v is string => !!v));
</script>

<template>
  <div class="org-profile">
    <ErrorRetry v-if="pageError" :message="pageError" @retry="load" />

    <template v-if="profile">
      <OrgProfileHeader
        :name="profile.name"
        status-label="Parent"
        status-tone="info"
        back-to="/admin/parents"
        back-label="Parents"
        :chips="chips"
        :stats="stats"
      >
        <template #actions>
          <Button v-if="!isEditing" variant="secondary" data-testid="edit-profile" @click="startEdit">Edit</Button>
        </template>
      </OrgProfileHeader>

      <p v-if="formError" class="error" role="alert" data-testid="profile-error">{{ formError }}</p>

      <ProfileSectionCard icon="user-circle" title="Personal & contact">
        <div v-if="!isEditing" class="field-grid">
          <div class="field"><span class="field-label">Full name</span><span class="field-value">{{ profile.name }}</span></div>
          <div class="field"><span class="field-label">CNIC</span><span class="field-value mono">{{ show(profile.cnic) }}</span></div>
          <div class="field"><span class="field-label">Gender</span><span class="field-value">{{ show(genderLabel(profile.gender)) }}</span></div>
          <div class="field"><span class="field-label">Date of birth</span><span class="field-value mono">{{ show(profile.dateOfBirth) }}</span></div>
          <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(profile.phone) }}</span></div>
          <div class="field"><span class="field-label">Alternate phone</span><span class="field-value mono">{{ show(profile.alternatePhone) }}</span></div>
          <div class="field"><span class="field-label">WhatsApp</span><span class="field-value mono">{{ show(profile.whatsappNumber) }}</span></div>
          <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(profile.email) }}</span></div>
        </div>
        <div v-else class="form-grid">
          <FormField v-model="form.name" label="Full name" type="text" data-testid="edit-name" />
          <FormField v-model="form.cnic" label="CNIC" type="text" data-testid="edit-cnic" />
          <FormField v-model="form.gender" label="Gender" type="select" placeholder="Select" :options="GENDER_OPTIONS" data-testid="edit-gender" />
          <FormField v-model="form.dateOfBirth" label="Date of birth" type="date" data-testid="edit-dob" />
          <FormField v-model="form.phone" label="Phone" type="text" data-testid="edit-phone" />
          <FormField v-model="form.alternatePhone" label="Alternate phone" type="text" data-testid="edit-alt-phone" />
          <FormField v-model="form.whatsappNumber" label="WhatsApp" type="text" data-testid="edit-whatsapp" />
          <FormField v-model="form.email" label="Email" type="email" data-testid="edit-email" />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="briefcase" title="Occupation">
        <div v-if="!isEditing" class="field-grid">
          <div class="field"><span class="field-label">Occupation</span><span class="field-value">{{ show(profile.occupation) }}</span></div>
          <div class="field"><span class="field-label">Employer</span><span class="field-value">{{ show(profile.employerName) }}</span></div>
          <div class="field"><span class="field-label">Designation</span><span class="field-value">{{ show(profile.designation) }}</span></div>
        </div>
        <div v-else class="form-grid">
          <FormField v-model="form.occupation" label="Occupation" type="text" data-testid="edit-occupation" />
          <FormField v-model="form.employerName" label="Employer" type="text" data-testid="edit-employer" />
          <FormField v-model="form.designation" label="Designation" type="text" data-testid="edit-designation" />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="home" title="Addresses">
        <div v-if="!isEditing" class="field-grid">
          <div class="field"><span class="field-label">Current address</span><span class="field-value address-block">{{ show(addressText(profile.currentAddress)) }}</span></div>
          <div class="field"><span class="field-label">Permanent address</span><span class="field-value address-block">{{ show(addressText(profile.permanentAddress)) }}</span></div>
        </div>
        <div v-else class="form-grid">
          <FormField v-model="form.currentLine1" label="Current address" type="text" data-testid="edit-current-line1" />
          <FormField v-model="form.currentArea" label="Area" type="text" />
          <FormField v-model="form.currentCity" label="City" type="text" />
          <FormField v-model="form.permanentLine1" label="Permanent address" type="text" data-testid="edit-permanent-line1" />
          <FormField v-model="form.permanentArea" label="Area" type="text" />
          <FormField v-model="form.permanentCity" label="City" type="text" />
        </div>
      </ProfileSectionCard>

      <div v-if="isEditing" class="edit-actions">
        <Button data-testid="save-profile" :disabled="isSaving" @click="onSave">Save changes</Button>
        <Button variant="secondary" :disabled="isSaving" @click="isEditing = false">Cancel</Button>
      </div>

      <ProfileSectionCard icon="users" title="Children">
        <p v-if="profile.children.length === 0" class="muted" data-testid="no-children">No children linked to this parent.</p>
        <table v-else class="children-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Relationship</th>
              <th>Primary guardian</th>
              <th>Emergency contact</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="child in profile.children" :key="child.studentId">
              <td>
                <RouterLink :to="`/admin/students/${child.studentId}`">{{ child.studentName }}</RouterLink>
                <span class="muted mono"> {{ child.grNumber }}</span>
              </td>
              <td>{{ child.className ? `${child.className} ${child.sectionName ?? ''}` : '—' }}</td>
              <td>{{ child.relationship }}</td>
              <td>
                <input
                  type="checkbox"
                  :data-testid="`primary-${child.studentId}`"
                  :checked="child.isPrimary"
                  :aria-label="`Primary guardian for ${child.studentName}`"
                  @change="onToggle(child.studentId, 'isPrimary', ($event.target as HTMLInputElement).checked)"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  :data-testid="`emergency-${child.studentId}`"
                  :checked="child.isEmergencyContact"
                  :aria-label="`Emergency contact for ${child.studentName}`"
                  @change="onToggle(child.studentId, 'isEmergencyContact', ($event.target as HTMLInputElement).checked)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </ProfileSectionCard>
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
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}
.edit-actions {
  display: flex;
  gap: var(--space-2);
}
.children-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.children-table th {
  text-align: left;
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
}
.children-table td {
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  border-top: 1px solid var(--color-border);
}
</style>
