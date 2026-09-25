<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, STAFF_GRANTS, type AccountAccessStatus } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';

// BL-32 (Q18): accounts staff work on fees/finance by default. A school admin grants each of
// them the extra modules they need; every change is audited on the server.
const auth = useAuthStore();
const toast = useToast();

const LABELS: Record<string, string> = {
  ADMISSIONS: 'Admissions',
  COMPLAINTS: 'Complaints',
  MESSAGES: 'Parent messages',
};

const staff = ref<AccountAccessStatus[]>([]);
const errorMessage = ref<string | null>(null);
const loading = ref(true);
const savingId = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    staff.value = await api.listAccountsStaff(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load accounts staff.';
  } finally {
    loading.value = false;
  }
}

async function toggle(user: AccountAccessStatus, grant: string, on: boolean) {
  if (!auth.accessToken) return;
  const next = on ? [...user.grants, grant] : user.grants.filter((g) => g !== grant);
  errorMessage.value = null;
  savingId.value = user.id;
  try {
    const updated = await api.setStaffGrants(auth.accessToken, user.id, next);
    staff.value = staff.value.map((u) => (u.id === updated.id ? updated : u));
    toast.success(`${LABELS[grant]} ${on ? 'granted to' : 'removed from'} ${user.identifier}.`);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not change access.';
  } finally {
    savingId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <ListPageCard icon="users" title="Accounts Staff Access" subtitle="Fees & finance by default; grant other modules here">
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <EntityTable
      :items="staff"
      :columns="[
        { key: 'identifier', label: 'Account' },
        ...STAFF_GRANTS.map((g) => ({ key: g, label: LABELS[g] ?? g })),
      ]"
      row-key="id"
      :editing-id="null"
      :loading="loading"
      empty-icon="users"
      empty-title="No accounts staff"
      empty-message="Accounts users of your school appear here."
    >
      <template v-for="g in STAFF_GRANTS" :key="g" #[`cell-${g}`]="{ item }">
        <input
          type="checkbox"
          :data-testid="`grant-${item.id}-${g}`"
          :aria-label="`${LABELS[g]} for ${item.identifier}`"
          :checked="item.grants.includes(g)"
          :disabled="savingId === item.id"
          @change="toggle(item, g, ($event.target as HTMLInputElement).checked)"
        />
      </template>
    </EntityTable>
  </ListPageCard>
</template>
