<!-- staff-console/src/views/ParentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  api,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  type ParentLookupResult,
  type ParentSummary,
  type StudentAdminSummary,
} from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const router = useRouter();
const parents = ref<ParentSummary[]>([]);

// BL-23: a parent who already has a child at another school is found by exact login or CNIC (never
// by name) and linked to one of this school's students — never created a second time.
const showFind = ref(false);
const findKey = ref('');
const found = ref<ParentLookupResult | null>(null);
const findError = ref<string | null>(null);
const findStudents = ref<StudentAdminSummary[]>([]);
const findStudentId = ref('');
const findRelationshipType = ref('');
const isFinding = ref(false);

function openFind() {
  showFind.value = true;
  findKey.value = '';
  found.value = null;
  findError.value = null;
}

async function onFind() {
  const key = findKey.value.trim();
  if (!auth.accessToken || !key) return;
  findError.value = null;
  found.value = null;
  isFinding.value = true;
  try {
    // A CNIC is digits and dashes only; anything else is a login identifier.
    found.value = await api.lookupParent(auth.accessToken, /^[\d-]+$/.test(key) && key.includes('-') ? { cnic: key } : { identifier: key });
    if (findStudents.value.length === 0) findStudents.value = await api.listAdminStudents(auth.accessToken);
  } catch (err) {
    findError.value = err instanceof Error ? err.message : 'No parent found.';
  } finally {
    isFinding.value = false;
  }
}

async function onLinkFound() {
  if (!auth.accessToken || !found.value || !findStudentId.value || !findRelationshipType.value) return;
  findError.value = null;
  isFinding.value = true;
  try {
    await api.linkParentChild(auth.accessToken, found.value.id, {
      studentId: findStudentId.value,
      relationshipType: findRelationshipType.value,
    });
    toast.success(`${found.value.name} linked.`);
    const id = found.value.id;
    showFind.value = false;
    await router.push(`/admin/parents/${id}`);
  } catch (err) {
    findError.value = err instanceof Error ? err.message : 'Could not link this parent.';
  } finally {
    isFinding.value = false;
  }
}
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const newPhone = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPhone = ref('');
const editPassword = ref('');

// BL-40: paged and searched on the server.
const PAGE_SIZE = 25;
const parentsTotal = ref(0);
const pageQuery = ref({ page: 1, q: '' });

async function load() {
  if (!auth.accessToken) return;
  try {
    const page = await api.listAdminParentsPage(auth.accessToken, {
      page: pageQuery.value.page,
      limit: PAGE_SIZE,
      q: pageQuery.value.q || undefined,
    });
    parents.value = page.items;
    parentsTotal.value = page.total;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load parents.';
  }
}
load();

async function onQuery(query: { page: number; q: string }) {
  pageQuery.value = query;
  await load();
}

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createParent(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    newPhone.value = '';
    showAddForm.value = false;
    await load();
    toast.success('Parent added.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this parent.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(parent: ParentSummary) {
  editingId.value = parent.id;
  editName.value = parent.name;
  editPhone.value = parent.phone ?? '';
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateParent(auth.accessToken, id, {
      name: editName.value.trim(),
      phone: editPhone.value.trim() || undefined,
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
    toast.success('Parent updated.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this parent.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this parent?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteParent(auth.accessToken, id);
    await load();
    toast.success('Parent deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this parent.';
  }
}
</script>

<template>
  <ListPageCard icon="user-circle" title="Parents">
    <template #actions>
      <Button variant="secondary" data-testid="open-find-parent" @click="openFind">Find existing parent</Button>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="parents"
      :server-total="parentsTotal"
      :page-size="PAGE_SIZE"
      @query="onQuery"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'identifier', label: 'Login' },
        { key: 'phone', label: 'Phone' },
        { key: 'childrenCount', label: 'Children' },
      ]"
      row-key="id"
      :editing-id="editingId"
      empty-icon="user-circle"
      empty-title="No parents yet"
      empty-message="Parent accounts are usually created while adding a student."
      empty-cta-label="+ Add New"
      @empty-cta="showAddForm = true"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-phone="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-phone-${item.id}`" v-model="editPhone" type="text" />
        <span v-else>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <input
            :data-testid="`edit-password-${item.id}`"
            v-model="editPassword"
            type="password"
            placeholder="New password"
          />
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`view-profile-${item.id}`" :to="`/admin/parents/${item.id}`">View</Button>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <AppModal v-model="showFind" title="Find existing parent">
      <p class="muted">Exact login (e-mail/mobile) or CNIC — use this when the parent already has a child at another school.</p>
      <div class="inline-form">
        <FormField v-model="findKey" label="Login or CNIC" type="text" data-testid="find-key" placeholder="e.g. 0300-1234567 or 35202-1234567-1" grow />
        <Button data-testid="find-submit" :disabled="isFinding || !findKey.trim()" @click="onFind">Find</Button>
      </div>
      <p v-if="findError" class="error" role="alert" data-testid="find-error">{{ findError }}</p>
      <div v-if="found" class="inline-form" data-testid="find-result">
        <p>
          <strong>{{ found.name }}</strong> <span class="muted">{{ found.identifier }}</span>
        </p>
        <FormField
          v-model="findStudentId"
          label="Link to student"
          type="select"
          data-testid="find-student"
          placeholder="Choose a student"
          :options="findStudents.map((s) => ({ value: s.id, label: `${s.name} (${s.grNumber})` }))"
        />
        <FormField
          v-model="findRelationshipType"
          label="Relationship"
          type="select"
          data-testid="find-relationship"
          placeholder="Choose a relationship"
          :options="GUARDIAN_RELATIONSHIP_OPTIONS"
        />
        <Button data-testid="find-link" :disabled="isFinding || !findStudentId || !findRelationshipType" @click="onLinkFound">Link</Button>
      </div>
    </AppModal>

    <AppModal v-model="showAddForm" title="Add Parent">
      <div class="inline-form">
        <FormField v-model="newIdentifier" label="Login email" type="text" data-testid="add-identifier" placeholder="Login email" grow />
        <FormField v-model="newPassword" label="Initial password" type="password" data-testid="add-password" placeholder="Initial password" grow />
        <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
        <FormField v-model="newPhone" label="Phone" type="text" data-testid="add-phone" placeholder="Phone (optional)" grow />
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
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
