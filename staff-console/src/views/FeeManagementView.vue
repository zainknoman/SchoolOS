<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type StudentSummary,
  type FeeStructureSummary,
  type FeeStructureStatus,
  type SchoolSummary,
  type FeeVoucherSummary,
  type FeePaymentSummary,
} from '../lib/api';
import { formatPkrFull } from '../lib/format';
import { useFocusTarget } from '../lib/useFocusTarget';
import AppModal from '../components/AppModal.vue';
import StatusPill from '../components/StatusPill.vue';
import EntityTable from '../components/EntityTable.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import Button from '../components/Button.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const toast = useToast();

// --- Fee structures ---
const structures = ref<FeeStructureSummary[]>([]);
const showAddStructureForm = ref(false);
const newStructureName = ref('');
const newStructureAmount = ref('');
const structureError = ref<string | null>(null);
// BL-03: fee structures are per school and move DRAFT -> ACTIVE -> LOCKED (once invoiced) -> ARCHIVED.
const isSuperAdmin = auth.role === 'SUPER_ADMIN';
const schools = ref<SchoolSummary[]>([]);
const newStructureSchoolId = ref('');
const STATUS_LABEL: Record<FeeStructureStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  LOCKED: 'Locked (invoiced)',
  ARCHIVED: 'Archived',
};
const issuableStructures = computed(() =>
  structures.value.filter((s) => s.status === undefined || s.status === 'ACTIVE' || s.status === 'LOCKED'),
);

async function onChangeStatus(s: FeeStructureSummary, status: FeeStructureStatus) {
  if (!auth.accessToken) return;
  structureError.value = null;
  try {
    await api.updateFeeStructure(auth.accessToken, s.id, { status });
    await loadStructures();
    toast.success(`${s.name}: ${STATUS_LABEL[status]}.`);
  } catch (err) {
    structureError.value = err instanceof Error ? err.message : 'Could not update this fee structure.';
  }
}

async function loadStructures() {
  if (!auth.accessToken) return;
  try {
    structures.value = await api.listFeeStructures(auth.accessToken);
    if (isSuperAdmin && schools.value.length === 0) schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    structureError.value = err instanceof Error ? err.message : 'Could not load fee structures.';
  }
}
loadStructures();

async function onCreateStructure() {
  if (!auth.accessToken || !newStructureName.value || !newStructureAmount.value) return;
  if (isSuperAdmin && !newStructureSchoolId.value) {
    structureError.value = 'Choose the school this fee structure belongs to.';
    return;
  }
  structureError.value = null;
  try {
    await api.createFeeStructure(auth.accessToken, {
      name: newStructureName.value,
      amount: Math.round(Number(newStructureAmount.value) * 100),
      ...(isSuperAdmin ? { schoolId: newStructureSchoolId.value } : {}),
    });
    newStructureName.value = '';
    newStructureAmount.value = '';
    showAddStructureForm.value = false;
    await loadStructures();
    toast.success('Fee structure added.');
  } catch (err) {
    structureError.value = err instanceof Error ? err.message : 'Could not create fee structure.';
  }
}

// --- Issue vouchers ---
const sections = ref<SectionSummary[]>([]);
const issueSectionId = ref('');
const issueSectionRef = ref<HTMLSelectElement | null>(null);
useFocusTarget({ 'issue-section': issueSectionRef });
const sectionStudents = ref<StudentSummary[]>([]);
const selectedStudentIds = ref<string[]>([]);
const selectedStructureIds = ref<string[]>([]);
const issueMonth = ref('');
const issueDueDate = ref('');
const issueMessage = ref<string | null>(null);
const issueError = ref<string | null>(null);
const isIssuing = ref(false);

async function loadSections() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    issueError.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadSections();

async function onSectionChange() {
  selectedStudentIds.value = [];
  sectionStudents.value = [];
  if (!auth.accessToken || !issueSectionId.value) return;
  try {
    sectionStudents.value = await api.sectionStudents(auth.accessToken, issueSectionId.value);
  } catch (err) {
    issueError.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

async function onIssue() {
  if (
    !auth.accessToken ||
    !issueSectionId.value ||
    !issueMonth.value ||
    !issueDueDate.value ||
    !selectedStructureIds.value.length
  ) {
    return;
  }
  issueMessage.value = null;
  issueError.value = null;
  isIssuing.value = true;
  try {
    await api.issueFeeVouchers(auth.accessToken, {
      sectionId: selectedStudentIds.value.length ? undefined : issueSectionId.value,
      studentIds: selectedStudentIds.value.length ? [...selectedStudentIds.value] : undefined,
      month: issueMonth.value,
      dueDate: issueDueDate.value,
      feeStructureIds: [...selectedStructureIds.value],
    });
    issueMessage.value = 'Vouchers issued.';
    selectedStudentIds.value = [];
  } catch (err) {
    issueError.value = err instanceof Error ? err.message : 'Could not issue vouchers.';
  } finally {
    isIssuing.value = false;
  }
}

// --- Student ledger ---
// Admins have no way to know a student's raw id, so this picks the same way "Issue Vouchers"
// does: section first, then a named student from that section — not a free-text id field.
const ledgerSectionId = ref('');
const ledgerSectionStudents = ref<StudentSummary[]>([]);
const ledgerStudentId = ref('');
const ledgerVouchers = ref<FeeVoucherSummary[]>([]);
const ledgerPayments = ref<FeePaymentSummary[]>([]);
const ledgerError = ref<string | null>(null);
const isLoadingLedger = ref(false);

const reconcilingVoucherId = ref<string | null>(null);
const reconcileAmount = ref('');
const reconcileMethod = ref<'cash' | 'bank_transfer'>('cash');
const reconcileNote = ref('');
const reconcileError = ref<string | null>(null);

function startReconcile(voucherId: string, amountDuePaisa: number) {
  reconcilingVoucherId.value = voucherId;
  reconcileAmount.value = (amountDuePaisa / 100).toString();
  reconcileMethod.value = 'cash';
  reconcileNote.value = '';
  reconcileError.value = null;
}

async function onReconcile() {
  if (!auth.accessToken || !reconcilingVoucherId.value || !reconcileAmount.value) return;
  reconcileError.value = null;
  try {
    await api.reconcileVoucher(auth.accessToken, reconcilingVoucherId.value, {
      amount: Math.round(Number(reconcileAmount.value) * 100),
      method: reconcileMethod.value,
      note: reconcileNote.value || undefined,
    });
    reconcilingVoucherId.value = null;
    await onLoadLedger();
    toast.success('Payment recorded.');
  } catch (err) {
    reconcileError.value = err instanceof Error ? err.message : 'Could not record payment.';
  }
}

async function onLedgerSectionChange() {
  ledgerStudentId.value = '';
  ledgerVouchers.value = [];
  ledgerPayments.value = [];
  ledgerSectionStudents.value = [];
  if (!auth.accessToken || !ledgerSectionId.value) return;
  try {
    ledgerSectionStudents.value = await api.sectionStudents(auth.accessToken, ledgerSectionId.value);
  } catch (err) {
    ledgerError.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

async function onLoadLedger() {
  if (!auth.accessToken || !ledgerStudentId.value) return;
  ledgerError.value = null;
  isLoadingLedger.value = true;
  try {
    ledgerVouchers.value = await api.studentFees(auth.accessToken, ledgerStudentId.value);
    ledgerPayments.value = await api.studentFeePayments(auth.accessToken, ledgerStudentId.value);
  } catch (err) {
    ledgerError.value = err instanceof Error ? err.message : "Could not load this student's fee ledger.";
  } finally {
    isLoadingLedger.value = false;
  }
}

function voucherTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'critical';
  if (status === 'partial') return 'warning';
  return 'neutral'; // 'unpaid'
}
</script>

<template>
  <ListPageCard icon="receipt" title="Fees" subtitle="Fee structures, vouchers & the student ledger">
    <section class="fee-section">
      <div class="section-header">
        <h2>Fee Structures</h2>
        <Button data-testid="open-add-structure" @click="showAddStructureForm = true">+ Add New</Button>
      </div>
      <p v-if="structureError" class="error" role="alert">{{ structureError }}</p>
      <div v-if="structures.length" class="structures-list">
        <div v-for="s in structures" :key="s.id" class="structure-row" :data-testid="`structure-row-${s.id}`">
          {{ s.name }} <span class="mono muted">— PKR {{ formatPkrFull(s.amount / 100) }}</span>
          <span v-if="s.status" class="muted" :data-testid="`structure-status-${s.id}`">· {{ STATUS_LABEL[s.status] }}</span>
          <Button
            v-if="s.status === 'DRAFT'"
            variant="secondary"
            :data-testid="`activate-${s.id}`"
            @click="onChangeStatus(s, 'ACTIVE')"
          >Activate</Button>
          <Button
            v-if="s.status === 'ACTIVE' || s.status === 'LOCKED'"
            variant="secondary"
            :data-testid="`archive-${s.id}`"
            @click="onChangeStatus(s, 'ARCHIVED')"
          >Archive</Button>
        </div>
      </div>
      <p v-else class="empty-hint">No fee structures yet — add one to start issuing vouchers.</p>
      <AppModal v-model="showAddStructureForm" title="Add Fee Structure">
        <div class="inline-form">
          <label class="field">
            <span>Name</span>
            <input data-testid="structure-name" v-model="newStructureName" type="text" placeholder="Name" />
          </label>
          <label class="field">
            <span>Amount (PKR)</span>
            <input data-testid="structure-amount" v-model="newStructureAmount" type="number" placeholder="Amount (PKR)" />
          </label>
          <label v-if="isSuperAdmin" class="field">
            <span>School</span>
            <select data-testid="structure-school" v-model="newStructureSchoolId">
              <option value="" disabled>Choose a school</option>
              <option v-for="sc in schools" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
            </select>
          </label>
          <Button data-testid="create-structure" @click="onCreateStructure">Add</Button>
        </div>
      </AppModal>
    </section>

    <section class="fee-section">
      <h2>Issue Vouchers</h2>
      <p v-if="issueMessage" class="success" data-testid="issue-success">{{ issueMessage }}</p>
      <p v-if="issueError" class="error" role="alert">{{ issueError }}</p>

      <label class="field">
        <span>Section</span>
        <select ref="issueSectionRef" data-testid="issue-section" v-model="issueSectionId" @change="onSectionChange">
          <option value="" disabled>Choose a section</option>
          <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.className }} {{ s.name }}</option>
        </select>
      </label>

      <fieldset v-if="sectionStudents.length" class="check-fieldset">
        <legend>Individual students (leave all unchecked to issue to the whole section)</legend>
        <label v-for="st in sectionStudents" :key="st.id" class="checkbox-row">
          <input
            :data-testid="`student-${st.id}`"
            type="checkbox"
            :value="st.id"
            v-model="selectedStudentIds"
          />
          {{ st.name }} ({{ st.grNumber }})
        </label>
      </fieldset>

      <fieldset class="check-fieldset">
        <legend>Fee structures to include</legend>
        <label v-for="s in issuableStructures" :key="s.id" class="checkbox-row">
          <input
            :data-testid="`structure-${s.id}`"
            type="checkbox"
            :value="s.id"
            v-model="selectedStructureIds"
          />
          {{ s.name }}
        </label>
      </fieldset>

      <div class="inline-fields">
        <label class="field">
          <span>Month</span>
          <input data-testid="issue-month" v-model="issueMonth" type="text" placeholder="2026-09" />
        </label>
        <label class="field">
          <span>Due date</span>
          <input data-testid="issue-due-date" v-model="issueDueDate" type="date" />
        </label>
        <Button data-testid="issue-vouchers" :disabled="isIssuing" @click="onIssue">
          {{ isIssuing ? 'Issuing…' : 'Issue vouchers' }}
        </Button>
      </div>
    </section>

    <section class="fee-section">
      <h2>Student Ledger</h2>
      <div class="inline-fields">
        <label class="field">
          <span>Section</span>
          <select data-testid="ledger-section" v-model="ledgerSectionId" @change="onLedgerSectionChange">
            <option value="" disabled>Choose a section</option>
            <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.className }} {{ s.name }}</option>
          </select>
        </label>
        <label v-if="ledgerSectionStudents.length" class="field">
          <span>Student</span>
          <select data-testid="ledger-student" v-model="ledgerStudentId" @change="onLoadLedger">
            <option value="" disabled>Choose a student</option>
            <option v-for="st in ledgerSectionStudents" :key="st.id" :value="st.id">
              {{ st.name }} ({{ st.grNumber }})
            </option>
          </select>
        </label>
      </div>
      <ErrorRetry v-if="ledgerError" :message="ledgerError" @retry="onLoadLedger" />

      <EntityTable
        v-if="ledgerStudentId"
        :items="ledgerVouchers"
        :columns="[
          { key: 'month', label: 'Month' },
          { key: 'dueDate', label: 'Due' },
          { key: 'totalAmount', label: 'Total' },
          { key: 'amountPaid', label: 'Paid' },
          { key: 'amountDue', label: 'Due' },
          { key: 'status', label: 'Status' },
        ]"
        row-key="id"
        :editing-id="null"
        :loading="isLoadingLedger"
        empty-icon="receipt"
        empty-title="No vouchers issued yet"
        empty-message="Vouchers issued to this student will show up here."
      >
        <template #cell-totalAmount="{ item }">
          <span class="num-cell">{{ formatPkrFull(item.totalAmount / 100) }}</span>
        </template>
        <template #cell-amountPaid="{ item }">
          <span class="num-cell">{{ formatPkrFull(item.amountPaid / 100) }}</span>
        </template>
        <template #cell-amountDue="{ item }">
          <span class="num-cell">{{ formatPkrFull(item.amountDue / 100) }}</span>
        </template>
        <template #cell-status="{ item }">
          <StatusPill :tone="voucherTone(item.status)" :label="item.status" />
        </template>
        <template #actions="{ item }">
          <Button
            v-if="item.amountDue > 0"
            :data-testid="`record-payment-${item.id}`"
            @click="startReconcile(item.id, item.amountDue)"
          >
            Record payment
          </Button>
        </template>
      </EntityTable>

      <div v-if="reconcilingVoucherId" class="reconcile-panel">
        <h3>Record cash / bank-transfer payment</h3>
        <p v-if="reconcileError" class="error" role="alert">{{ reconcileError }}</p>
        <label class="field">
          <span>Amount (PKR)</span>
          <input data-testid="reconcile-amount" v-model="reconcileAmount" type="number" />
        </label>
        <label class="field">
          <span>Method</span>
          <select data-testid="reconcile-method" v-model="reconcileMethod">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
        <label class="field">
          <span>Note (optional)</span>
          <input data-testid="reconcile-note" v-model="reconcileNote" type="text" />
        </label>
        <div class="reconcile-actions">
          <Button data-testid="reconcile-submit" @click="onReconcile">Record payment</Button>
          <Button variant="secondary" data-testid="reconcile-cancel" @click="reconcilingVoucherId = null">
            Cancel
          </Button>
        </div>
      </div>

      <div v-if="ledgerPayments.length" class="payments-list">
        <div v-for="p in ledgerPayments" :key="p.id" class="payment-row">
          <span>PKR {{ formatPkrFull(p.amount / 100) }} — {{ p.status }}</span>
          <a
            v-if="p.receiptId && auth.accessToken"
            :href="api.receiptPdfUrl(auth.accessToken, p.id)"
            target="_blank"
            rel="noopener"
            class="link"
          >
            Receipt
          </a>
        </div>
      </div>
    </section>
  </ListPageCard>
</template>

<style scoped>
/* Anti-card pass: three logically-grouped workflows on one page, separated by a top border
   instead of three stacked boxes — no elevation needed since there's nothing to lift above
   another surface here (Rule 4: cards only when elevation communicates hierarchy). */
.fee-section {
  padding: var(--space-5) 0;
  border-top: 1px solid var(--color-border);
}
.fee-section:first-child {
  padding-top: 0;
  border-top: none;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.empty-hint {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
}
/* The reconcile form is a contextual action panel breaking out of the list flow — this is the
   one place in this screen where elevation genuinely communicates hierarchy, so it keeps a card. */
.reconcile-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
  margin-top: var(--space-3);
}
.reconcile-panel h3 {
  margin-bottom: var(--space-2);
}
.reconcile-actions {
  display: flex;
  gap: var(--space-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted);
  margin-bottom: var(--space-3);
  border: none;
  padding: 0;
}
.check-fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}
.check-fieldset legend {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-muted);
  padding: 0 var(--space-1);
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 400;
  color: var(--color-text);
  padding: 0.2rem 0;
}
select,
input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.inline-fields {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  flex-wrap: wrap;
}
.error {
  color: var(--color-destructive);
}
.success {
  color: var(--color-accent);
}
.structures-list,
.payments-list {
  margin-bottom: var(--space-3);
}
.structure-row,
.payment-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.structure-row:last-child,
.payment-row:last-child {
  border-bottom: none;
}
.link {
  color: var(--color-accent);
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-decoration: none;
}
.num-cell {
  display: block;
  text-align: right;
}
</style>
