<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type CircularSummary } from '../lib/api';
import { detectDirection, detectLang } from '../lib/textDirection';
import { useFocusTarget } from '../lib/useFocusTarget';

type CircularScope = 'school' | 'section';

const auth = useAuthStore();
const sections = ref<SectionSummary[]>([]);
const title = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);
useFocusTarget({ title: titleInputRef });
const description = ref('');
const scope = ref<CircularScope>('school');
const sectionId = ref('');
const files = ref<File[]>([]);
const circulars = ref<(CircularSummary & { delivered?: number; read?: number })[]>([]);
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const showDraftPrompt = ref(false);
const draftContext = ref('');
const isSuggesting = ref(false);

async function onSuggestDraft() {
  if (!auth.accessToken || !draftContext.value.trim()) return;
  isSuggesting.value = true;
  errorMessage.value = null;
  try {
    const { suggestion } = await api.suggestCircularDraft(auth.accessToken, draftContext.value.trim());
    // Appends, never overwrites — the staff member sees exactly what was added and can edit it.
    description.value = description.value ? `${description.value}\n\n${suggestion}` : suggestion;
    showDraftPrompt.value = false;
    draftContext.value = '';
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not generate a draft suggestion.';
  } finally {
    isSuggesting.value = false;
  }
}

async function loadLookups() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadLookups();

async function loadCirculars() {
  if (!auth.accessToken) return;
  try {
    const list = await api.listCirculars(auth.accessToken);
    circulars.value = await Promise.all(
      list.map(async (c) => {
        const stats = await api.circularStats(auth.accessToken!, c.id);
        return { ...c, ...stats };
      }),
    );
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load circulars.';
  }
}
loadCirculars();

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  files.value = input.files ? Array.from(input.files) : [];
}

async function onPublish() {
  if (!auth.accessToken || !title.value || !description.value) return;
  if (scope.value === 'section' && !sectionId.value) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  // Snapshot the form fields synchronously, before the upload loop's first await,
  // so later user edits to the reactive refs cannot change what gets published.
  const accessToken = auth.accessToken;
  const circularTitle = title.value;
  const circularDescription = description.value;
  const circularScope = scope.value;
  const circularSectionId = sectionId.value;

  try {
    const fileIds: string[] = [];
    for (const file of files.value) {
      const uploaded = await api.uploadFile(accessToken, file);
      fileIds.push(uploaded.id);
    }

    await api.publishCircular(accessToken, {
      title: circularTitle,
      description: circularDescription,
      scope: circularScope,
      sectionId: circularScope === 'section' ? circularSectionId : undefined,
      fileIds: fileIds.length ? fileIds : undefined,
    });

    message.value = 'Circular published.';
    title.value = '';
    description.value = '';
    files.value = [];
    await loadCirculars();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="circulars">
    <h1>Circulars</h1>

    <label class="field">
      <span>Title</span>
      <input ref="titleInputRef" data-testid="title-input" v-model="title" type="text" :disabled="isSaving" />
    </label>

    <label class="field">
      <span>Description</span>
      <textarea
        data-testid="description-input"
        v-model="description"
        rows="3"
        :disabled="isSaving"
      ></textarea>
      <button
        type="button"
        data-testid="suggest-draft-toggle"
        class="link-button"
        @click="showDraftPrompt = !showDraftPrompt"
      >
        Suggest draft
      </button>
    </label>

    <div v-if="showDraftPrompt" class="draft-prompt">
      <label class="field">
        <span>What's this circular about?</span>
        <input
          data-testid="draft-context-input"
          v-model="draftContext"
          type="text"
          placeholder="e.g. Parent-teacher meeting next Friday"
        />
      </label>
      <button
        type="button"
        data-testid="draft-context-submit"
        :disabled="isSuggesting || !draftContext.trim()"
        @click="onSuggestDraft"
      >
        {{ isSuggesting ? 'Generating…' : 'Generate' }}
      </button>
    </div>

    <label class="field">
      <span>Scope</span>
      <select data-testid="scope-select" v-model="scope" :disabled="isSaving">
        <option value="school">Whole school</option>
        <option value="section">One section</option>
      </select>
    </label>

    <label v-if="scope === 'section'" class="field">
      <span>Section</span>
      <select data-testid="section-select" v-model="sectionId" :disabled="isSaving">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <label class="field">
      <span>Attachments (optional)</span>
      <input data-testid="file-input" type="file" multiple :disabled="isSaving" @change="onFileChange" />
    </label>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      data-testid="publish-circular"
      :disabled="isSaving || !title || !description || (scope === 'section' && !sectionId)"
      @click="onPublish"
    >
      {{ isSaving ? 'Publishing…' : 'Publish circular' }}
    </button>

    <template v-if="circulars.length">
      <h2>Published circulars</h2>
      <ul class="circulars-list">
        <li v-for="c in circulars" :key="c.id">
          <strong :dir="detectDirection(c.title)" :lang="detectLang(c.title)">{{ c.title }}</strong> — {{ c.scope }}
          <span data-testid="stats">Delivered {{ c.delivered }} · Read {{ c.read }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.circulars {
  max-width: 640px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 480px;
}
select,
input,
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.link-button {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  cursor: pointer;
  text-decoration: underline;
}
.draft-prompt {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  margin-bottom: var(--space-4);
}
.draft-prompt button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
.draft-prompt button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}
button {
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.circulars-list {
  list-style: none;
  padding: 0;
  margin-top: var(--space-3);
}
.circulars-list li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.circulars-list span {
  display: block;
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
</style>
