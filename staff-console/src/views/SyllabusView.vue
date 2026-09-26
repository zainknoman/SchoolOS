<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type ClassSummary,
  type SubjectSummary,
  type SyllabusDetail,
  type SyllabusSummary,
  type SyllabusUnitInput,
  type TermSummary,
} from '../lib/api';
import Button from '../components/Button.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

// BL-26 (Q2): the yearly syllabus of each subject in a class. School admins write; the class's
// teachers read. A session that has ended is history — the server marks it not editable.
const auth = useAuthStore();
const toast = useToast();
const { confirm } = useConfirm();

const canEdit = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');

const classes = ref<ClassSummary[]>([]);
const subjects = ref<SubjectSummary[]>([]);
const terms = ref<TermSummary[]>([]);
const classId = ref('');
const syllabi = ref<SyllabusSummary[]>([]);
const open = ref<SyllabusDetail | null>(null);
const errorMessage = ref<string | null>(null);
const busy = ref(false);

// Editor state (a copy of the open syllabus).
const overview = ref('');
const units = ref<SyllabusUnitInput[]>([]);
const newSubjectId = ref('');

const classOptions = computed(() =>
  classes.value.map((c) => ({ value: c.id, label: `${c.name} · ${c.academicSessionLabel} · ${c.campusName}` })),
);
const missingSubjectOptions = computed(() => {
  const have = new Set(syllabi.value.map((s) => s.subjectId));
  return subjects.value.filter((s) => s.isActive !== false && !have.has(s.id)).map((s) => ({ value: s.id, label: s.name }));
});
const termOptions = computed(() => [{ value: '', label: 'No term' }, ...terms.value.map((t) => ({ value: t.id, label: t.label }))]);
const editable = computed(() => canEdit.value && !!open.value?.editable);

function fail(err: unknown, fallback: string) {
  errorMessage.value = err instanceof Error ? err.message : fallback;
}

async function loadClasses() {
  if (!auth.accessToken) return;
  try {
    const [loadedClasses, loadedSubjects] = await Promise.all([
      api.listClasses(auth.accessToken),
      canEdit.value ? api.listSubjects(auth.accessToken) : Promise.resolve([]),
    ]);
    classes.value = loadedClasses;
    subjects.value = loadedSubjects;
  } catch (err) {
    fail(err, 'Could not load classes.');
  }
}

async function loadSyllabi() {
  if (!auth.accessToken || !classId.value) return;
  try {
    syllabi.value = await api.listSyllabi(auth.accessToken, classId.value);
  } catch (err) {
    fail(err, 'Could not load syllabi.');
  }
}

watch(classId, async () => {
  open.value = null;
  syllabi.value = [];
  terms.value = [];
  newSubjectId.value = '';
  errorMessage.value = null;
  await loadSyllabi();
  const klass = classes.value.find((c) => c.id === classId.value);
  if (canEdit.value && klass && auth.accessToken) {
    try {
      terms.value = await api.listTerms(auth.accessToken, klass.academicSessionId);
    } catch (err) {
      fail(err, 'Could not load terms.');
    }
  }
});

function show(detail: SyllabusDetail) {
  open.value = detail;
  overview.value = detail.overview ?? '';
  units.value = detail.units.map((u) => ({
    title: u.title,
    topics: u.topics,
    termId: u.termId,
    plannedStart: u.plannedStart?.slice(0, 10) ?? null,
    plannedEnd: u.plannedEnd?.slice(0, 10) ?? null,
  }));
}

async function onOpen(id: string) {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    show(await api.getSyllabus(auth.accessToken, id));
  } catch (err) {
    fail(err, 'Could not open this syllabus.');
  }
}

async function onCreate() {
  if (!auth.accessToken || !classId.value || !newSubjectId.value) return;
  errorMessage.value = null;
  busy.value = true;
  try {
    const created = await api.createSyllabus(auth.accessToken, { classId: classId.value, subjectId: newSubjectId.value });
    newSubjectId.value = '';
    await loadSyllabi();
    show(created);
    toast.success(`Syllabus for ${created.subjectName} created.`);
  } catch (err) {
    fail(err, 'Could not create this syllabus.');
  } finally {
    busy.value = false;
  }
}

function addUnit() {
  units.value.push({ title: '', topics: null, termId: null, plannedStart: null, plannedEnd: null });
}

function removeUnit(index: number) {
  units.value.splice(index, 1);
}

function moveUnit(index: number, by: -1 | 1) {
  const to = index + by;
  if (to < 0 || to >= units.value.length) return;
  const [unit] = units.value.splice(index, 1);
  if (unit) units.value.splice(to, 0, unit);
}

async function onSave() {
  if (!auth.accessToken || !open.value) return;
  if (units.value.some((u) => !u.title.trim())) {
    errorMessage.value = 'Every unit needs a title.';
    return;
  }
  errorMessage.value = null;
  busy.value = true;
  try {
    const saved = await api.updateSyllabus(auth.accessToken, open.value.id, {
      overview: overview.value.trim() || null,
      units: units.value.map((u) => ({
        title: u.title.trim(),
        topics: u.topics?.trim() || null,
        termId: u.termId || null,
        plannedStart: u.plannedStart || null,
        plannedEnd: u.plannedEnd || null,
      })),
    });
    show(saved);
    await loadSyllabi();
    toast.success('Syllabus saved.');
  } catch (err) {
    fail(err, 'Could not save this syllabus.');
  } finally {
    busy.value = false;
  }
}

async function onDelete() {
  if (!auth.accessToken || !open.value) return;
  const ok = await confirm({
    title: `Delete the ${open.value.subjectName} syllabus?`,
    message: 'Its units are removed as well. This cannot be undone.',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteSyllabus(auth.accessToken, open.value.id);
    open.value = null;
    await loadSyllabi();
    toast.success('Syllabus deleted.');
  } catch (err) {
    fail(err, 'Could not delete this syllabus.');
  }
}

function formatDate(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

onMounted(loadClasses);
</script>

<template>
  <ListPageCard icon="notebook" title="Syllabus" subtitle="Yearly plan per class and subject">
    <template #toolbar>
      <FormField
        v-model="classId"
        label="Class"
        hide-label
        type="select"
        data-testid="syllabus-class"
        placeholder="Choose a class"
        :options="classOptions"
      />
      <template v-if="canEdit && classId">
        <FormField
          v-model="newSubjectId"
          label="Subject"
          hide-label
          type="select"
          data-testid="syllabus-new-subject"
          placeholder="Add a subject's syllabus"
          :options="missingSubjectOptions"
        />
        <Button data-testid="syllabus-create" :disabled="busy || !newSubjectId" @click="onCreate">Add syllabus</Button>
      </template>
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="loadSyllabi" />

    <EmptyState v-if="!classId" icon="notebook" title="Choose a class" message="Syllabi are kept per class and subject for each session." />
    <EmptyState
      v-else-if="syllabi.length === 0"
      icon="notebook"
      title="No syllabus yet"
      :message="canEdit ? 'Add one for a subject above.' : 'Your school has not added a syllabus for this class yet.'"
    />
    <ul v-else class="subject-list" data-testid="syllabus-list">
      <li v-for="s in syllabi" :key="s.id">
        <button
          type="button"
          class="subject"
          :class="{ active: open?.id === s.id }"
          :data-testid="`syllabus-open-${s.id}`"
          @click="onOpen(s.id)"
        >
          <span class="subject-name">{{ s.subjectName }}</span>
          <span class="muted">{{ s.unitCount }} unit(s)</span>
        </button>
      </li>
    </ul>

    <section v-if="open" class="editor" data-testid="syllabus-editor">
      <header class="editor-head">
        <h3>{{ open.subjectName }} — {{ open.className }} ({{ open.sessionLabel }})</h3>
        <p v-if="!open.editable" class="muted" data-testid="syllabus-history">
          This session has ended; the syllabus is kept as history and cannot be changed.
        </p>
      </header>

      <template v-if="editable">
        <FormField v-model="overview" label="Overview" type="textarea" data-testid="syllabus-overview" />
        <ol class="units">
          <li v-for="(u, i) in units" :key="i" class="unit" :data-testid="`syllabus-unit-${i}`">
            <div class="unit-grid">
              <FormField v-model="u.title" :label="`Unit ${i + 1} title`" type="text" :data-testid="`unit-title-${i}`" />
              <FormField
                :model-value="u.termId ?? ''"
                label="Term"
                type="select"
                :options="termOptions"
                :data-testid="`unit-term-${i}`"
                @update:model-value="(v) => (u.termId = (v as string) || null)"
              />
              <FormField
                :model-value="u.plannedStart ?? ''"
                label="Planned start"
                type="date"
                @update:model-value="(v) => (u.plannedStart = (v as string) || null)"
              />
              <FormField
                :model-value="u.plannedEnd ?? ''"
                label="Planned end"
                type="date"
                @update:model-value="(v) => (u.plannedEnd = (v as string) || null)"
              />
            </div>
            <FormField
              :model-value="u.topics ?? ''"
              label="Topics"
              type="textarea"
              @update:model-value="(v) => (u.topics = (v as string) || null)"
            />
            <div class="unit-actions">
              <Button variant="secondary" :disabled="i === 0" :aria-label="`Move unit ${i + 1} up`" @click="moveUnit(i, -1)">↑</Button>
              <Button
                variant="secondary"
                :disabled="i === units.length - 1"
                :aria-label="`Move unit ${i + 1} down`"
                @click="moveUnit(i, 1)"
                >↓</Button
              >
              <Button variant="secondary" :data-testid="`unit-remove-${i}`" @click="removeUnit(i)">Remove</Button>
            </div>
          </li>
        </ol>
        <div class="editor-actions">
          <Button variant="secondary" data-testid="syllabus-add-unit" @click="addUnit">Add unit</Button>
          <Button data-testid="syllabus-save" :disabled="busy" @click="onSave">Save</Button>
          <Button variant="secondary" class="danger" data-testid="syllabus-delete" @click="onDelete">Delete</Button>
        </div>
      </template>

      <template v-else>
        <p v-if="open.overview" class="overview" data-testid="syllabus-overview-text">{{ open.overview }}</p>
        <p v-if="open.units.length === 0" class="muted">No units yet.</p>
        <ol v-else class="units read-only">
          <li v-for="u in open.units" :key="u.id" class="unit">
            <strong>{{ u.title }}</strong>
            <span v-if="u.termLabel || u.plannedStart" class="muted">
              {{ u.termLabel }}<template v-if="u.termLabel && u.plannedStart"> · </template>
              <template v-if="u.plannedStart">{{ formatDate(u.plannedStart) }} – {{ formatDate(u.plannedEnd) }}</template>
            </span>
            <p v-if="u.topics" class="topics">{{ u.topics }}</p>
          </li>
        </ol>
      </template>
    </section>
  </ListPageCard>
</template>

<style scoped>
.subject-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.subject {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.subject.active {
  border-color: var(--color-accent);
}
.subject-name {
  font-weight: 600;
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.editor {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.editor-head h3 {
  margin: 0;
}
.units {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.unit {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--space-2);
}
.unit-actions,
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.overview,
.topics {
  margin: 0;
  white-space: pre-line;
}
.danger {
  margin-left: auto;
}
</style>
