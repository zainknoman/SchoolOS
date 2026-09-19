<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type BulkImportEntity, type BulkImportPreviewResult } from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useFocusTarget } from '../lib/useFocusTarget';

const auth = useAuthStore();

const entityFieldRef = ref<{ focus(): void } | null>(null);
useFocusTarget({ entity: entityFieldRef });

const selectedEntity = ref<BulkImportEntity | ''>('');
const selectedFile = ref<File | null>(null);
const preview = ref<BulkImportPreviewResult | null>(null);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const isBusy = ref(false);

const entityOptions = [
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'staff', label: 'Staff' },
];

const canCommit = computed(() => !!preview.value && preview.value.errorCount === 0 && !!selectedFile.value);
const isDownloadingSample = ref(false);
const sampleErrorMessage = ref<string | null>(null);

async function onDownloadSample() {
  if (!auth.accessToken || !selectedEntity.value) return;
  sampleErrorMessage.value = null;
  isDownloadingSample.value = true;
  try {
    await api.downloadBulkImportSample(auth.accessToken, selectedEntity.value);
  } catch (err) {
    sampleErrorMessage.value = err instanceof Error ? err.message : 'Could not download the sample file.';
  } finally {
    isDownloadingSample.value = false;
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  preview.value = null;
  successMessage.value = null;
}

async function onPreview() {
  if (!auth.accessToken || !selectedEntity.value || !selectedFile.value) return;
  errorMessage.value = null;
  successMessage.value = null;
  isBusy.value = true;
  try {
    preview.value = await api.previewBulkImport(auth.accessToken, selectedEntity.value, selectedFile.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not preview this file.';
  } finally {
    isBusy.value = false;
  }
}

async function onCommit() {
  if (!auth.accessToken || !selectedEntity.value || !selectedFile.value) return;
  errorMessage.value = null;
  isBusy.value = true;
  try {
    const result = await api.commitBulkImport(auth.accessToken, selectedEntity.value, selectedFile.value);
    successMessage.value = `${result.createdCount} record(s) imported.`;
    preview.value = null;
    selectedFile.value = null;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not import this file.';
  } finally {
    isBusy.value = false;
  }
}
</script>

<template>
  <ListPageCard icon="grid" title="Bulk Import" subtitle="Import records from a CSV file">
    <template #toolbar>
      <FormField
        ref="entityFieldRef"
        v-model="selectedEntity"
        label="Entity"
        hide-label
        type="select"
        data-testid="select-entity"
        placeholder="Choose what to import"
        :options="entityOptions"
      />
      <Button
        variant="secondary"
        data-testid="download-sample"
        :disabled="!selectedEntity || isDownloadingSample"
        @click="onDownloadSample"
      >
        Download sample file
      </Button>
      <label class="file-field">
        <span>CSV file</span>
        <input data-testid="select-file" type="file" accept=".csv,text/csv" @change="onFileChange" />
      </label>
      <Button data-testid="preview-submit" :disabled="isBusy || !selectedEntity || !selectedFile" @click="onPreview">
        Preview
      </Button>
      <Button data-testid="commit-submit" class="commit-btn" :disabled="isBusy || !canCommit" @click="onCommit">Commit</Button>
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="onPreview" />
    <ErrorRetry v-if="sampleErrorMessage" :message="sampleErrorMessage" @retry="onDownloadSample" />
    <p v-if="successMessage" class="success" role="status">
      {{ successMessage }}
      <br />
      Any newly created accounts should use Forgot Password to set their own password.
    </p>
    <p class="hint">Download the sample file for your chosen entity and follow the same column format when uploading.</p>

    <div v-if="isBusy && !preview" class="preview-skeleton" data-testid="preview-skeleton">
      <AppSkeleton v-for="n in 4" :key="n" height="1.4rem" />
    </div>

    <p v-if="preview" class="summary">{{ preview.validCount }} valid, {{ preview.errorCount }} with errors.</p>

    <div v-if="preview" class="preview-card">
      <table class="preview-table" data-testid="preview-table">
        <thead>
          <tr>
            <th class="col-line">Line</th>
            <th>Data</th>
            <th class="col-errors">Errors</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in preview.rows" :key="row.line" :class="{ 'row-error': row.errors.length > 0 }">
            <td class="mono">{{ row.line }}</td>
            <td>{{ Object.values(row.data).join(', ') }}</td>
            <td :class="row.errors.length ? 'errors' : 'muted'">{{ row.errors.length ? row.errors.join('; ') : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ListPageCard>
</template>

<style scoped>
.success {
  color: var(--color-accent);
}
.hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.file-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--font-size-sm);
}
.commit-btn {
  margin-left: auto;
}
.preview-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.preview-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.preview-table {
  width: 100%;
  border-collapse: collapse;
}
.preview-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
}
.preview-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.preview-table tbody tr:last-child td {
  border-bottom: none;
}
.col-line {
  width: 3.5rem;
}
.col-errors {
  width: 280px;
}
.row-error td {
  background: var(--color-status-critical-tint);
}
.errors {
  color: var(--color-destructive);
  font-weight: 600;
}
.muted {
  color: var(--color-muted);
}
.summary {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
</style>
