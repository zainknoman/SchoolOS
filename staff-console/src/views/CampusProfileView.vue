<!-- staff-console/src/views/CampusProfileView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary } from '../lib/api';
import OrgProfileHeader from '../components/OrgProfileHeader.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import ErrorRetry from '../components/ErrorRetry.vue';

const auth = useAuthStore();
const route = useRoute();
const campusId = route.params.id as string;

const campus = ref<CampusSummary | null>(null);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    // No single-campus endpoint exists — the list already carries every field this page shows.
    const found = (await api.listCampuses(auth.accessToken)).find((c) => c.id === campusId) ?? null;
    if (!found) {
      errorMessage.value = 'Campus not found.';
      return;
    }
    campus.value = found;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this campus.';
  }
}
load();

const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : value);
const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : null);

const chips = computed(() => [campus.value?.schoolName, campus.value?.code, campus.value?.campusType].filter((v): v is string => !!v));
const stats = computed(() => [
  { label: 'Students', value: campus.value?.studentCount ?? 0 },
  { label: 'Staff', value: campus.value?.staffCount ?? 0 },
  { label: 'Capacity', value: campus.value?.capacity ?? '—' },
]);
</script>

<template>
  <div class="org-profile">
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <template v-if="campus">
      <OrgProfileHeader
        :name="campus.name"
        :status-label="campus.status === 'ACTIVE' ? 'Active' : 'Inactive'"
        :status-tone="campus.status === 'ACTIVE' ? 'success' : 'neutral'"
        back-to="/admin/campuses"
        back-label="Campuses"
        :chips="chips"
        :stats="stats"
      />

      <ProfileSectionCard icon="home" title="Overview">
        <div class="field-grid">
          <div class="field">
            <span class="field-label">School</span>
            <span class="field-value"><RouterLink data-testid="school-link" :to="`/admin/schools/${campus.schoolId}`">{{ campus.schoolName }}</RouterLink></span>
          </div>
          <div class="field"><span class="field-label">Campus code</span><span class="field-value mono">{{ show(campus.code) }}</span></div>
          <div class="field"><span class="field-label">Campus type</span><span class="field-value">{{ show(campus.campusType) }}</span></div>
          <div class="field"><span class="field-label">Opening date</span><span class="field-value mono">{{ show(dateOnly(campus.openingDate)) }}</span></div>
          <div class="field"><span class="field-label">Capacity</span><span class="field-value mono">{{ show(campus.capacity) }}</span></div>
          <div class="field">
            <span class="field-label">Departments</span>
            <span class="field-value">{{ campus.departments.length ? campus.departments.join(', ') : '—' }}</span>
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="chat" title="Contact & location">
        <div class="field-grid">
          <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(campus.phone) }}</span></div>
          <div class="field"><span class="field-label">Alternate phone</span><span class="field-value mono">{{ show(campus.alternatePhone) }}</span></div>
          <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(campus.email) }}</span></div>
          <div class="field"><span class="field-label">Address</span><span class="field-value address-block">{{ show(campus.address) }}</span></div>
          <div class="field"><span class="field-label">Latitude</span><span class="field-value mono">{{ show(campus.latitude) }}</span></div>
          <div class="field"><span class="field-label">Longitude</span><span class="field-value mono">{{ show(campus.longitude) }}</span></div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="user-circle" title="Principal">
        <div class="field-grid">
          <div class="field"><span class="field-label">Name</span><span class="field-value">{{ show(campus.principalName) }}</span></div>
          <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(campus.principalPhone) }}</span></div>
          <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(campus.principalEmail) }}</span></div>
        </div>
      </ProfileSectionCard>
    </template>
  </div>
</template>

<style scoped>
.org-profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
