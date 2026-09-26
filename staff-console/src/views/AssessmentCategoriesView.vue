<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type AssessmentCategorySummary,
  type ClassSummary,
  type ResultPublicationStatus,
  type TermSummary,
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

const classes = ref<ClassSummary[]>([]);
const terms = ref<TermSummary[]>([]);
const selectedClassId = ref('');
const selectedTermId = ref('');
const categories = ref<AssessmentCategorySummary[]>([]);
const errorMessage = ref<string | null>(null);
const weightWarning = ref<string | null>(null);
// BL-27: publication status of the selected class/term (weights must total 100 % to publish).
const publication = ref<ResultPublicationStatus | null>(null);
const isPublishing = ref(false);

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
    publication.value = await api.getResultPublication(auth.accessToken, selectedClassId.value, selectedTermId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load assessment categories.';
  }
}

async function onTogglePublication() {
  if (!auth.accessToken || !publication.value) return;
  const publishing = !publication.value.published;
  if (
    !publishing &&
    !(await confirm({
      title: 'Unpublish these results?',
      message: 'Parents will no longer see them until they are published again.',
    }))
  )
    return;
  errorMessage.value = null;
  isPublishing.value = true;
  try {
    publication.value = publishing
      ? await api.publishResults(auth.accessToken, selectedClassId.value, selectedTermId.value)
      : await api.unpublishResults(auth.accessToken, selectedClassId.value, selectedTermId.value);
    toast.success(publishing ? 'Results published.' : 'Results unpublished.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not change the publication.';
  } finally {
    isPublishing.value = false;
  }
}

watch(selectedClassId, () => {
  selectedTermId.value = '';
  publication.value = null;
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
    toast.success('Assessment category added.');
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
    toast.success('Assessment category updated.');
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
    toast.success('Assessment category deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this category.';
  }
}
</script>

<template>
  <ListPageCard icon="grid" title="Assessment Categories">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
    <template #toolbar>
      <FormField
        v-model="selectedClassId"
        label="Class"
        hide-label
        type="select"
        data-testid="select-class"
        placeholder="Select class"
        :options="classes.map((c) => ({ value: c.id, label: c.name }))"
      />
      <FormField
        v-model="selectedTermId"
        label="Term"
        hide-label
        type="select"
        data-testid="select-term"
        placeholder="Select term"
        :options="terms.map((t) => ({ value: t.id, label: t.label }))"
      />
    </template>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="weightWarning" class="warning" role="alert">{{ weightWarning }}</p>

    <div v-if="publication" class="publication" data-testid="publication-panel">
      <div>
        <strong v-if="publication.published" data-testid="publication-state">
          Published<template v-if="publication.scaleName"> · {{ publication.scaleName }}</template>
        </strong>
        <strong v-else data-testid="publication-state">Not published</strong>
        <span class="muted"> · weights total {{ publication.weightTotal }}%</span>
        <ul v-if="publication.blockers.length" class="blockers" data-testid="publication-blockers">
          <li v-for="b in publication.blockers" :key="b">{{ b }}</li>
        </ul>
        <p v-if="publication.published" class="muted">
          Categories and assessments are locked while published; marks can still be entered.
        </p>
      </div>
      <Button
        data-testid="publication-toggle"
        :variant="publication.published ? 'secondary' : 'primary'"
        :disabled="isPublishing || (!publication.published && publication.blockers.length > 0)"
        @click="onTogglePublication"
      >
        {{ publication.published ? 'Unpublish results' : 'Publish results' }}
      </Button>
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
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
}
.warning {
  background: var(--color-status-warning-tint);
  color: var(--color-late);
  font-weight: 600;
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}
.publication {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
.publication p,
.blockers {
  margin: var(--space-1) 0 0;
}
.blockers {
  padding-left: var(--space-4);
  color: var(--color-late);
  font-size: var(--font-size-sm);
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
</style>
