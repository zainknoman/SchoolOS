<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type BulkImportEntity, type BulkImportPreviewResult } from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();

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
  <div class="bulk-import">
    <h1>Bulk Import</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="sampleErrorMessage" class="error" role="alert">{{ sampleErrorMessage }}</p>
    <p v-if="successMessage" class="success" role="status">
      {{ successMessage }}
      <br />
      Any newly created accounts should use Forgot Password to set their own password.
    </p>

    <div class="picker-row">
      <FormField
        v-model="selectedEntity"
        label="Entity"
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
      <Button data-testid="commit-submit" :disabled="isBusy || !canCommit" @click="onCommit">Commit</Button>
    </div>
    <p class="hint">Download the sample file for your chosen entity and follow the same column format when uploading.</p>

    <table v-if="preview" class="preview-table" data-testid="preview-table">
      <thead>
        <tr>
          <th>Line</th>
          <th>Data</th>
          <th>Errors</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in preview.rows" :key="row.line" :class="{ 'row-error': row.errors.length > 0 }">
          <td>{{ row.line }}</td>
          <td>{{ Object.values(row.data).join(', ') }}</td>
          <td class="errors">{{ row.errors.join('; ') }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="preview" class="summary">
      {{ preview.validCount }} valid, {{ preview.errorCount }} with errors.
    </p>
  </div>
</template>

<style scoped>
.bulk-import {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.picker-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}
.hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin-bottom: var(--space-3);
}
.file-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--font-size-sm);
}
.preview-table {
  width: 100%;
  border-collapse: collapse;
}
.preview-table th,
.preview-table td {
  text-align: left;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.row-error {
  background: color-mix(in srgb, var(--color-destructive) 10%, transparent);
}
.errors {
  color: var(--color-destructive);
}
.summary {
  margin-top: var(--space-2);
  color: var(--color-muted);
}
</style>
