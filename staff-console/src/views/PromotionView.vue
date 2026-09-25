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
  type PromotionPolicy,
  type PromotionPreviewRow,
  type SectionSummary,
  type StudentPromotionIndicators,
} from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const classes = ref<ClassSummary[]>([]);
const sections = ref<SectionSummary[]>([]);
const academicSessions = ref<AcademicSessionSummary[]>([]);
const previewRows = ref<PromotionPreviewRow[]>([]);
// BL-05: the school of the loaded section and its promotion rules (thresholds + optional blocks).
const previewSchoolId = ref('');
const policy = reactive<PromotionPolicy>({
  minAttendancePercent: 75,
  minResultPercent: 40,
  blockOnAttendance: false,
  blockOnResults: false,
  blockOnFees: false,
});
const isSavingPolicy = ref(false);
const errorMessage = ref<string | null>(null);
const isLoadingPreview = ref(false);
const isExecuting = ref(false);

const sourceClassId = ref('');
const sourceSectionId = ref('');
const targetAcademicSessionId = ref('');
const bulkTargetSectionId = ref('');
const bulkDecision = ref<PromotionDecision | ''>('');

interface RowDecisionState {
  // BL-05 (Q5): no outcome is pre-selected — every row is the admin's explicit choice.
  decision: PromotionDecision | '';
  targetSectionId: string;
  conditions: string;
}
// Keyed by studentId — populated fresh every time onLoadStudents() succeeds, so it always has an
// entry for every row currently in previewRows.
const rowState = reactive<Record<string, RowDecisionState>>({});

const decisionOptions: Array<{ value: PromotionDecision; label: string }> = [
  { value: 'PROMOTED', label: 'Promoted' },
  { value: 'PROMOTED_WITH_CONDITIONS', label: 'Promoted with conditions' },
  { value: 'RETAINED', label: 'Retained' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

function needsTargetSection(decision: PromotionDecision | ''): boolean {
  return decision === 'PROMOTED' || decision === 'PROMOTED_WITH_CONDITIONS' || decision === 'RETAINED';
}

function percentLabel(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}
function feesLabel(ind: StudentPromotionIndicators): string {
  return ind.fees.outstanding > 0 ? `Rs ${(ind.fees.outstanding / 100).toFixed(2)} due` : 'Clear';
}
// A school-configured block stops only a plain PROMOTED decision (the API refuses it with 409).
function rowBlocked(row: PromotionPreviewRow): boolean {
  return row.indicators.blocked && rowState[row.studentId]?.decision === 'PROMOTED';
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
      `Created ${result.classesCreated} class(es), ${result.sectionsCreated} section(s), ${result.termsCreated ?? 0} term(s) ` +
        `and ${result.timetableEntriesCreated ?? 0} timetable slot(s) in ${targetSessionLabel.value}.`,
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
    const preview = await api.previewPromotions(auth.accessToken, sourceSectionId.value);
    previewRows.value = preview.rows;
    previewSchoolId.value = preview.schoolId;
    Object.assign(policy, preview.policy);
    for (const key of Object.keys(rowState)) delete rowState[key];
    for (const row of previewRows.value) {
      rowState[row.studentId] = { decision: '', targetSectionId: '', conditions: '' };
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students for this section.';
  } finally {
    isLoadingPreview.value = false;
  }
}

function onDecisionChanged(studentId: string, decision: PromotionDecision | '') {
  const state = rowState[studentId];
  if (!state) return;
  state.decision = decision;
  if (!needsTargetSection(decision)) {
    state.targetSectionId = '';
  }
  if (decision !== 'PROMOTED_WITH_CONDITIONS') {
    state.conditions = '';
  }
}
// An explicit bulk action, never a default.
function onApplyBulkDecision() {
  if (!bulkDecision.value) return;
  for (const row of previewRows.value) onDecisionChanged(row.studentId, bulkDecision.value);
}
async function onSavePolicy() {
  if (!auth.accessToken || !previewSchoolId.value) return;
  errorMessage.value = null;
  isSavingPolicy.value = true;
  try {
    Object.assign(
      policy,
      await api.updatePromotionPolicy(auth.accessToken, {
        schoolId: previewSchoolId.value,
        minAttendancePercent: Number(policy.minAttendancePercent),
        minResultPercent: Number(policy.minResultPercent),
        blockOnAttendance: policy.blockOnAttendance,
        blockOnResults: policy.blockOnResults,
        blockOnFees: policy.blockOnFees,
      }),
    );
    toast.success('Promotion rules saved.');
    // Warnings and blocks depend on the rules, so reload them (decisions made so far are kept).
    const kept = JSON.parse(JSON.stringify(rowState)) as Record<string, RowDecisionState>;
    await onLoadStudents();
    for (const [id, state] of Object.entries(kept)) if (rowState[id]) Object.assign(rowState[id], state);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the promotion rules.';
  } finally {
    isSavingPolicy.value = false;
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
    if (!state || !state.decision) return false;
    if (rowBlocked(row)) return false;
    if (state.decision === 'PROMOTED_WITH_CONDITIONS' && !state.conditions.trim()) return false;
    return !needsTargetSection(state.decision) || !!state.targetSectionId;
  }),
);
const rowsWithWarnings = computed(
  () => previewRows.value.filter((row) => row.indicators.warnings.length > 0).length,
);

const canExecute = computed(
  () => previewRows.value.length > 0 && !!targetAcademicSessionId.value && allRowsValid.value,
);

async function onExecute() {
  if (!auth.accessToken || !activeSession.value || !targetAcademicSessionId.value) return;

  const decisions: PromotionDecisionInput[] = previewRows.value.map((row) => {
    const state = rowState[row.studentId]!;
    const decision = state.decision as PromotionDecision;
    return {
      studentId: row.studentId,
      decision,
      targetSectionId: needsTargetSection(decision) ? state.targetSectionId || undefined : undefined,
      ...(decision === 'PROMOTED_WITH_CONDITIONS' ? { conditions: state.conditions.trim() } : {}),
    };
  });
  const warningNote = rowsWithWarnings.value
    ? ` ${rowsWithWarnings.value} of them have warnings (results, attendance or fees).`
    : '';
  const confirmed = await confirm({
    title: 'Confirm promotion decisions?',
    message: `Apply the chosen outcome for ${decisions.length} student(s) into ${targetSessionLabel.value}?${warningNote} This cannot be undone automatically.`,
    danger: true,
  });
  if (!confirmed) return;

  errorMessage.value = null;
  isExecuting.value = true;
  try {
    await api.executePromotions(auth.accessToken, {
      sourceAcademicSessionId: activeSession.value.id,
      targetAcademicSessionId: targetAcademicSessionId.value,
      confirmed: true,
      decisions,
    });
    bulkTargetSectionId.value = '';
    bulkDecision.value = '';
    toast.success(`Decisions recorded for ${decisions.length} student(s) into ${targetSessionLabel.value}.`);
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
        hide-label
        type="select"
        data-testid="select-source-class"
        placeholder="Select class"
        :options="sourceClasses.map((c) => ({ value: c.id, label: `${c.name} (${c.campusName})` }))"
      />
      <FormField
        v-model="sourceSectionId"
        label="Source section"
        hide-label
        type="select"
        data-testid="select-source-section"
        placeholder="Select section"
        :disabled="!sourceClassId"
        :options="sourceSections.map((s) => ({ value: s.id, label: `${s.className} ${s.name} (${s.campusName})` }))"
      />
      <FormField
        v-model="targetAcademicSessionId"
        label="Target academic session"
        hide-label
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
        Copy classes, sections, terms &amp; timetable from {{ activeSession?.label }}
      </Button>
    </div>

    <details v-if="previewSchoolId" class="policy-panel" data-testid="promotion-policy">
      <summary>Promotion rules for this school</summary>
      <p class="policy-hint">
        Indicators are warnings. Tick “block” only if this school does not allow a plain <em>Promoted</em> below the
        threshold — <em>Promoted with conditions</em>, <em>Retained</em> and the other outcomes stay available.
      </p>
      <div class="policy-fields">
        <label class="policy-number">
          Minimum attendance %
          <input v-model.number="policy.minAttendancePercent" type="number" min="0" max="100" data-testid="policy-min-attendance" />
        </label>
        <FormField v-model="policy.blockOnAttendance" label="Block below this attendance" type="checkbox" data-testid="policy-block-attendance" />
        <label class="policy-number">
          Minimum result %
          <input v-model.number="policy.minResultPercent" type="number" min="0" max="100" data-testid="policy-min-results" />
        </label>
        <FormField v-model="policy.blockOnResults" label="Block below this result" type="checkbox" data-testid="policy-block-results" />
        <FormField v-model="policy.blockOnFees" label="Block while fees are outstanding" type="checkbox" data-testid="policy-block-fees" />
        <Button data-testid="save-policy" variant="secondary" :disabled="isSavingPolicy" @click="onSavePolicy">Save rules</Button>
      </div>
    </details>
    <div v-if="previewRows.length" class="bulk-assign">
      <FormField
        v-model="bulkDecision"
        label="Outcome for all rows"
        hide-label
        type="select"
        data-testid="bulk-decision"
        placeholder="Choose an outcome for all rows"
        :options="decisionOptions"
      />
      <Button data-testid="apply-bulk-decision" variant="secondary" :disabled="!bulkDecision" @click="onApplyBulkDecision">
        Apply outcome to all
      </Button>
      <FormField
        v-model="bulkTargetSectionId"
        label="Bulk target section"
        hide-label
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
        { key: 'indicators', label: 'Indicators' },
        { key: 'decision', label: 'Decision' },
        { key: 'targetSectionId', label: 'Target Section' },
      ]"
      row-key="studentId"
      :editing-id="null"
    >
      <template #cell-currentRollNumber="{ item }">
        {{ item.currentRollNumber ?? '—' }}
      </template>
      <template #cell-indicators="{ item }">
        <div class="indicators" :data-testid="`indicators-${item.studentId}`">
          <span>Attendance {{ percentLabel(item.indicators.attendance.percent) }}</span>
          <span>Results {{ percentLabel(item.indicators.results.percent) }}</span>
          <span>Fees {{ feesLabel(item.indicators) }}</span>
          <span class="warnings">
            <StatusPill
              v-for="w in item.indicators.warnings"
              :key="w.code"
              :tone="w.blocking ? 'critical' : 'warning'"
              :label="w.blocking ? `Blocks promotion: ${w.message}` : w.message"
            />
          </span>
        </div>
      </template>
      <template #cell-decision="{ item }">
        <FormField
          :model-value="rowState[item.studentId]!.decision"
          label="Decision"
          hide-label
          type="select"
          placeholder="Choose outcome"
          :data-testid="`decision-${item.studentId}`"
          :options="decisionOptions"
          :error="rowBlocked(item) ? 'Blocked by this school’s rules — choose Promoted with conditions or another outcome' : undefined"
          @update:model-value="(v) => onDecisionChanged(item.studentId, v as PromotionDecision | '')"
        />
        <FormField
          v-if="rowState[item.studentId]!.decision === 'PROMOTED_WITH_CONDITIONS'"
          v-model="rowState[item.studentId]!.conditions"
          label="Conditions"
          hide-label
          type="text"
          placeholder="Conditions the student must meet"
          :data-testid="`conditions-${item.studentId}`"
        />
      </template>
      <template #cell-targetSectionId="{ item }">
        <FormField
          v-model="rowState[item.studentId]!.targetSectionId"
          label="Target section"
          hide-label
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
        Confirm decisions
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
.indicators {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
}
.indicators .warnings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.policy-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}
.policy-panel summary {
  cursor: pointer;
  font-weight: 600;
}
.policy-hint {
  margin: var(--space-2) 0;
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.policy-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}
.policy-number {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
}
.policy-number input {
  width: 6rem;
}
</style>
