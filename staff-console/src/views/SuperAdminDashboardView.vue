<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type NetworkOverview } from '../lib/api';
import { formatPkrFull } from '../lib/format';
import ErrorRetry from '../components/ErrorRetry.vue';
import AppSkeleton from '../components/AppSkeleton.vue';

const auth = useAuthStore();
const overview = ref<NetworkOverview | null>(null);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    overview.value = await api.networkOverview(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load the network overview.';
  }
}
load();
</script>

<template>
  <div class="network-overview">
    <h1>Network Overview</h1>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <AppSkeleton v-else-if="!overview" height="420px" data-testid="network-overview-skeleton" />

    <template v-else>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Schools</div>
          <div class="kpi-value">{{ overview.totalSchools }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total students</div>
          <div class="kpi-value">{{ formatPkrFull(overview.totalStudents) }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total staff</div>
          <div class="kpi-value">{{ formatPkrFull(overview.totalStaff) }}</div>
        </div>
      </div>

      <div class="lower-grid">
        <div class="card">
          <h2>Schools</h2>
          <table class="schools-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Campuses</th>
                <th>Students</th>
                <th>Fee collection</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="school in overview.schools" :key="school.id" :data-testid="`school-row-${school.id}`">
                <td class="row-title">{{ school.name }}</td>
                <td class="mono">{{ school.campusesCount }}</td>
                <td class="mono">{{ formatPkrFull(school.studentsCount) }}</td>
                <td class="mono">{{ school.feeCollectionPercent }}%</td>
                <td>
                  <span class="pill" :class="school.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive'">
                    {{ school.status === 'ACTIVE' ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side-rail">
          <div class="card">
            <h2>Quick actions</h2>
            <RouterLink to="/admin/schools" class="qa-tile" data-testid="qa-manage-schools">
              <span class="qa-title">Manage Schools</span>
              <span class="muted">Add, edit, or deactivate a school</span>
            </RouterLink>
            <RouterLink to="/admin/campuses" class="qa-tile" data-testid="qa-manage-campuses">
              <span class="qa-title">Manage Campuses</span>
              <span class="muted">Campuses across every school</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.network-overview {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.network-overview h1 {
  margin: 0;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.kpi-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
}
.kpi-label {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  margin-bottom: var(--space-1);
}
.kpi-value {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.lower-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-4);
  align-items: start;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}
.card h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-base);
}

.schools-table {
  width: 100%;
  border-collapse: collapse;
}
.schools-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}
.schools-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.schools-table tbody tr:last-child td {
  border-bottom: none;
}
.row-title {
  font-weight: 700;
}
.pill {
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-2xs);
  font-weight: 700;
}
.pill-active {
  background: var(--color-status-success-tint);
  color: var(--color-status-success);
}
.pill-inactive {
  background: var(--color-muted-bg);
  color: var(--color-muted);
}

.side-rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.qa-tile {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-decoration: none;
  margin-bottom: var(--space-2);
}
.qa-tile:last-child {
  margin-bottom: 0;
}
.qa-title {
  font-weight: 700;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}

@media (max-width: 1024px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}
</style>
