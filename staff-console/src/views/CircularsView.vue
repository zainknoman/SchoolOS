<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type CircularSummary } from '../lib/api';
import { detectDirection, detectLang } from '../lib/textDirection';
import { useFocusTarget } from '../lib/useFocusTarget';
import ListPageCard from '../components/ListPageCard.vue';
import Button from '../components/Button.vue';

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
  <ListPageCard icon="megaphone" title="Circulars" subtitle="Compose and publish school-wide notices">
    <div class="compose-card">
      <label class="field">
        <span>Title</span>
        <input ref="titleInputRef" data-testid="title-input" v-model="title" type="text" :disabled="isSaving" />
      </label>

      <label class="field">
        <div class="field-top">
          <span>Description</span>
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
          data-testid="description-input"
          v-model="description"
          rows="3"
          :disabled="isSaving"
        ></textarea>
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
        <Button :disabled="isSuggesting || !draftContext.trim()" data-testid="draft-context-submit" @click="onSuggestDraft">
          {{ isSuggesting ? 'Generating…' : 'Generate' }}
        </Button>
      </div>

      <div class="field-grid">
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
      </div>

      <p v-if="message" class="success" data-testid="success">{{ message }}</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <Button
        data-testid="publish-circular"
        :disabled="isSaving || !title || !description || (scope === 'section' && !sectionId)"
        @click="onPublish"
      >
        {{ isSaving ? 'Publishing…' : 'Publish circular' }}
      </Button>
    </div>

    <div v-if="circulars.length" class="published-card">
      <h2>Published</h2>
      <div v-for="c in circulars" :key="c.id" class="circular-row">
        <div class="circular-title">
          <strong :dir="detectDirection(c.title)" :lang="detectLang(c.title)">{{ c.title }}</strong>
          <span class="muted">— {{ c.scope === 'school' ? 'Whole school' : 'One section' }}</span>
        </div>
        <span class="mono muted" data-testid="stats">Delivered {{ c.delivered }} · Read {{ c.read }}</span>
      </div>
    </div>
  </ListPageCard>
</template>

<style scoped>
.compose-card,
.published-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.published-card h2 {
  margin: 0;
  font-size: var(--font-size-base);
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
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
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
.circular-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.circular-row:last-child {
  border-bottom: none;
}
.circular-title {
  font-weight: 700;
  font-size: var(--font-size-sm);
}
.muted {
  color: var(--color-muted);
  font-weight: 400;
}
.circular-row .mono {
  display: block;
  font-size: var(--font-size-xs);
  margin-top: 0.2rem;
}
</style>
