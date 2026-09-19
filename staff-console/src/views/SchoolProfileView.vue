<!-- staff-console/src/views/SchoolProfileView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';
import OrgProfileHeader from '../components/OrgProfileHeader.vue';
import ProfileSectionCard from '../components/ProfileSectionCard.vue';
import ErrorRetry from '../components/ErrorRetry.vue';

const auth = useAuthStore();
const route = useRoute();
const schoolId = route.params.id as string;

const school = ref<SchoolSummary | null>(null);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    // No single-school endpoint exists — the list already carries every field this page shows.
    const [schools, allCampuses] = await Promise.all([
      api.listSchools(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
    const found = schools.find((s) => s.id === schoolId) ?? null;
    if (!found) {
      errorMessage.value = 'School not found.';
      return;
    }
    school.value = found;
    campuses.value = allCampuses.filter((c) => c.schoolId === schoolId);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this school.';
  }
}
load();

const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : value);
const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : null);

const chips = computed(() =>
  [school.value?.code, school.value?.schoolType, school.value?.educationBoard].filter((v): v is string => !!v),
);
const stats = computed(() => [
  { label: 'Campuses', value: school.value?.campusCount ?? 0 },
  { label: 'Students', value: school.value?.studentCount ?? 0 },
  { label: 'Staff', value: school.value?.staffCount ?? 0 },
]);
</script>

<template>
  <div class="org-profile">
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <template v-if="school">
      <OrgProfileHeader
        :name="school.name"
        :status-label="school.status === 'ACTIVE' ? 'Active' : 'Inactive'"
        :status-tone="school.status === 'ACTIVE' ? 'success' : 'neutral'"
        back-to="/admin/schools"
        back-label="Schools"
        :chips="chips"
        :stats="stats"
      />

      <ProfileSectionCard icon="home" title="Overview">
        <div class="field-grid">
          <div class="field"><span class="field-label">Registration no.</span><span class="field-value mono">{{ show(school.registrationNumber) }}</span></div>
          <div class="field"><span class="field-label">School type</span><span class="field-value">{{ show(school.schoolType) }}</span></div>
          <div class="field"><span class="field-label">Education board</span><span class="field-value">{{ show(school.educationBoard) }}</span></div>
          <div class="field"><span class="field-label">Established</span><span class="field-value mono">{{ show(dateOnly(school.establishedDate)) }}</span></div>
          <div class="field"><span class="field-label">Timezone</span><span class="field-value">{{ show(school.timezone) }}</span></div>
          <div class="field"><span class="field-label">Currency</span><span class="field-value">{{ show(school.currency) }}</span></div>
          <div class="field"><span class="field-label">Website</span><span class="field-value">{{ show(school.website) }}</span></div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="chat" title="Contact">
        <div class="field-grid">
          <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(school.phone) }}</span></div>
          <div class="field"><span class="field-label">Alternate phone</span><span class="field-value mono">{{ show(school.alternatePhone) }}</span></div>
          <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(school.email) }}</span></div>
          <div class="field"><span class="field-label">Address</span><span class="field-value address-block">{{ show(school.address) }}</span></div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="user-circle" title="Principal">
        <div class="field-grid">
          <div class="field"><span class="field-label">Name</span><span class="field-value">{{ show(school.principalName) }}</span></div>
          <div class="field"><span class="field-label">Phone</span><span class="field-value mono">{{ show(school.principalPhone) }}</span></div>
          <div class="field"><span class="field-label">Email</span><span class="field-value">{{ show(school.principalEmail) }}</span></div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon="grid" title="Campuses">
        <p v-if="campuses.length === 0" class="muted" data-testid="no-campuses">This school has no campuses yet.</p>
        <ul v-else class="campus-list">
          <li v-for="campus in campuses" :key="campus.id">
            <RouterLink :data-testid="`campus-link-${campus.id}`" :to="`/admin/campuses/${campus.id}`">{{ campus.name }}</RouterLink>
            <span class="muted mono">{{ campus.studentCount }} students · {{ campus.staffCount }} staff</span>
          </li>
        </ul>
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
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.campus-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.campus-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.campus-list li:last-child {
  border-bottom: none;
}
</style>
