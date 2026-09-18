<script setup lang="ts">
// Role dispatcher, not a dashboard itself — SUPER_ADMIN and everyone else (SCHOOL_ADMIN,
// ACCOUNTS) get genuinely different dashboards now (design-system rollout Chunk 3 / decision
// 11.6), so /admin renders whichever one applies instead of one shared generic view.
import AppShell from '../components/AppShell.vue';
import { useAuthStore } from '../stores/auth';
import SuperAdminDashboardView from './SuperAdminDashboardView.vue';
import SchoolAdminDashboardView from './SchoolAdminDashboardView.vue';

const auth = useAuthStore();
</script>

<template>
  <AppShell>
    <SuperAdminDashboardView v-if="auth.role === 'SUPER_ADMIN'" />
    <SchoolAdminDashboardView v-else />
  </AppShell>
</template>
