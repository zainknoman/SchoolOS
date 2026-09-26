<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type GradeBand, type GradingScale, type SchoolSummary } from '../lib/api';
import Button from '../components/Button.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

// BL-27 (Q6): a school's grading scales — percentage bands mapped to a letter, a remark and an
// optional grade point. The default scale is the one results are published with.
const auth = useAuthStore();
const toast = useToast();
const { confirm } = useConfirm();

interface BandRow {
  minPercent: string;
  letter: string;
  remark: string;
  gradePoint: string;
}

const isSuperAdmin = computed(() => auth.role === 'SUPER_ADMIN');
const scales = ref<GradingScale[]>([]);
const schools = ref<SchoolSummary[]>([]);
const schoolId = ref('');
const errorMessage = ref<string | null>(null);
const busy = ref(false);

// Editor: `editingId` null + `editing` true = a new scale.
const editing = ref(false);
const editingId = ref<string | null>(null);
const name = ref('');
const isDefault = ref(false);
const bands = ref<BandRow[]>([]);

const visibleScales = computed(() =>
  isSuperAdmin.value ? scales.value.filter((s) => s.schoolId === schoolId.value) : scales.value,
);
const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })));

const STARTER: BandRow[] = [
  { minPercent: '90', letter: 'A+', remark: 'Outstanding', gradePoint: '4' },
  { minPercent: '80', letter: 'A', remark: 'Excellent', gradePoint: '4' },
  { minPercent: '70', letter: 'B', remark: 'Very good', gradePoint: '3' },
  { minPercent: '60', letter: 'C', remark: 'Good', gradePoint: '2' },
  { minPercent: '50', letter: 'D', remark: 'Satisfactory', gradePoint: '1' },
  { minPercent: '0', letter: 'F', remark: 'Needs improvement', gradePoint: '0' },
];

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    const [loaded, loadedSchools] = await Promise.all([
      api.listGradingScales(auth.accessToken),
      isSuperAdmin.value && schools.value.length === 0 ? api.listSchools(auth.accessToken) : Promise.resolve(schools.value),
    ]);
    scales.value = loaded;
    schools.value = loadedSchools;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load grading scales.';
  }
}

function toRows(list: GradeBand[]): BandRow[] {
  return list.map((b) => ({
    minPercent: String(b.minPercent),
    letter: b.letter,
    remark: b.remark ?? '',
    gradePoint: b.gradePoint === null ? '' : String(b.gradePoint),
  }));
}

function startNew() {
  editing.value = true;
  editingId.value = null;
  name.value = '';
  isDefault.value = visibleScales.value.length === 0;
  bands.value = STARTER.map((b) => ({ ...b }));
}

function startEdit(scale: GradingScale) {
  editing.value = true;
  editingId.value = scale.id;
  name.value = scale.name;
  isDefault.value = scale.isDefault;
  bands.value = toRows(scale.bands);
}

function cancel() {
  editing.value = false;
}

function addBand() {
  bands.value.push({ minPercent: '', letter: '', remark: '', gradePoint: '' });
}

function removeBand(index: number) {
  bands.value.splice(index, 1);
}

function toBands(): GradeBand[] | null {
  const out: GradeBand[] = [];
  for (const b of bands.value) {
    const min = Number(b.minPercent);
    const gp = b.gradePoint.trim() === '' ? null : Number(b.gradePoint);
    if (b.minPercent.trim() === '' || Number.isNaN(min) || !b.letter.trim() || (gp !== null && Number.isNaN(gp))) {
      return null;
    }
    out.push({ minPercent: min, letter: b.letter.trim(), remark: b.remark.trim() || null, gradePoint: gp });
  }
  return out;
}

async function onSave() {
  if (!auth.accessToken) return;
  const parsed = toBands();
  if (!name.value.trim() || !parsed || parsed.length === 0) {
    errorMessage.value = 'Give the scale a name, and every band a minimum % and a letter.';
    return;
  }
  errorMessage.value = null;
  busy.value = true;
  try {
    if (editingId.value) {
      await api.updateGradingScale(auth.accessToken, editingId.value, {
        name: name.value.trim(),
        bands: parsed,
        ...(isDefault.value ? { isDefault: true } : {}),
      });
    } else {
      await api.createGradingScale(auth.accessToken, {
        ...(isSuperAdmin.value ? { schoolId: schoolId.value } : {}),
        name: name.value.trim(),
        isDefault: isDefault.value,
        bands: parsed,
      });
    }
    editing.value = false;
    await load();
    toast.success('Grading scale saved.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save this grading scale.';
  } finally {
    busy.value = false;
  }
}

async function onMakeDefault(scale: GradingScale) {
  if (!auth.accessToken) return;
  try {
    await api.updateGradingScale(auth.accessToken, scale.id, { isDefault: true });
    await load();
    toast.success(`${scale.name} is now the default scale.`);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not change the default scale.';
  }
}

async function onDelete(scale: GradingScale) {
  if (!auth.accessToken) return;
  const ok = await confirm({
    title: `Delete ${scale.name}?`,
    message: scale.isDefault
      ? 'It is the default scale: results cannot be published until another scale is the default. Published results keep their grades.'
      : 'Published results keep their grades.',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteGradingScale(auth.accessToken, scale.id);
    await load();
    toast.success('Grading scale deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this grading scale.';
  }
}

onMounted(load);
</script>

<template>
  <ListPageCard icon="grid" title="Grading Scales" subtitle="Percentage bands → letter grade, remark and grade point">
    <template #toolbar>
      <FormField
        v-if="isSuperAdmin"
        v-model="schoolId"
        label="School"
        hide-label
        type="select"
        data-testid="scale-school"
        placeholder="Choose a school"
        :options="schoolOptions"
      />
      <Button data-testid="scale-new" :disabled="editing || (isSuperAdmin && !schoolId)" @click="startNew">+ New scale</Button>
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <section v-if="editing" class="editor" data-testid="scale-editor">
      <div class="editor-row">
        <FormField v-model="name" label="Name" type="text" data-testid="scale-name" placeholder="e.g. Standard" />
        <FormField
          v-model="isDefault"
          type="checkbox"
          label="Default scale"
          data-testid="scale-default"
          hint="Results are published with the default scale."
        />
      </div>
      <table class="bands">
        <thead>
          <tr>
            <th>From %</th>
            <th>Letter</th>
            <th>Remark</th>
            <th>Grade point</th>
            <th><span class="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, i) in bands" :key="i">
            <td><input v-model="b.minPercent" :data-testid="`band-min-${i}`" inputmode="decimal" aria-label="From %" /></td>
            <td><input v-model="b.letter" :data-testid="`band-letter-${i}`" aria-label="Letter" /></td>
            <td><input v-model="b.remark" aria-label="Remark" /></td>
            <td><input v-model="b.gradePoint" inputmode="decimal" aria-label="Grade point" /></td>
            <td><Button variant="secondary" :data-testid="`band-remove-${i}`" @click="removeBand(i)">Remove</Button></td>
          </tr>
        </tbody>
      </table>
      <p class="hint">A result gets the band with the highest "From %" it reaches; one band must start at 0.</p>
      <div class="actions">
        <Button variant="secondary" data-testid="band-add" @click="addBand">Add band</Button>
        <Button data-testid="scale-save" :disabled="busy" @click="onSave">Save</Button>
        <Button variant="secondary" @click="cancel">Cancel</Button>
      </div>
    </section>

    <EmptyState
      v-if="!editing && visibleScales.length === 0"
      icon="grid"
      title="No grading scale yet"
      message="Add one so results show letter grades and can be published."
    />
    <div v-else-if="!editing" class="scales">
      <article v-for="s in visibleScales" :key="s.id" class="scale" :data-testid="`scale-${s.id}`">
        <header>
          <h3>
            {{ s.name }} <span v-if="s.isDefault" class="badge" data-testid="scale-default-badge">Default</span>
          </h3>
          <div class="actions">
            <Button v-if="!s.isDefault" variant="secondary" :data-testid="`scale-make-default-${s.id}`" @click="onMakeDefault(s)"
              >Make default</Button
            >
            <Button variant="secondary" :data-testid="`scale-edit-${s.id}`" @click="startEdit(s)">Edit</Button>
            <Button variant="secondary" :data-testid="`scale-delete-${s.id}`" @click="onDelete(s)">Delete</Button>
          </div>
        </header>
        <table class="bands">
          <tbody>
            <tr v-for="b in s.bands" :key="b.minPercent">
              <td class="mono">≥ {{ b.minPercent }}%</td>
              <td><strong>{{ b.letter }}</strong></td>
              <td>{{ b.remark ?? '' }}</td>
              <td class="mono">{{ b.gradePoint ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </ListPageCard>
</template>

<style scoped>
.editor,
.scales {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.editor-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}
.scale {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  padding: var(--space-3);
}
.scale header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.scale h3 {
  margin: 0;
}
.badge {
  font-size: var(--font-size-2xs);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  background: var(--color-status-success-tint, var(--color-background));
  color: var(--color-accent);
}
.bands {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-2);
}
.bands th,
.bands td {
  text-align: left;
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.bands input {
  width: 100%;
  min-width: 4rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin: 0;
}
</style>
