<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type NewStaffInput, type StaffAdminSummary } from '../lib/api';
import { EMPLOYEE_TYPE_OPTIONS, EMPLOYMENT_STATUS_OPTIONS } from '../lib/staff-profile.constants.ts';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const toast = useToast();
const { confirm } = useConfirm();

const staff = ref<StaffAdminSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);
const selectedEmployeeType = ref('');
// BL-07: archived staff are hidden; this toggle lists only them (with a Restore action).
const showArchived = ref(false);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    [staff.value, campuses.value] = await Promise.all([
      api.listAdminStaff(auth.accessToken, selectedEmployeeType.value || undefined, showArchived.value),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load staff.';
  }
}
load();

// --- Edit / Delete ------------------------------------------------------------------------------
const editingId = ref<string | null>(null);
const editName = ref('');
const editStatus = ref<StaffAdminSummary['employmentStatus']>('ACTIVE');

function startEdit(member: StaffAdminSummary) {
  editingId.value = member.id;
  editName.value = member.name;
  editStatus.value = member.employmentStatus;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateStaff(auth.accessToken, id, { name: editName.value.trim(), employmentStatus: editStatus.value });
    editingId.value = null;
    await load();
    toast.success('Staff member updated.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this staff member.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (
    !(await confirm({
      title: 'Archive this staff member?',
      message:
        'They leave the staff list; a teacher is removed from classes and the timetable and their login is disabled. All records are kept; you can restore them from "Show archived".',
      danger: true,
    }))
  )
    return;
  errorMessage.value = null;
  try {
    await api.deleteStaff(auth.accessToken, id);
    await load();
    toast.success('Staff member archived.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not archive this staff member.';
  }
}

async function onToggleArchived() {
  showArchived.value = !showArchived.value;
  await load();
}

async function onRestore(id: string) {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    await api.unarchiveRecord(auth.accessToken, 'staff', id);
    await load();
    toast.success('Staff member restored. Re-enable their login separately if needed.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not restore this staff member.';
  }
}

// --- Add New Staff --------------------------------------------------------------------------
const showAddForm = ref(false);
const isSaving = ref(false);
const addErrorMessage = ref<string | null>(null);

const newStaff = reactive({
  name: '',
  employeeType: '',
  campusId: '',
  dateOfBirth: '',
  cnic: '',
  mobile: '',
  email: '',
  joiningDate: '',
  loginIdentifier: '',
  loginPassword: '',
});

function resetAddForm() {
  newStaff.name = '';
  newStaff.employeeType = '';
  newStaff.campusId = '';
  newStaff.dateOfBirth = '';
  newStaff.cnic = '';
  newStaff.mobile = '';
  newStaff.email = '';
  newStaff.joiningDate = '';
  newStaff.loginIdentifier = '';
  newStaff.loginPassword = '';
  addErrorMessage.value = null;
}

function openAddForm() {
  resetAddForm();
  showAddForm.value = true;
}

async function onAdd() {
  if (!auth.accessToken || !newStaff.name.trim() || !newStaff.employeeType || !newStaff.campusId) return;
  if (newStaff.employeeType === 'TEACHER' && (!newStaff.loginIdentifier.trim() || !newStaff.loginPassword)) {
    addErrorMessage.value = 'Login email and initial password are required for a Teacher.';
    return;
  }
  addErrorMessage.value = null;
  isSaving.value = true;
  try {
    const payload: NewStaffInput = {
      name: newStaff.name.trim(),
      employeeType: newStaff.employeeType as NewStaffInput['employeeType'],
      campusId: newStaff.campusId,
      dateOfBirth: newStaff.dateOfBirth || undefined,
      cnic: newStaff.cnic.trim() || undefined,
      mobile: newStaff.mobile.trim() || undefined,
      email: newStaff.email.trim() || undefined,
      joiningDate: newStaff.joiningDate || undefined,
      ...(newStaff.employeeType === 'TEACHER'
        ? { login: { identifier: newStaff.loginIdentifier.trim(), password: newStaff.loginPassword } }
        : {}),
    };
    await api.createStaff(auth.accessToken, payload);
    showAddForm.value = false;
    await load();
    toast.success('Staff member added.');
  } catch (err) {
    addErrorMessage.value = err instanceof Error ? err.message : 'Could not create this staff member.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <ListPageCard icon="briefcase" title="Staff">
    <template #actions>
      <Button variant="secondary" data-testid="toggle-archived" @click="onToggleArchived">
        {{ showArchived ? 'Show active' : 'Show archived' }}
      </Button>
      <Button data-testid="open-add-form" @click="openAddForm">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="filter-row">
      <FormField
        v-model="selectedEmployeeType"
        label="Employee type"
        hide-label
        type="select"
        data-testid="filter-employee-type"
        placeholder="All employee types"
        :options="EMPLOYEE_TYPE_OPTIONS"
        @update:model-value="load"
      />
    </div>

    <EntityTable
      :items="staff"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'employeeType', label: 'Employee Type' },
        { key: 'employmentStatus', label: 'Status' },
        { key: 'campusName', label: 'Campus' },
      ]"
      row-key="id"
      :editing-id="editingId"
      empty-icon="users"
      empty-title="No staff yet"
      empty-message="Add teachers and other staff members to get started."
      empty-cta-label="+ Add New"
      @empty-cta="openAddForm"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-employmentStatus="{ item, editing }">
        <select v-if="editing" :data-testid="`edit-status-${item.id}`" v-model="editStatus">
          <option v-for="opt in EMPLOYMENT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <span v-else>{{ item.employmentStatus }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`view-profile-${item.id}`" :to="`/admin/staff/${item.id}`">View Profile</Button>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button v-if="showArchived" variant="secondary" :data-testid="`restore-${item.id}`" @click="onRestore(item.id)">Restore</Button>
          <Button v-else variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">Archive</Button>
        </template>
      </template>
    </EntityTable>

    <AppModal v-model="showAddForm" title="Add Staff">
      <div class="add-form">
        <p v-if="addErrorMessage" class="error" role="alert">{{ addErrorMessage }}</p>
        <div class="form-grid">
          <FormField v-model="newStaff.name" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
          <FormField
            v-model="newStaff.employeeType"
            label="Employee type"
            type="select"
            data-testid="add-employee-type"
            placeholder="Select employee type"
            :options="EMPLOYEE_TYPE_OPTIONS"
          />
          <FormField
            v-model="newStaff.campusId"
            label="Campus"
            type="select"
            data-testid="add-campus"
            placeholder="Select a campus"
            :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
          />
          <FormField v-model="newStaff.dateOfBirth" label="Date of birth" type="date" data-testid="add-dob" />
          <FormField v-model="newStaff.cnic" label="CNIC" type="text" data-testid="add-cnic" placeholder="CNIC" />
          <FormField v-model="newStaff.mobile" label="Mobile" type="text" data-testid="add-mobile" placeholder="Mobile" />
          <FormField v-model="newStaff.email" label="Email" type="email" data-testid="add-email" placeholder="Email" />
          <FormField v-model="newStaff.joiningDate" label="Joining date" type="date" data-testid="add-joining-date" />
        </div>

        <div v-if="newStaff.employeeType === 'TEACHER'" class="login-section">
          <h3>Login credentials</h3>
          <p class="hint">Required for a Teacher — this creates their staff-console login.</p>
          <div class="form-grid">
            <FormField
              v-model="newStaff.loginIdentifier"
              label="Login email"
              type="text"
              data-testid="add-login-identifier"
              placeholder="Login email"
            />
            <FormField
              v-model="newStaff.loginPassword"
              label="Initial password"
              type="password"
              data-testid="add-login-password"
              placeholder="Initial password"
            />
          </div>
        </div>

        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.filter-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
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
.login-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-2);
}
.login-section h3 {
  font-size: var(--font-size-sm);
  margin-bottom: 0.2rem;
}
.hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin-bottom: var(--space-2);
}
</style>
