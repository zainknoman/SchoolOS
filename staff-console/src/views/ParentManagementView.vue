<!-- staff-console/src/views/ParentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ParentSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const parents = ref<ParentSummary[]>([]);
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

async function load() {
  if (!auth.accessToken) return;
  try {
    parents.value = await api.listAdminParents(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load parents.';
  }
}
load();

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
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this parent.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Parents</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="parents"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'identifier', label: 'Login' },
        { key: 'phone', label: 'Phone' },
        { key: 'childrenCount', label: 'Children' },
      ]"
      row-key="id"
      :editing-id="editingId"
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
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <AppModal v-model="showAddForm" title="Add Parent">
      <div class="inline-form">
        <FormField v-model="newIdentifier" label="Login email" type="text" data-testid="add-identifier" placeholder="Login email" grow />
        <FormField v-model="newPassword" label="Initial password" type="password" data-testid="add-password" placeholder="Initial password" grow />
        <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
        <FormField v-model="newPhone" label="Phone" type="text" data-testid="add-phone" placeholder="Phone (optional)" grow />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 960px;
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
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
