<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AssessmentCategorySummary, type ClassSummary, type TermSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const classes = ref<ClassSummary[]>([]);
const terms = ref<TermSummary[]>([]);
const selectedClassId = ref('');
const selectedTermId = ref('');
const categories = ref<AssessmentCategorySummary[]>([]);
const errorMessage = ref<string | null>(null);
const weightWarning = ref<string | null>(null);

const showAddForm = ref(false);
const newName = ref('');
const newWeightPercent = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editWeightPercent = ref('');

async function loadClasses() {
  if (!auth.accessToken) return;
  try {
    classes.value = await api.listClasses(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load classes.';
  }
}

// Terms aren't fetched per-class/per-subject anywhere else in this app — they're scoped to an
// academic session (see TermsManagementView). A class already carries its own academicSessionId,
// so once a class is picked here we resolve that session and load its terms; there is no
// standalone "all terms" list endpoint.
async function loadTermsForSelectedClass() {
  if (!auth.accessToken || !selectedClassId.value) return;
  const klass = classes.value.find((c) => c.id === selectedClassId.value);
  if (!klass) return;
  try {
    terms.value = await api.listTerms(auth.accessToken, klass.academicSessionId);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load terms.';
  }
}

async function loadCategories() {
  if (!auth.accessToken || !selectedClassId.value || !selectedTermId.value) return;
  try {
    categories.value = await api.listAssessmentCategories(auth.accessToken, selectedClassId.value, selectedTermId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load assessment categories.';
  }
}

watch(selectedClassId, () => {
  selectedTermId.value = '';
  loadTermsForSelectedClass();
});
watch(selectedTermId, () => {
  loadCategories();
});

loadClasses();

async function onAdd() {
  if (
    !auth.accessToken ||
    !selectedClassId.value ||
    !selectedTermId.value ||
    !newName.value.trim() ||
    !newWeightPercent.value
  )
    return;
  errorMessage.value = null;
  weightWarning.value = null;
  isSaving.value = true;
  try {
    const created = await api.createAssessmentCategory(auth.accessToken, {
      classId: selectedClassId.value,
      termId: selectedTermId.value,
      name: newName.value.trim(),
      weightPercent: Number(newWeightPercent.value),
    });
    weightWarning.value = created.weightTotalWarning ?? null;
    newName.value = '';
    newWeightPercent.value = '';
    showAddForm.value = false;
    await loadCategories();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this category.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(category: AssessmentCategorySummary) {
  editingId.value = category.id;
  editName.value = category.name;
  editWeightPercent.value = String(category.weightPercent);
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  weightWarning.value = null;
  try {
    const updated = await api.updateAssessmentCategory(auth.accessToken, id, {
      name: editName.value.trim(),
      weightPercent: Number(editWeightPercent.value),
    });
    weightWarning.value = updated.weightTotalWarning ?? null;
    editingId.value = null;
    await loadCategories();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this category.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this category?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteAssessmentCategory(auth.accessToken, id);
    await loadCategories();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this category.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Assessment Categories</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="weightWarning" class="warning" role="alert">{{ weightWarning }}</p>

    <div class="pickers">
      <FormField
        v-model="selectedClassId"
        label="Class"
        type="select"
        data-testid="select-class"
        placeholder="Select class"
        :options="classes.map((c) => ({ value: c.id, label: c.name }))"
      />
      <FormField
        v-model="selectedTermId"
        label="Term"
        type="select"
        data-testid="select-term"
        placeholder="Select term"
        :options="terms.map((t) => ({ value: t.id, label: t.label }))"
      />
    </div>

    <EntityTable
      :items="categories"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'weightPercent', label: 'Weight %' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-weightPercent="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-weightPercent-${item.id}`" v-model="editWeightPercent" type="text" />
        <span v-else>{{ item.weightPercent }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
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

    <AppModal v-model="showAddForm" title="Add Assessment Category">
      <div class="inline-form">
        <FormField v-model="newName" label="Name" type="text" data-testid="add-name" placeholder="e.g. Quizzes" grow />
        <FormField v-model="newWeightPercent" label="Weight %" type="text" data-testid="add-weightPercent" placeholder="30" />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
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
.warning {
  color: var(--color-warning, #a15c00);
  margin-bottom: var(--space-3);
}
.pickers {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
</style>
