<!-- staff-console/src/views/ParentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ParentSummary } from '../lib/api';
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
