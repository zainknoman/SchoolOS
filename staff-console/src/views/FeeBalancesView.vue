<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type OutstandingReport, type SchoolSummary, type SectionSummary } from '../lib/api';
import { formatPkrFull } from '../lib/format';
import Button from '../components/Button.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';

// BL-08 (Q9): who owes what (defaulters = an overdue balance), the school's late-fee rule and the
// two ledger runs — apply late fees and carry earlier-session arrears forward. Every run only adds
// new, audited voucher lines; nothing already issued or paid is edited.
const auth = useAuthStore();
const toast = useToast();

const isSuperAdmin = computed(() => auth.role === 'SUPER_ADMIN');
// The late-fee rule is school-wide: a campus-level user sees it but cannot change it.
const canEditPolicy = computed(() => isSuperAdmin.value || !auth.campusId);

const schools = ref<SchoolSummary[]>([]);
const schoolId = ref('');
const sections = ref<SectionSummary[]>([]);
const sectionId = ref('');
const defaultersOnly = ref(true);
const report = ref<OutstandingReport | null>(null);
const lateFeeAmount = ref('0');
const lateFeeGraceDays = ref('0');
const carryDueDate = ref('');
const errorMessage = ref<string | null>(null);
const busy = ref(false);

const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })));
const sectionOptions = computed(() => [
  { value: '', label: 'All sections' },
  ...sections.value.map((s) => ({ value: s.id, label: `${s.className} ${s.name}` })),
]);
const scopedSchool = () => (isSuperAdmin.value ? schoolId.value || undefined : undefined);
const ready = computed(() => !isSuperAdmin.value || !!schoolId.value);
const pkr = (paisa: number) => `PKR ${formatPkrFull(paisa / 100)}`;

async function loadReport() {
  if (!auth.accessToken || !ready.value) return;
  errorMessage.value = null;
  try {
    report.value = await api.outstandingFees(auth.accessToken, {
      schoolId: scopedSchool(),
      sectionId: sectionId.value || undefined,
      defaultersOnly: defaultersOnly.value,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load balances.';
  }
}

async function loadPolicy() {
  if (!auth.accessToken || !ready.value) return;
  try {
    const p = await api.getFeePolicy(auth.accessToken, scopedSchool());
    lateFeeAmount.value = String(p.lateFeeAmount / 100);
    lateFeeGraceDays.value = String(p.lateFeeGraceDays);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load the late-fee rule.';
  }
}

async function load() {
  if (!auth.accessToken) return;
  try {
    const [loadedSections, loadedSchools] = await Promise.all([
      api.listSections(auth.accessToken),
      isSuperAdmin.value ? api.listSchools(auth.accessToken) : Promise.resolve([]),
    ]);
    sections.value = loadedSections;
    schools.value = loadedSchools;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
  await Promise.all([loadReport(), loadPolicy()]);
}

watch(schoolId, () => Promise.all([loadReport(), loadPolicy()]));
watch([sectionId, defaultersOnly], loadReport);

async function onSavePolicy() {
  if (!auth.accessToken) return;
  const amount = Number(lateFeeAmount.value);
  const grace = Number(lateFeeGraceDays.value);
  if (!(amount >= 0) || !Number.isInteger(grace) || grace < 0) {
    errorMessage.value = 'Enter a late fee of 0 or more and whole grace days.';
    return;
  }
  errorMessage.value = null;
  busy.value = true;
  try {
    await api.updateFeePolicy(auth.accessToken, {
      ...(isSuperAdmin.value ? { schoolId: schoolId.value } : {}),
      lateFeeAmount: Math.round(amount * 100),
      lateFeeGraceDays: grace,
    });
    toast.success('Late-fee rule saved.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the late-fee rule.';
  } finally {
    busy.value = false;
  }
}

async function onApplyLateFees() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  busy.value = true;
  try {
    const r = await api.applyLateFees(auth.accessToken, scopedSchool());
    toast.success(r.applied ? `Late fee added to ${r.applied} voucher(s).` : 'No voucher needed a late fee.');
    await loadReport();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not apply late fees.';
  } finally {
    busy.value = false;
  }
}

async function onCarryForward() {
  if (!auth.accessToken) return;
  if (!carryDueDate.value) {
    errorMessage.value = 'Choose the due date of the opening-balance vouchers.';
    return;
  }
  errorMessage.value = null;
  busy.value = true;
  try {
    const r = await api.carryForwardFees(auth.accessToken, {
      dueDate: carryDueDate.value,
      ...(isSuperAdmin.value ? { schoolId: schoolId.value } : {}),
    });
    toast.success(
      r.students
        ? `Carried ${pkr(r.amount)} for ${r.students} student(s) into the current session.`
        : 'Nothing left to carry forward.',
    );
    await loadReport();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not carry balances forward.';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <ListPageCard icon="receipt" title="Fee Balances" subtitle="Outstanding balances, defaulters, late fees and carry-forward">
    <template v-if="isSuperAdmin" #toolbar>
      <FormField
        v-model="schoolId"
        label="School"
        hide-label
        type="select"
        data-testid="balances-school"
        placeholder="Choose a school"
        :options="schoolOptions"
      />
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <section class="block">
      <h3>Balances</h3>
      <div class="filters">
        <FormField v-model="sectionId" label="Section" type="select" data-testid="balances-section" :options="sectionOptions" />
        <FormField
          v-model="defaultersOnly"
          type="checkbox"
          label="Defaulters only (an overdue balance)"
          data-testid="balances-defaulters-only"
        />
      </div>
      <p v-if="report" class="totals" data-testid="balances-totals">
        {{ report.totals.students }} student(s) · outstanding {{ pkr(report.totals.outstanding) }} · overdue
        {{ pkr(report.totals.overdue) }}
      </p>
      <EmptyState v-if="report && report.rows.length === 0" icon="receipt" title="Nobody owes anything here" />
      <div v-else-if="report" class="table-wrap">
        <table class="table" data-testid="balances-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th class="num">Outstanding</th>
              <th class="num">Overdue</th>
              <th>Oldest due</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in report.rows" :key="r.studentId" :data-testid="`balance-row-${r.studentId}`">
              <td>{{ r.name }} <span class="mono muted">{{ r.grNumber }}</span></td>
              <td>{{ r.className ? `${r.className} ${r.sectionName ?? ''}` : 'Not enrolled now' }}</td>
              <td class="num mono">{{ pkr(r.outstanding) }}</td>
              <td class="num mono" :class="{ overdue: r.overdueAmount > 0 }">{{ pkr(r.overdueAmount) }}</td>
              <td class="mono">{{ r.oldestDueDate ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="ready" class="block">
      <h3>Late fee</h3>
      <p class="hint">
        Added once to each voucher of the current session that is still unpaid more than the grace days after its due date.
        A late fee can be reversed from the student's ledger. 0 turns late fees off.
      </p>
      <div class="grid">
        <FormField v-model="lateFeeAmount" label="Late fee (PKR)" type="text" data-testid="late-fee-amount" :disabled="!canEditPolicy" />
        <FormField v-model="lateFeeGraceDays" label="Grace days" type="text" data-testid="late-fee-grace" :disabled="!canEditPolicy" />
      </div>
      <div class="actions">
        <Button v-if="canEditPolicy" data-testid="late-fee-save" :disabled="busy" @click="onSavePolicy">Save rule</Button>
        <Button variant="secondary" data-testid="late-fee-apply" :disabled="busy" @click="onApplyLateFees">
          Apply late fees now
        </Button>
      </div>
    </section>

    <section v-if="ready" class="block">
      <h3>Carry forward</h3>
      <p class="hint">
        Moves every unpaid balance of an earlier session into one opening-balance voucher per student in the current
        session. The old vouchers are not edited — each gets a "carried forward" line. Safe to run more than once.
      </p>
      <div class="actions">
        <FormField v-model="carryDueDate" label="Due date" type="date" data-testid="carry-due-date" />
        <Button data-testid="carry-forward" :disabled="busy" @click="onCarryForward">Carry balances forward</Button>
      </div>
    </section>
  </ListPageCard>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}
.block:first-of-type {
  border-top: none;
  padding-top: 0;
}
h3 {
  margin: 0;
}
.filters,
.actions {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
}
.hint,
.totals {
  margin: 0;
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.totals {
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th,
.table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.table .num {
  text-align: right;
}
.muted {
  color: var(--color-muted);
}
.overdue {
  color: var(--color-destructive);
  font-weight: 700;
}
</style>
