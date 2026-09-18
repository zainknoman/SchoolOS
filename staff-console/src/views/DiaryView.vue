<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type SubjectSummary, type DiaryEntrySummary } from '../lib/api';
import { detectDirection, detectLang } from '../lib/textDirection';
import DirectionalText from '../components/DirectionalText.vue';
import ListPageCard from '../components/ListPageCard.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const todayDisplay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

const sections = ref<SectionSummary[]>([]);
const subjects = ref<SubjectSummary[]>([]);
const selectedSectionId = ref('');
const selectedSubjectId = ref('');
const dueDate = ref('');
const text = ref('');
const files = ref<File[]>([]);
const entries = ref<DiaryEntrySummary[]>([]);
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
    const { suggestion } = await api.suggestDiaryDraft(auth.accessToken, draftContext.value.trim());
    text.value = text.value ? `${text.value}\n\n${suggestion}` : suggestion;
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
    [sections.value, subjects.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listSubjects(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections/subjects.';
  }
}
loadLookups();

async function loadEntries() {
  if (!auth.accessToken || !selectedSectionId.value) {
    entries.value = [];
    return;
  }
  try {
    entries.value = await api.listSectionDiary(auth.accessToken, selectedSectionId.value, month);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load diary entries.';
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  files.value = input.files ? Array.from(input.files) : [];
}

async function onPost() {
  if (!auth.accessToken || !selectedSectionId.value || !selectedSubjectId.value || !text.value) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  // Snapshot the form fields synchronously, before the upload loop's first await,
  // so later user edits to the reactive refs cannot change what gets posted.
  const accessToken = auth.accessToken;
  const sectionId = selectedSectionId.value;
  const subjectId = selectedSubjectId.value;
  const entryText = text.value;
  const entryDueDate = dueDate.value;

  try {
    const fileIds: string[] = [];
    for (const file of files.value) {
      const uploaded = await api.uploadFile(accessToken, file);
      fileIds.push(uploaded.id);
    }

    await api.createDiaryEntry(accessToken, {
      sectionId,
      subjectId,
      date: today,
      text: entryText,
      dueDate: entryDueDate || undefined,
      fileIds: fileIds.length ? fileIds : undefined,
    });

    message.value = 'Diary entry posted.';
    text.value = '';
    dueDate.value = '';
    files.value = [];
    await loadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <ListPageCard icon="notebook" title="Diary" :subtitle="todayDisplay">
    <div class="compose-card">
      <div class="field-grid">
        <label class="field">
          <span>Section</span>
          <select data-testid="section-select" v-model="selectedSectionId" :disabled="isSaving" @change="loadEntries">
            <option value="" disabled>Choose a section</option>
            <option v-for="s in sections" :key="s.id" :value="s.id">
              {{ s.className }} {{ s.name }} — {{ s.campusName }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Subject</span>
          <select data-testid="subject-select" v-model="selectedSubjectId" :disabled="isSaving">
            <option value="" disabled>Choose a subject</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>Due date (optional)</span>
          <input data-testid="due-date" type="date" v-model="dueDate" :disabled="isSaving" />
        </label>

        <label class="field">
          <span>Attachments (optional)</span>
          <input data-testid="file-input" type="file" multiple :disabled="isSaving" @change="onFileChange" />
        </label>
      </div>

      <label class="field">
        <div class="field-top">
          <span>Entry</span>
          <button
            type="button"
            data-testid="suggest-draft-toggle"
            class="link-button"
            @click="showDraftPrompt = !showDraftPrompt"
          >
            Suggest draft
          </button>
        </div>
        <textarea
          data-testid="entry-text"
          v-model="text"
          rows="4"
          :dir="detectDirection(text)"
          :lang="detectLang(text)"
          :disabled="isSaving"
        ></textarea>
      </label>

      <div v-if="showDraftPrompt" class="draft-prompt">
        <label class="field">
          <span>What's this entry about?</span>
          <input
            data-testid="draft-context-input"
            v-model="draftContext"
            type="text"
            placeholder="e.g. Homework reminder for chapter 4"
          />
        </label>
        <Button :disabled="isSuggesting || !draftContext.trim()" data-testid="draft-context-submit" @click="onSuggestDraft">
          {{ isSuggesting ? 'Generating…' : 'Generate' }}
        </Button>
      </div>

      <p v-if="message" class="success" data-testid="success">{{ message }}</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <Button
        data-testid="post-entry"
        :disabled="isSaving || !selectedSectionId || !selectedSubjectId || !text"
        @click="onPost"
      >
        {{ isSaving ? 'Posting…' : 'Post entry' }}
      </Button>
    </div>

    <div v-if="entries.length" class="entries-card">
      <h2>This section's entries</h2>
      <div v-for="entry in entries" :key="entry.id" class="entry-row">
        <div class="entry-title">
          <strong :dir="detectDirection(entry.subject)" :lang="detectLang(entry.subject)">{{ entry.subject }}</strong>
          <span class="muted">· {{ entry.date }}<template v-if="entry.dueDate"> (due {{ entry.dueDate }})</template></span>
        </div>
        <DirectionalText :text="entry.text" class="entry-text" />
      </div>
    </div>
  </ListPageCard>
</template>

<style scoped>
.compose-card,
.entries-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.entries-card h2 {
  margin: 0;
  font-size: var(--font-size-base);
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
.field-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
select,
input,
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}
.link-button {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
}
.draft-prompt {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}
.entry-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.entry-row:last-child {
  border-bottom: none;
}
.entry-title {
  font-weight: 700;
  font-size: var(--font-size-sm);
}
.muted {
  color: var(--color-muted);
  font-weight: 400;
}
.entry-text {
  font-size: var(--font-size-sm);
  margin-top: 0.2rem;
}
</style>
