<!-- staff-console/src/views/PromotionView.vue -->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type AcademicSessionSummary,
  type ClassSummary,
  type PromotionDecision,
  type PromotionDecisionInput,
  type PromotionPreviewRow,
  type SectionSummary,
} from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const classes = ref<ClassSummary[]>([]);
const sections = ref<SectionSummary[]>([]);
const academicSessions = ref<AcademicSessionSummary[]>([]);
const previewRows = ref<PromotionPreviewRow[]>([]);
const errorMessage = ref<string | null>(null);
const isLoadingPreview = ref(false);
const isExecuting = ref(false);

const sourceClassId = ref('');
const sourceSectionId = ref('');
const targetAcademicSessionId = ref('');
const bulkTargetSectionId = ref('');

interface RowDecisionState {
  decision: PromotionDecision;
  targetSectionId: string;
}
// Keyed by studentId — populated fresh every time onLoadStudents() succeeds, so it always has an
// entry for every row currently in previewRows.
const rowState = reactive<Record<string, RowDecisionState>>({});

const decisionOptions: Array<{ value: PromotionDecision; label: string }> = [
  { value: 'PROMOTED', label: 'Promoted' },
  { value: 'RETAINED', label: 'Retained' },
  { value: 'TRANSFERRED_OUT', label: 'Transferred out' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

function needsTargetSection(decision: PromotionDecision): boolean {
  return decision === 'PROMOTED' || decision === 'RETAINED';
}

async function loadReferenceData() {
  if (!auth.accessToken) return;
  try {
    [classes.value, sections.value, academicSessions.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listSections(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Could not load classes, sections and academic sessions.';
  }
}
loadReferenceData();

// SectionSummary doesn't carry classId/academicSessionId back to its owning class — only
// className/campusName — so a class's own name+campus is the only key available to match its
// sections client-side. This relies on the same "class name is unique within its campus/session"
// assumption ClassManagementView's add-class form already makes.
function sectionsForClass(klass: ClassSummary | undefined): SectionSummary[] {
  if (!klass) return [];
  return sections.value.filter((s) => s.className === klass.name && s.campusName === klass.campusName);
}

const activeSession = computed(() => academicSessions.value.find((s) => s.isActive));

// Promotions always run from the currently active session — matches ExecutePromotionDto's
// sourceAcademicSessionId, which promotions.service.ts validates every source enrollment against.
const sourceClasses = computed(() =>
  activeSession.value ? classes.value.filter((c) => c.academicSessionId === activeSession.value!.id) : [],
);

const sourceSections = computed(() =>
  sectionsForClass(sourceClasses.value.find((c) => c.id === sourceClassId.value)),
);

const targetSessionOptions = computed(() => academicSessions.value.filter((s) => !s.isActive));

const targetClasses = computed(() =>
  classes.value.filter((c) => c.academicSessionId === targetAcademicSessionId.value),
);

const targetSectionOptions = computed(() => {
  const keys = new Set(targetClasses.value.map((c) => `${c.name}||${c.campusName}`));
  return sections.value.filter((s) =>
    s.academicSessionId
      ? s.academicSessionId === targetAcademicSessionId.value
      : keys.has(`${s.className}||${s.campusName}`),
  );
});

// Shown when a target session is picked but has nothing to promote into yet.
const targetHasNoSections = computed(() => !!targetAcademicSessionId.value && targetSectionOptions.value.length === 0);
const isCopyingStructure = ref(false);

async function onCopyStructure() {
  if (!auth.accessToken || !activeSession.value || !targetAcademicSessionId.value) return;
  errorMessage.value = null;
  isCopyingStructure.value = true;
  try {
    const result = await api.copySessionStructure(
      auth.accessToken,
      targetAcademicSessionId.value,
      activeSession.value.id,
    );
    await loadReferenceData();
    toast.success(
      `Created ${result.classesCreated} class(es) and ${result.sectionsCreated} section(s) in ${targetSessionLabel.value}.`,
    );
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not copy classes and sections.';
  } finally {
    isCopyingStructure.value = false;
  }
}

const targetSessionLabel = computed(
  () => academicSessions.value.find((s) => s.id === targetAcademicSessionId.value)?.label ?? '',
);

watch(sourceClassId, () => {
  sourceSectionId.value = '';
});

// The set of valid target sections is scoped to the chosen target session, so a session change
// invalidates whatever was already picked per-row and in bulk.
watch(targetAcademicSessionId, () => {
  bulkTargetSectionId.value = '';
  for (const state of Object.values(rowState)) {
    state.targetSectionId = '';
  }
});

async function onLoadStudents() {
  if (!auth.accessToken || !sourceSectionId.value) return;
  errorMessage.value = null;
  isLoadingPreview.value = true;
  try {
    previewRows.value = await api.previewPromotions(auth.accessToken, sourceSectionId.value);
    for (const key of Object.keys(rowState)) delete rowState[key];
    for (const row of previewRows.value) {
      rowState[row.studentId] = { decision: row.suggestedDecision, targetSectionId: '' };
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students for this section.';
  } finally {
    isLoadingPreview.value = false;
  }
}

function onDecisionChanged(studentId: string, decision: PromotionDecision) {
  const state = rowState[studentId];
  if (!state) return;
  state.decision = decision;
  if (!needsTargetSection(decision)) {
    state.targetSectionId = '';
  }
}

function onApplyBulkTargetSection() {
  if (!bulkTargetSectionId.value) return;
  for (const state of Object.values(rowState)) {
    if (needsTargetSection(state.decision)) {
      state.targetSectionId = bulkTargetSectionId.value;
    }
  }
}

const allRowsValid = computed(() =>
  previewRows.value.every((row) => {
    const state = rowState[row.studentId];
    if (!state) return false;
    return !needsTargetSection(state.decision) || !!state.targetSectionId;
  }),
);

const canExecute = computed(
  () => previewRows.value.length > 0 && !!targetAcademicSessionId.value && allRowsValid.value,
);

async function onExecute() {
  if (!auth.accessToken || !activeSession.value || !targetAcademicSessionId.value) return;

  const decisions: PromotionDecisionInput[] = previewRows.value.map((row) => {
    const state = rowState[row.studentId];
    const decision = state?.decision ?? 'PROMOTED';
    return {
      studentId: row.studentId,
      decision,
      targetSectionId: needsTargetSection(decision) ? state?.targetSectionId || undefined : undefined,
    };
  });

  const confirmed = await confirm({
    title: 'Execute promotions?',
    message: `Promote/retain/withdraw ${decisions.length} student(s) into ${targetSessionLabel.value}? This cannot be undone automatically.`,
    danger: true,
  });
  if (!confirmed) return;

  errorMessage.value = null;
  isExecuting.value = true;
  try {
    await api.executePromotions(auth.accessToken, {
      sourceAcademicSessionId: activeSession.value.id,
      targetAcademicSessionId: targetAcademicSessionId.value,
      decisions,
    });
    bulkTargetSectionId.value = '';
    toast.success(`${decisions.length} student(s) promoted into ${targetSessionLabel.value}.`);
    // Re-fetch — the batch just closed every ACTIVE enrollment in the source section, so this
    // should now come back empty, confirming the batch closed.
    await onLoadStudents();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not execute this promotion batch.';
  } finally {
    isExecuting.value = false;
  }
}
</script>

<template>
  <ListPageCard
    icon="calendar"
    title="Promotions"
    :subtitle="activeSession ? `Source academic session: ${activeSession.label}` : undefined"
  >
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="pickers">
      <FormField
        v-model="sourceClassId"
        label="Source class"
        type="select"
        data-testid="select-source-class"
        placeholder="Select class"
        :options="sourceClasses.map((c) => ({ value: c.id, label: `${c.name} (${c.campusName})` }))"
      />
      <FormField
        v-model="sourceSectionId"
        label="Source section"
        type="select"
        data-testid="select-source-section"
        placeholder="Select section"
        :disabled="!sourceClassId"
        :options="sourceSections.map((s) => ({ value: s.id, label: `${s.className} ${s.name} (${s.campusName})` }))"
      />
      <FormField
        v-model="targetAcademicSessionId"
        label="Target academic session"
        type="select"
        data-testid="select-target-session"
        placeholder="Select target session"
        :options="targetSessionOptions.map((s) => ({ value: s.id, label: s.label }))"
      />
      <Button data-testid="load-students" :disabled="!sourceSectionId || isLoadingPreview" @click="onLoadStudents">
        Load students
      </Button>
    </div>

    <div v-if="targetHasNoSections" class="structure-hint" data-testid="no-target-sections">
      <p>
        {{ targetSessionLabel }} has no classes or sections yet, so there is nowhere to promote students into.
        Create them under Classes/Sections, or copy the structure from {{ activeSession?.label }}.
      </p>
      <Button
        data-testid="copy-structure"
        variant="secondary"
        :disabled="isCopyingStructure"
        @click="onCopyStructure"
      >
        Copy classes &amp; sections from {{ activeSession?.label }}
      </Button>
    </div>

    <div v-if="previewRows.length" class="bulk-assign">
      <FormField
        v-model="bulkTargetSectionId"
        label="Bulk target section"
        type="select"
        data-testid="bulk-target-section"
        placeholder="Choose a section for all promoted/retained rows"
        :disabled="!targetAcademicSessionId"
        :options="targetSectionOptions.map((s) => ({ value: s.id, label: `${s.className} ${s.name} (${s.campusName})` }))"
      />
      <Button
        data-testid="apply-bulk-target-section"
        variant="secondary"
        :disabled="!bulkTargetSectionId"
        @click="onApplyBulkTargetSection"
      >
        Apply to all promoted/retained
      </Button>
    </div>

    <EntityTable
      :items="previewRows"
      :columns="[
        { key: 'grNumber', label: 'GR Number' },
        { key: 'name', label: 'Name' },
        { key: 'currentRollNumber', label: 'Current Roll No.' },
        { key: 'decision', label: 'Decision' },
        { key: 'targetSectionId', label: 'Target Section' },
      ]"
      row-key="studentId"
      :editing-id="null"
    >
      <template #cell-currentRollNumber="{ item }">
        {{ item.currentRollNumber ?? '—' }}
      </template>
      <template #cell-decision="{ item }">
        <FormField
          :model-value="rowState[item.studentId]!.decision"
          label="Decision"
          type="select"
          :data-testid="`decision-${item.studentId}`"
          :options="decisionOptions"
          @update:model-value="(v) => onDecisionChanged(item.studentId, v as PromotionDecision)"
        />
      </template>
      <template #cell-targetSectionId="{ item }">
        <FormField
          v-model="rowState[item.studentId]!.targetSectionId"
          label="Target section"
          type="select"
          :data-testid="`target-section-${item.studentId}`"
          placeholder="Choose a target section"
          :disabled="!targetAcademicSessionId || !needsTargetSection(rowState[item.studentId]!.decision)"
          :options="targetSectionOptions.map((s) => ({ value: s.id, label: `${s.className} ${s.name} (${s.campusName})` }))"
        />
      </template>
    </EntityTable>

    <div class="execute-row">
      <Button data-testid="execute-promotions" :disabled="!canExecute || isExecuting" @click="onExecute">
        Execute
      </Button>
    </div>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
}
.pickers,
.bulk-assign {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.structure-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  background: var(--color-status-info-tint);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}
.structure-hint p {
  margin: 0;
}
.execute-row {
  display: flex;
  justify-content: flex-end;
}
</style>
