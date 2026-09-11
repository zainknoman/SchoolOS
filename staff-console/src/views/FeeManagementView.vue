<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type StudentSummary,
  type FeeStructureSummary,
  type FeeVoucherSummary,
  type FeePaymentSummary,
} from '../lib/api';
import { formatPkrFull } from '../lib/format';
import { useFocusTarget } from '../lib/useFocusTarget';
import Modal from '../components/Modal.vue';

const auth = useAuthStore();

// --- Fee structures ---
const structures = ref<FeeStructureSummary[]>([]);
const showAddStructureForm = ref(false);
const newStructureName = ref('');
const newStructureAmount = ref('');
const structureError = ref<string | null>(null);

async function loadStructures() {
  if (!auth.accessToken) return;
  try {
    structures.value = await api.listFeeStructures(auth.accessToken);
  } catch (err) {
    structureError.value = err instanceof Error ? err.message : 'Could not load fee structures.';
  }
}
loadStructures();

async function onCreateStructure() {
  if (!auth.accessToken || !newStructureName.value || !newStructureAmount.value) return;
  structureError.value = null;
  try {
    await api.createFeeStructure(auth.accessToken, {
      name: newStructureName.value,
      amount: Math.round(Number(newStructureAmount.value) * 100),
    });
    newStructureName.value = '';
    newStructureAmount.value = '';
    showAddStructureForm.value = false;
    await loadStructures();
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
  try {
    ledgerVouchers.value = await api.studentFees(auth.accessToken, ledgerStudentId.value);
    ledgerPayments.value = await api.studentFeePayments(auth.accessToken, ledgerStudentId.value);
  } catch (err) {
    ledgerError.value = err instanceof Error ? err.message : "Could not load this student's fee ledger.";
  }
}
</script>

<template>
  <div class="fees">
    <h1>Fees</h1>

    <section class="card">
      <div class="card-header">
        <h2>Fee Structures</h2>
        <button type="button" data-testid="open-add-structure" class="add-toggle" @click="showAddStructureForm = true">
          + Add New
        </button>
      </div>
      <p v-if="structureError" class="error" role="alert">{{ structureError }}</p>
      <ul class="structures-list">
        <li v-for="s in structures" :key="s.id">{{ s.name }} — PKR {{ formatPkrFull(s.amount / 100) }}</li>
      </ul>
      <Modal v-model="showAddStructureForm" title="Add Fee Structure">
        <div class="inline-form">
          <input data-testid="structure-name" v-model="newStructureName" type="text" placeholder="Name" />
          <input data-testid="structure-amount" v-model="newStructureAmount" type="number" placeholder="Amount (PKR)" />
          <button data-testid="create-structure" @click="onCreateStructure">Add</button>
        </div>
      </Modal>
    </section>

    <section class="card">
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

      <fieldset v-if="sectionStudents.length" class="field">
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

      <fieldset class="field">
        <legend>Fee structures to include</legend>
        <label v-for="s in structures" :key="s.id" class="checkbox-row">
          <input
            :data-testid="`structure-${s.id}`"
            type="checkbox"
            :value="s.id"
            v-model="selectedStructureIds"
          />
          {{ s.name }}
        </label>
      </fieldset>

      <label class="field">
        <span>Month</span>
        <input data-testid="issue-month" v-model="issueMonth" type="text" placeholder="2026-09" />
      </label>
      <label class="field">
        <span>Due date</span>
        <input data-testid="issue-due-date" v-model="issueDueDate" type="date" />
      </label>

      <button data-testid="issue-vouchers" :disabled="isIssuing" @click="onIssue">
        {{ isIssuing ? 'Issuing…' : 'Issue vouchers' }}
      </button>
    </section>

    <section class="card">
      <h2>Student Ledger</h2>
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
      <p v-if="ledgerError" class="error" role="alert">{{ ledgerError }}</p>

      <table v-if="ledgerVouchers.length" class="ledger-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Due</th>
            <th class="num">Total</th>
            <th class="num">Paid</th>
            <th class="num">Due</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in ledgerVouchers" :key="v.id">
            <td>{{ v.month }}</td>
            <td>{{ v.dueDate }}</td>
            <td class="num">{{ formatPkrFull(v.totalAmount / 100) }}</td>
            <td class="num">{{ formatPkrFull(v.amountPaid / 100) }}</td>
            <td class="num">{{ formatPkrFull(v.amountDue / 100) }}</td>
            <td>{{ v.status }}</td>
            <td>
              <button
                v-if="v.amountDue > 0"
                :data-testid="`record-payment-${v.id}`"
                @click="startReconcile(v.id, v.amountDue)"
              >
                Record payment
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="reconcilingVoucherId" class="card">
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
        <button data-testid="reconcile-submit" @click="onReconcile">Record payment</button>
        <button data-testid="reconcile-cancel" @click="reconcilingVoucherId = null">Cancel</button>
      </div>

      <ul v-if="ledgerPayments.length" class="payments-list">
        <li v-for="p in ledgerPayments" :key="p.id">
          PKR {{ formatPkrFull(p.amount / 100) }} — {{ p.status }}
          <a
            v-if="p.receiptId && auth.accessToken"
            :href="api.receiptPdfUrl(auth.accessToken, p.id)"
            target="_blank"
            rel="noopener"
          >
            Receipt
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.fees {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.add-toggle {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
  border: none;
  padding: 0;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 400;
}
select,
input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.error {
  color: var(--color-destructive);
}
.success {
  color: var(--color-accent);
}
.structures-list,
.payments-list {
  list-style: none;
  padding: 0;
  margin-bottom: var(--space-3);
}
button {
  padding: 0.5rem 0.9rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.ledger-table th,
.ledger-table td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
.num {
  text-align: right;
}
</style>
