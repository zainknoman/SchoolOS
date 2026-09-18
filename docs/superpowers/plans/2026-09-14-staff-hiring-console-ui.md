# Staff & Hiring Console UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-console (Vue 3) UI for the Staff & Hiring backend that already exists
(`backend/src/staff`, `backend/src/hiring` — implemented and merged per
`docs/superpowers/plans/2026-09-14-staff-hiring-foundation.md`): an "all staff" list + profile
page (identity/contact/address, emergency contacts, experience, documents), and a Hiring
candidate-intake → queue → review/approve pipeline that creates the `Staff` record (and, for
teacher hires, the linked `Teacher` row) on approval.

**Architecture:** Two new view families mirroring the two closest existing features exactly:
Staff's list+profile mirrors Student's (`StudentManagementView.vue`/`StudentProfileView.vue`,
same `EntityTable`/`FormField`/`AppModal`/`StatusPill` components, same edit-section-per-`<section>`
pattern), and Hiring's intake/queue/review mirrors Admissions' (`ApplicantIntakeView.vue`/
`AdmissionsQueueView.vue`/`ApplicationDetailView.vue`). Every new fetch call is added to the
existing single `staff-console/src/lib/api.ts` (a plain `export const api = {...}` object, no
class, no separate types file — new interfaces/methods are colocated there like every other
domain). No new shared components, no new CSS tokens, no new dependencies.

**Tech Stack:** Vue 3 (`<script setup>`), Vue Router 5, Pinia, vue-i18n, Vitest + `@vue/test-utils`.

**Spec:** `docs/superpowers/plans/2026-09-14-staff-hiring-foundation.md` (the backend plan — read
for the exact DTO shapes/routes this UI calls; do not re-read the backend source unless a detail
below is ambiguous, the backend is already built and frozen), `docs/database/migration-plan.md`
(Sub-project 3 section, in particular the `- [ ] Staff-console UI` line this plan closes out).

## Global Constraints

- The backend is complete and **must not be modified** by this plan — every task here only
  touches `staff-console/**`. If a step seems to need a backend change, stop; it means a fact in
  this plan is stale (the backend evolved after the linked backend plan was written — e.g.
  `StaffController.list` now scopes by the acting admin's school) and the plan needs correcting,
  not the backend.
- Staff creation happens **only** through the Hiring approval flow — there is no "Add Staff"
  button anywhere in this UI, matching the backend's `StaffController` being list/read-only. Do
  not add one.
- Every new route is `requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN']` — **not** `ACCOUNTS`, unlike
  Admissions' routes. This matches `StaffController`/`StaffProfileController`/
  `HiringCandidatesController`/`HiringApplicationsController`'s own `@Roles('SCHOOL_ADMIN',
  'SUPER_ADMIN')` (no `ACCOUNTS`) — hiring is an HR function, not a fee-adjacent one, per the
  backend plan's own Global Constraints.
- Reuse `AddressDetail`/`AddressInput` (already in `api.ts`, backing Student's addresses) as-is
  for every Staff/emergency-contact address — the backend's `AddressDto` is the same shared DTO
  Student uses. Do not declare a new address type.
- Every other Staff/Hiring type and payload gets its own distinctly-named interface
  (`StaffEmergencyContactDetail`, not a reuse of `StudentEmergencyContactDetail`), even where the
  shape is currently identical to Student's. The backend itself made this same choice (separate
  `StaffEmergencyContact`/`StaffDocument` Prisma models, not a shared table) — mirror it, don't
  couple the two domains through an incidental shape match that could diverge later.
- Dates render/edit as `YYYY-MM-DD` (`value.slice(0, 10)` on read, a bare `<input type="date">`
  value on write), matching every existing profile view.
- `api.ts` has no dedicated spec file anywhere in this codebase (grep confirms it) — its fetch
  wrappers are verified indirectly through the view specs that mock and assert against them, not
  independently. Do not add one.
- Follow the `EntityTable`/`FormField`/`AppModal`/`Button`/`StatusPill` components exactly as they
  exist today (`staff-console/src/components/*.vue`) — their props are fixed; do not add props or
  variants to them for this plan.
- Test everything with `data-testid` selectors (never CSS classes or text-only queries for
  interaction), matching every existing `*.spec.ts` in this codebase.

---

### Task 1: Staff API client + Staff list page + Staff profile (identity/contact/address)

**Files:**
- Create: `staff-console/src/lib/staff-profile.constants.ts`
- Modify: `staff-console/src/lib/api.ts`
- Create: `staff-console/src/views/StaffManagementView.vue`
- Create: `staff-console/src/views/StaffManagementPageView.vue`
- Create: `staff-console/src/views/StaffManagementView.spec.ts`
- Create: `staff-console/src/views/StaffProfileView.vue`
- Create: `staff-console/src/views/StaffProfilePageView.vue`
- Create: `staff-console/src/views/StaffProfileView.spec.ts`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`
- Modify: `staff-console/src/locales/en.json`
- Modify: `staff-console/src/locales/ur.json`

**Interfaces:**
- Consumes: `EntityTable`/`FormField`/`Button` components, `useAuthStore`, `api.uploadFile`/
  `api.filePreviewUrl`/`AddressDetail`/`AddressInput` (all already exist in `api.ts`),
  `initialsFromName` (`../lib/format`).
- Produces: `StaffAdminSummary`, `StaffEmergencyContactDetail`, `StaffExperienceDetail`,
  `StaffDocumentDetail`, `StaffProfileDetail`, `UpdateStaffProfilePayload` types and
  `api.listAdminStaff`/`getStaffProfile`/`updateStaffProfile` methods in `api.ts` — Tasks 2-4
  append CRUD payload types/methods and append `<section>`s to `StaffProfileView.vue` using these
  same `StaffProfileDetail.emergencyContacts`/`.experience`/`.documents` arrays. `EMPLOYEE_TYPE_OPTIONS`/
  `EMPLOYMENT_STATUS_OPTIONS` (from `staff-profile.constants.ts`) are reused by Task 6's intake form.

- [ ] **Step 1: Write `staff-profile.constants.ts`**

  ```typescript
  // staff-console/src/lib/staff-profile.constants.ts
  // Mirrors backend/prisma/schema.prisma's EmployeeType/EmploymentStatus enums. Gender and
  // DocumentType are already covered by student-profile.constants.ts (Staff reuses the exact
  // same backend enums Student does for both) — re-exported here so every Staff view only ever
  // imports option lists from this one file.
  import type { SelectOption } from './student-profile.constants';
  export type { SelectOption };
  export { GENDER_OPTIONS, DOCUMENT_TYPE_OPTIONS } from './student-profile.constants';

  export const EMPLOYEE_TYPE_OPTIONS: SelectOption[] = [
    { value: 'TEACHER', label: 'Teacher' },
    { value: 'OFFICE_STAFF', label: 'Office Staff' },
    { value: 'JANITORIAL', label: 'Janitorial' },
    { value: 'HELPER', label: 'Helper' },
    { value: 'GUARD', label: 'Guard' },
    { value: 'OTHER', label: 'Other' },
  ];

  export const EMPLOYMENT_STATUS_OPTIONS: SelectOption[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ON_LEAVE', label: 'On Leave' },
    { value: 'TERMINATED', label: 'Terminated' },
    { value: 'RESIGNED', label: 'Resigned' },
  ];
  ```

- [ ] **Step 2: Add Staff types to `api.ts`**

  Insert immediately before the existing `export interface BulkImportRowOutcome {` block:

  ```typescript
  export interface StaffAdminSummary {
    id: string;
    name: string;
    employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
    employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
    campusName: string;
  }

  export interface StaffEmergencyContactDetail {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    alternatePhone: string | null;
    email: string | null;
    address: AddressDetail | null;
    priority: number;
    isPrimary: boolean;
  }

  export interface StaffExperienceDetail {
    id: string;
    organization: string;
    role: string;
    fromDate: string | null;
    toDate: string | null;
    description: string | null;
  }

  export interface StaffDocumentDetail {
    id: string;
    documentType: string;
    file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
    expiryDate: string | null;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    verifiedById: string | null;
    verifiedAt: string | null;
    notes: string | null;
    createdAt: string;
  }

  export interface StaffProfileDetail {
    id: string;
    name: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    dateOfBirth: string | null;
    cnic: string | null;
    mobile: string | null;
    email: string | null;
    profilePhotoFileId: string | null;
    currentAddress: AddressDetail | null;
    permanentAddress: AddressDetail | null;
    joiningDate: string | null;
    employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
    leavingDate: string | null;
    leavingReason: string | null;
    teacher: { id: string; name: string } | null;
    emergencyContacts: StaffEmergencyContactDetail[];
    experience: StaffExperienceDetail[];
    documents: StaffDocumentDetail[];
  }

  export interface UpdateStaffProfilePayload {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    cnic?: string;
    mobile?: string;
    email?: string;
    profilePhotoFileId?: string;
    joiningDate?: string;
    employmentStatus?: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
    leavingDate?: string;
    leavingReason?: string;
    currentAddress?: AddressInput;
    permanentAddress?: AddressInput;
  }
  ```

- [ ] **Step 3: Add Staff methods to `api.ts`**

  Insert immediately after the existing `verifyStudentDocument` method (ends right before
  `listSectionDiary`):

  ```typescript
    async listAdminStaff(accessToken: string, employeeType?: string): Promise<StaffAdminSummary[]> {
      const suffix = employeeType ? `?employeeType=${encodeURIComponent(employeeType)}` : '';
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff${suffix}`, {
        headers: authHeaders(accessToken),
      });
      return asJson(res);
    },

    async getStaffProfile(accessToken: string, staffId: string): Promise<StaffProfileDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/profile`, {
        headers: authHeaders(accessToken),
      });
      return asJson(res);
    },

    async updateStaffProfile(
      accessToken: string,
      staffId: string,
      payload: UpdateStaffProfilePayload,
    ): Promise<StaffProfileDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },
  ```

- [ ] **Step 4: Write the failing test for `StaffManagementView`**

  ```typescript
  // staff-console/src/views/StaffManagementView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import StaffManagementView from './StaffManagementView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api } from '../lib/api';

  async function mountView() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/admin/staff', name: 'admin-staff', component: StaffManagementView }],
    });
    await router.push('/admin/staff');
    await router.isReady();
    return mount(StaffManagementView, { global: { plugins: [router] } });
  }

  vi.mock('../lib/api', () => ({
    api: { listAdminStaff: vi.fn() },
  }));

  describe('StaffManagementView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
      vi.mocked(api.listAdminStaff).mockResolvedValue([
        { id: 'st1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campusName: 'PECHS Campus' },
      ]);
    });

    it('lists staff with their employee type and campus', async () => {
      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Nazir Ahmed');
      expect(wrapper.text()).toContain('PECHS Campus');
    });

    it("links each row to that staff member's profile page", async () => {
      const wrapper = await mountView();
      await flushPromises();

      const link = wrapper.find('[data-testid="view-profile-st1"]');
      expect(link.exists()).toBe(true);
      expect(link.attributes('href')).toBe('/admin/staff/st1');
    });

    it('reloads filtered by employee type when the filter changes', async () => {
      const wrapper = await mountView();
      await flushPromises();
      vi.mocked(api.listAdminStaff).mockResolvedValue([]);

      await wrapper.find('[data-testid="filter-employee-type"]').setValue('GUARD');
      await flushPromises();

      expect(api.listAdminStaff).toHaveBeenCalledWith('token-1', 'GUARD');
    });
  });
  ```

- [ ] **Step 5: Run the test to verify it fails**

  Run: `cd staff-console && npx vitest run StaffManagementView.spec.ts`
  Expected: FAIL — `Cannot find module './StaffManagementView.vue'`.

- [ ] **Step 6: Write `StaffManagementView.vue`**

  ```vue
  <!-- staff-console/src/views/StaffManagementView.vue -->
  <script setup lang="ts">
  import { ref } from 'vue';
  import { RouterLink } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { api, type StaffAdminSummary } from '../lib/api';
  import { EMPLOYEE_TYPE_OPTIONS } from '../lib/staff-profile.constants';
  import EntityTable from '../components/EntityTable.vue';
  import FormField from '../components/FormField.vue';

  const auth = useAuthStore();

  const staff = ref<StaffAdminSummary[]>([]);
  const errorMessage = ref<string | null>(null);
  const selectedEmployeeType = ref('');

  async function load() {
    if (!auth.accessToken) return;
    errorMessage.value = null;
    try {
      staff.value = await api.listAdminStaff(auth.accessToken, selectedEmployeeType.value || undefined);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not load staff.';
    }
  }
  load();
  </script>

  <template>
    <div class="org-entity">
      <div class="page-header">
        <h1>Staff</h1>
      </div>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <div class="filter-row">
        <FormField
          v-model="selectedEmployeeType"
          label="Employee type"
          type="select"
          data-testid="filter-employee-type"
          placeholder="All employee types"
          :options="EMPLOYEE_TYPE_OPTIONS"
          @update:model-value="load"
        />
      </div>

      <EntityTable
        :items="staff"
        :columns="[
          { key: 'name', label: 'Name' },
          { key: 'employeeType', label: 'Employee Type' },
          { key: 'employmentStatus', label: 'Status' },
          { key: 'campusName', label: 'Campus' },
        ]"
        row-key="id"
        :editing-id="null"
      >
        <template #actions="{ item }">
          <RouterLink :data-testid="`view-profile-${item.id}`" :to="`/admin/staff/${item.id}`">View Profile</RouterLink>
        </template>
      </EntityTable>
    </div>
  </template>

  <style scoped>
  .org-entity {
    max-width: 1100px;
  }
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }
  .error {
    color: var(--color-destructive);
    margin-bottom: var(--space-3);
  }
  .filter-row {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  </style>
  ```

- [ ] **Step 7: Write `StaffManagementPageView.vue`**

  ```vue
  <!-- staff-console/src/views/StaffManagementPageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import StaffManagementView from './StaffManagementView.vue';
  </script>

  <template>
    <AppShell>
      <StaffManagementView />
    </AppShell>
  </template>
  ```

- [ ] **Step 8: Run the test to verify it passes**

  Run: `npx vitest run StaffManagementView.spec.ts`
  Expected: PASS, 3 tests.

- [ ] **Step 9: Write the failing test for `StaffProfileView`'s profile section**

  ```typescript
  // staff-console/src/views/StaffProfileView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import StaffProfileView from './StaffProfileView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api, type StaffProfileDetail } from '../lib/api';
  import { useConfirm } from '../lib/useConfirm';

  async function mountView(staffId = 'st1') {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/admin/staff/:id', name: 'admin-staff-profile', component: StaffProfileView }],
    });
    await router.push(`/admin/staff/${staffId}`);
    await router.isReady();
    return mount(StaffProfileView, { global: { plugins: [router] } });
  }

  function baseProfile(overrides: Partial<StaffProfileDetail> = {}): StaffProfileDetail {
    return {
      id: 'st1', name: 'Nazir Ahmed', firstName: 'Nazir', middleName: null, lastName: 'Ahmed',
      employeeType: 'JANITORIAL', gender: 'MALE', dateOfBirth: null, cnic: null, mobile: '0300-1112233',
      email: null, profilePhotoFileId: null, currentAddress: null, permanentAddress: null,
      joiningDate: '2023-01-15', employmentStatus: 'ACTIVE', leavingDate: null, leavingReason: null,
      teacher: null, emergencyContacts: [], experience: [], documents: [],
      ...overrides,
    };
  }

  vi.mock('../lib/useConfirm', () => ({
    useConfirm: vi.fn(),
  }));

  vi.mock('../lib/api', () => ({
    api: {
      getStaffProfile: vi.fn(),
      updateStaffProfile: vi.fn(),
      uploadFile: vi.fn(),
      filePreviewUrl: vi.fn(),
    },
  }));

  describe('StaffProfileView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
      vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:preview'),
        revokeObjectURL: vi.fn(),
      });
    });

    it('loads and displays the staff profile read-only', async () => {
      vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());

      const wrapper = await mountView();
      await flushPromises();

      expect(api.getStaffProfile).toHaveBeenCalledWith('token-1', 'st1');
      expect(wrapper.text()).toContain('Nazir Ahmed');
      expect(wrapper.text()).toContain('JANITORIAL');
      expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
    });

    it('shows a page-level error when the profile fails to load', async () => {
      vi.mocked(api.getStaffProfile).mockRejectedValue(new Error('Staff member not found'));

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.find('[role="alert"]').text()).toContain('Staff member not found');
    });

    it('shows the linked teacher account when present', async () => {
      vi.mocked(api.getStaffProfile).mockResolvedValue(
        baseProfile({ employeeType: 'TEACHER', teacher: { id: 't1', name: 'Ayesha Khan' } }),
      );

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Ayesha Khan');
    });

    it('edits identity/contact/employment fields', async () => {
      vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
      vi.mocked(api.updateStaffProfile).mockResolvedValue(baseProfile({ mobile: '0300-9998877' }));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="edit-profile"]').trigger('click');
      await wrapper.find('[data-testid="profile-mobile"]').setValue('0300-9998877');
      await wrapper.find('[data-testid="profile-save"]').trigger('click');
      await flushPromises();

      expect(api.updateStaffProfile).toHaveBeenCalledWith('token-1', 'st1', expect.objectContaining({
        mobile: '0300-9998877',
      }));
    });

    it('shows an initials placeholder in the top-right photo avatar when no photo is on file', async () => {
      vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({ profilePhotoFileId: null }));

      const wrapper = await mountView();
      await flushPromises();

      const trigger = wrapper.find('[data-testid="profile-photo-trigger"]');
      expect(trigger.text()).toBe('NA');
      expect(trigger.find('img').exists()).toBe(false);
    });

    it('uploads and saves a new photo chosen from the top-right avatar control', async () => {
      vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
      vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f2' });
      vi.mocked(api.updateStaffProfile).mockResolvedValue(baseProfile({ profilePhotoFileId: 'f2' }));

      const wrapper = await mountView();
      await flushPromises();

      const fileInput = wrapper.find('[data-testid="profile-photo-input"]');
      const file = new File(['data'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(fileInput.element, 'files', { value: [file] });
      await fileInput.trigger('change');
      await flushPromises();

      expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
      expect(api.updateStaffProfile).toHaveBeenCalledWith('token-1', 'st1', { profilePhotoFileId: 'f2' });
    });
  });
  ```

- [ ] **Step 10: Run the test to verify it fails**

  Run: `npx vitest run StaffProfileView.spec.ts`
  Expected: FAIL — `Cannot find module './StaffProfileView.vue'`.

- [ ] **Step 11: Write `StaffProfileView.vue`**

  ```vue
  <!-- staff-console/src/views/StaffProfileView.vue -->
  <script setup lang="ts">
  import { computed, onBeforeUnmount, reactive, ref } from 'vue';
  import { useRoute } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { api, type AddressInput, type StaffProfileDetail } from '../lib/api';
  import { GENDER_OPTIONS, EMPLOYMENT_STATUS_OPTIONS } from '../lib/staff-profile.constants';
  import FormField from '../components/FormField.vue';
  import Button from '../components/Button.vue';
  import { initialsFromName } from '../lib/format';

  const auth = useAuthStore();
  const route = useRoute();
  const staffId = route.params.id as string;

  const profile = ref<StaffProfileDetail | null>(null);
  const pageErrorMessage = ref<string | null>(null);

  async function load() {
    if (!auth.accessToken) return;
    try {
      profile.value = await api.getStaffProfile(auth.accessToken, staffId);
    } catch (err) {
      pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this staff member.';
    }
  }
  load();

  // Every field here is always a definite string (never undefined) so it can bind to FormField's
  // `modelValue: string | boolean` prop — AddressInput's fields are optional (string | undefined),
  // which only matters at the API payload boundary, not in this always-populated form state.
  function emptyAddress() {
    return { line1: '', line2: '', area: '', city: '', district: '', province: '', postalCode: '', country: '' };
  }
  function addressPayload(a: ReturnType<typeof emptyAddress>): AddressInput | undefined {
    return a.line1.trim() ? a : undefined;
  }

  // --- Profile section (identity/contact/employment + addresses) ------------------------------
  const isEditingProfile = ref(false);
  const profileErrorMessage = ref<string | null>(null);
  const isSavingProfile = ref(false);

  const profileForm = reactive({
    firstName: '', middleName: '', lastName: '',
    gender: '', dateOfBirth: '', cnic: '', mobile: '', email: '',
    joiningDate: '', employmentStatus: 'ACTIVE', leavingDate: '', leavingReason: '',
  });
  const currentAddressForm = reactive(emptyAddress());
  const permanentAddressForm = reactive(emptyAddress());

  function startEditProfile() {
    if (!profile.value) return;
    const p = profile.value;
    profileForm.firstName = p.firstName ?? '';
    profileForm.middleName = p.middleName ?? '';
    profileForm.lastName = p.lastName ?? '';
    profileForm.gender = p.gender ?? '';
    profileForm.dateOfBirth = p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '';
    profileForm.cnic = p.cnic ?? '';
    profileForm.mobile = p.mobile ?? '';
    profileForm.email = p.email ?? '';
    profileForm.joiningDate = p.joiningDate ? p.joiningDate.slice(0, 10) : '';
    profileForm.employmentStatus = p.employmentStatus;
    profileForm.leavingDate = p.leavingDate ? p.leavingDate.slice(0, 10) : '';
    profileForm.leavingReason = p.leavingReason ?? '';
    Object.assign(currentAddressForm, p.currentAddress ? { ...emptyAddress(), ...p.currentAddress } : emptyAddress());
    Object.assign(permanentAddressForm, p.permanentAddress ? { ...emptyAddress(), ...p.permanentAddress } : emptyAddress());
    profileErrorMessage.value = null;
    isEditingProfile.value = true;
  }

  function cancelEditProfile() {
    isEditingProfile.value = false;
    profileErrorMessage.value = null;
  }

  async function onSaveProfile() {
    if (!auth.accessToken) return;
    profileErrorMessage.value = null;
    isSavingProfile.value = true;
    try {
      await api.updateStaffProfile(auth.accessToken, staffId, {
        firstName: profileForm.firstName || undefined,
        middleName: profileForm.middleName || undefined,
        lastName: profileForm.lastName || undefined,
        gender: (profileForm.gender || undefined) as StaffProfileDetail['gender'] & string | undefined,
        dateOfBirth: profileForm.dateOfBirth || undefined,
        cnic: profileForm.cnic || undefined,
        mobile: profileForm.mobile || undefined,
        email: profileForm.email || undefined,
        joiningDate: profileForm.joiningDate || undefined,
        employmentStatus: profileForm.employmentStatus as StaffProfileDetail['employmentStatus'],
        leavingDate: profileForm.leavingDate || undefined,
        leavingReason: profileForm.leavingReason || undefined,
        currentAddress: addressPayload(currentAddressForm),
        permanentAddress: addressPayload(permanentAddressForm),
      });
      await load();
      isEditingProfile.value = false;
    } catch (err) {
      profileErrorMessage.value = err instanceof Error ? err.message : 'Could not save this profile.';
    } finally {
      isSavingProfile.value = false;
    }
  }

  // --- Profile photo (top-right avatar) --------------------------------------------------------
  const photoInputRef = ref<HTMLInputElement | null>(null);
  const photoPreviewUrl = ref<string | null>(null);
  const photoErrorMessage = ref<string | null>(null);
  const isSavingPhoto = ref(false);

  const displayPhotoUrl = computed(() => {
    if (photoPreviewUrl.value) return photoPreviewUrl.value;
    const fileId = profile.value?.profilePhotoFileId;
    return fileId && auth.accessToken ? api.filePreviewUrl(auth.accessToken, fileId) : null;
  });

  function triggerPhotoInput() {
    photoInputRef.value?.click();
  }

  async function onPhotoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !auth.accessToken) return;

    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value);
    photoPreviewUrl.value = URL.createObjectURL(file);

    photoErrorMessage.value = null;
    isSavingPhoto.value = true;
    try {
      const uploaded = await api.uploadFile(auth.accessToken, file);
      await api.updateStaffProfile(auth.accessToken, staffId, { profilePhotoFileId: uploaded.id });
      await load();
    } catch (err) {
      photoErrorMessage.value = err instanceof Error ? err.message : 'Could not upload this photo.';
    } finally {
      isSavingPhoto.value = false;
    }
  }

  onBeforeUnmount(() => {
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value);
  });
  </script>

  <template>
    <div class="staff-profile">
      <div class="page-header">
        <h1 v-if="profile">{{ profile.name }}</h1>
        <h1 v-else>Staff Profile</h1>

        <div v-if="profile" class="photo-widget">
          <button
            type="button"
            class="photo-avatar"
            data-testid="profile-photo-trigger"
            :disabled="isSavingPhoto"
            @click="triggerPhotoInput"
          >
            <img v-if="displayPhotoUrl" :src="displayPhotoUrl" alt="" class="photo-avatar-img" />
            <template v-else>{{ initialsFromName(profile.name) }}</template>
          </button>
          <label class="sr-only" for="profile-photo-input">Staff photo</label>
          <input
            id="profile-photo-input"
            ref="photoInputRef"
            type="file"
            accept="image/*"
            class="sr-only"
            data-testid="profile-photo-input"
            @change="onPhotoFileSelected"
          />
          <span class="photo-hint">{{ isSavingPhoto ? 'Uploading…' : (profile.profilePhotoFileId ? 'Change photo' : 'Upload photo') }}</span>
        </div>
      </div>
      <p v-if="photoErrorMessage" class="error" role="alert" data-testid="profile-photo-error">{{ photoErrorMessage }}</p>
      <p v-if="pageErrorMessage" class="error" role="alert">{{ pageErrorMessage }}</p>

      <div v-if="profile" class="sections">
        <section class="profile-section">
          <div class="section-header">
            <h2>Profile</h2>
            <Button v-if="!isEditingProfile" data-testid="edit-profile" @click="startEditProfile">Edit</Button>
          </div>
          <p v-if="profileErrorMessage" data-testid="profile-error" class="error" role="alert">{{ profileErrorMessage }}</p>

          <dl v-if="!isEditingProfile" class="detail-grid">
            <dt>Full name</dt><dd>{{ profile.name }}</dd>
            <dt>Employee type</dt><dd>{{ profile.employeeType }}</dd>
            <dt>Employment status</dt><dd>{{ profile.employmentStatus }}</dd>
            <dt>Gender</dt><dd>{{ profile.gender ?? '—' }}</dd>
            <dt>Date of birth</dt><dd>{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</dd>
            <dt>CNIC</dt><dd>{{ profile.cnic ?? '—' }}</dd>
            <dt>Mobile</dt><dd>{{ profile.mobile ?? '—' }}</dd>
            <dt>Email</dt><dd>{{ profile.email ?? '—' }}</dd>
            <dt>Joining date</dt><dd>{{ profile.joiningDate ? profile.joiningDate.slice(0, 10) : '—' }}</dd>
            <dt>Leaving date</dt><dd>{{ profile.leavingDate ? profile.leavingDate.slice(0, 10) : '—' }}</dd>
            <dt>Linked teacher account</dt><dd>{{ profile.teacher ? profile.teacher.name : '—' }}</dd>
            <dt>Current address</dt>
            <dd>{{ profile.currentAddress ? [profile.currentAddress.line1, profile.currentAddress.city].filter(Boolean).join(', ') : '—' }}</dd>
            <dt>Permanent address</dt>
            <dd>{{ profile.permanentAddress ? [profile.permanentAddress.line1, profile.permanentAddress.city].filter(Boolean).join(', ') : '—' }}</dd>
          </dl>

          <div v-else class="edit-form">
            <div class="inline-form">
              <FormField v-model="profileForm.firstName" label="First name" type="text" data-testid="profile-firstName" placeholder="First name" grow />
              <FormField v-model="profileForm.middleName" label="Middle name" type="text" data-testid="profile-middleName" placeholder="Middle name" grow />
              <FormField v-model="profileForm.lastName" label="Last name" type="text" data-testid="profile-lastName" placeholder="Last name" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
              <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" />
              <FormField v-model="profileForm.cnic" label="CNIC" type="text" data-testid="profile-cnic" placeholder="CNIC" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.mobile" label="Mobile" type="text" data-testid="profile-mobile" placeholder="Mobile" grow />
              <FormField v-model="profileForm.email" label="Email" type="email" data-testid="profile-email" placeholder="Email" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.joiningDate" label="Joining date" type="date" data-testid="profile-joiningDate" />
              <FormField v-model="profileForm.employmentStatus" label="Employment status" type="select" data-testid="profile-employmentStatus" :options="EMPLOYMENT_STATUS_OPTIONS" />
              <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" />
            </div>
            <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />

            <h3>Current address</h3>
            <div class="inline-form">
              <FormField v-model="currentAddressForm.line1" label="Line 1" type="text" data-testid="profile-currentAddress-line1" placeholder="Line 1" grow />
              <FormField v-model="currentAddressForm.line2" label="Line 2" type="text" data-testid="profile-currentAddress-line2" placeholder="Line 2" grow />
              <FormField v-model="currentAddressForm.area" label="Area" type="text" data-testid="profile-currentAddress-area" placeholder="Area" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="currentAddressForm.city" label="City" type="text" data-testid="profile-currentAddress-city" placeholder="City" grow />
              <FormField v-model="currentAddressForm.province" label="Province" type="text" data-testid="profile-currentAddress-province" placeholder="Province" grow />
              <FormField v-model="currentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-currentAddress-postalCode" placeholder="Postal code" grow />
            </div>

            <h3>Permanent address</h3>
            <div class="inline-form">
              <FormField v-model="permanentAddressForm.line1" label="Line 1" type="text" data-testid="profile-permanentAddress-line1" placeholder="Line 1" grow />
              <FormField v-model="permanentAddressForm.line2" label="Line 2" type="text" data-testid="profile-permanentAddress-line2" placeholder="Line 2" grow />
              <FormField v-model="permanentAddressForm.area" label="Area" type="text" data-testid="profile-permanentAddress-area" placeholder="Area" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="permanentAddressForm.city" label="City" type="text" data-testid="profile-permanentAddress-city" placeholder="City" grow />
              <FormField v-model="permanentAddressForm.province" label="Province" type="text" data-testid="profile-permanentAddress-province" placeholder="Province" grow />
              <FormField v-model="permanentAddressForm.postalCode" label="Postal code" type="text" data-testid="profile-permanentAddress-postalCode" placeholder="Postal code" grow />
            </div>

            <div class="form-actions">
              <Button data-testid="profile-save" :disabled="isSavingProfile" @click="onSaveProfile">Save</Button>
              <Button variant="secondary" data-testid="profile-cancel" @click="cancelEditProfile">Cancel</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </template>

  <style scoped>
  .staff-profile {
    max-width: 900px;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .photo-widget {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  .photo-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 50%;
    border: none;
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-size: var(--font-size-md);
    font-weight: 700;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
  }
  .photo-avatar:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .photo-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-hint {
    font-size: var(--font-size-xs);
    color: var(--color-muted, #64748b);
  }
  .error {
    color: var(--color-destructive);
    margin-bottom: var(--space-3);
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .profile-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-1) var(--space-3);
  }
  .detail-grid dt {
    font-weight: 600;
    color: var(--color-muted, #64748b);
  }
  .detail-grid dd {
    margin: 0;
  }
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .inline-form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .form-actions {
    display: flex;
    gap: var(--space-2);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  </style>
  ```

- [ ] **Step 12: Write `StaffProfilePageView.vue`**

  ```vue
  <!-- staff-console/src/views/StaffProfilePageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import StaffProfileView from './StaffProfileView.vue';
  </script>

  <template>
    <AppShell>
      <StaffProfileView />
    </AppShell>
  </template>
  ```

- [ ] **Step 13: Run the test to verify it passes**

  Run: `npx vitest run StaffProfileView.spec.ts`
  Expected: PASS, 6 tests.

- [ ] **Step 14: Add routes**

  In `staff-console/src/router/index.ts`, insert immediately after the `/admin/students/:id` route
  block:

  ```typescript
    {
      path: '/admin/staff',
      name: 'admin-staff',
      component: () => import('../views/StaffManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff' },
    },
    {
      path: '/admin/staff/:id',
      name: 'admin-staff-profile',
      component: () => import('../views/StaffProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff Profile' },
    },
  ```

- [ ] **Step 15: Add the nav link**

  In `staff-console/src/components/AppShell.vue`, inside the `v-if="canManagePeople"` nav group
  (the "People" group), insert immediately after the `nav-students` `RouterLink`:

  ```html
        <RouterLink data-testid="nav-staff" to="/admin/staff"><Icon name="users" />{{ t('nav.staff') }}</RouterLink>
  ```

  No new gating `computed()` is needed — `canManagePeople` (`SCHOOL_ADMIN`/`SUPER_ADMIN`) already
  matches `StaffController`'s `@Roles`.

- [ ] **Step 16: Add the i18n key**

  In `staff-console/src/locales/en.json`, inside `"nav"`, insert `"staff": "Staff",` immediately
  after `"students": "Students",`.

  In `staff-console/src/locales/ur.json`, inside `"nav"`, insert `"staff": "عملہ",` immediately
  after `"students": "طلباء",`.

- [ ] **Step 17: Write the failing nav test**

  In `staff-console/src/components/AppShell.spec.ts`, add `{ path: '/admin/staff', name:
  'admin-staff', component: { template: '<div>staff</div>' } }` to the `routes` array in
  `makeRouter()`, immediately after the `/admin/students` route entry. Then add this test after
  the `'shows the People CRUD nav links (Teachers/Parents/Students) for a SCHOOL_ADMIN role'` test:

  ```typescript
    it('shows nav-staff for SCHOOL_ADMIN/SUPER_ADMIN and hides it for ACCOUNTS/TEACHER', async () => {
      let wrapper = await mountAsRole('SCHOOL_ADMIN');
      expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-staff"]').attributes('href')).toBe('/admin/staff');

      wrapper = await mountAsRole('SUPER_ADMIN');
      expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(true);

      wrapper = await mountAsRole('ACCOUNTS');
      expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(false);

      wrapper = await mountAsRole('TEACHER');
      expect(wrapper.find('[data-testid="nav-staff"]').exists()).toBe(false);
    });
  ```

- [ ] **Step 18: Type-check and run the full frontend test suite**

  Run: `cd staff-console && npm run type-check && npm run test`
  Expected: both pass.

- [ ] **Step 19: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add Staff list and profile identity/contact/address pages"
  ```

---

### Task 2: Staff profile — Emergency Contacts section

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Modify: `staff-console/src/views/StaffProfileView.vue`
- Modify: `staff-console/src/views/StaffProfileView.spec.ts`

**Interfaces:**
- Consumes: `StaffProfileDetail.emergencyContacts` (Task 1), `useConfirm` (`../lib/useConfirm`,
  already imported in every profile view).
- Produces: `api.createStaffEmergencyContact`/`updateStaffEmergencyContact`/
  `deleteStaffEmergencyContact` — no later task depends on these.

- [ ] **Step 1: Add payload types to `api.ts`**

  Insert immediately after `UpdateStaffProfilePayload`:

  ```typescript
  export interface CreateStaffEmergencyContactPayload {
    name: string;
    relationship: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    priority?: number;
    isPrimary?: boolean;
  }

  export interface UpdateStaffEmergencyContactPayload {
    name?: string;
    relationship?: string;
    phone?: string;
    alternatePhone?: string;
    email?: string;
    priority?: number;
    isPrimary?: boolean;
  }
  ```

  (No `address` field on either payload — matches `StudentEmergencyContact`'s own frontend, which
  also doesn't expose address editing on the contact mini-form, even though the backend DTO
  supports it. This keeps the `EntityTable` inline-row-editing UI consistent across both domains;
  extending it to addresses is out of scope for this plan.)

- [ ] **Step 2: Add methods to `api.ts`**

  Insert immediately after `updateStaffProfile`:

  ```typescript
    async createStaffEmergencyContact(
      accessToken: string,
      staffId: string,
      payload: CreateStaffEmergencyContactPayload,
    ): Promise<StaffEmergencyContactDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async updateStaffEmergencyContact(
      accessToken: string,
      staffId: string,
      contactId: string,
      payload: UpdateStaffEmergencyContactPayload,
    ): Promise<StaffEmergencyContactDetail> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify(payload),
        },
      );
      return asJson(res);
    },

    async deleteStaffEmergencyContact(accessToken: string, staffId: string, contactId: string): Promise<void> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts/${contactId}`,
        { method: 'DELETE', headers: authHeaders(accessToken) },
      );
      if (!res.ok) {
        throw new ApiError(await parseErrorMessage(res), res.status);
      }
    },
  ```

- [ ] **Step 3: Write the failing tests**

  Add to `StaffProfileView.spec.ts`: extend the `vi.mock('../lib/api', ...)` factory's `api`
  object with `createStaffEmergencyContact: vi.fn(), updateStaffEmergencyContact: vi.fn(),
  deleteStaffEmergencyContact: vi.fn(),`. Then add this `describe` block inside the outer
  `describe('StaffProfileView', ...)`:

  ```typescript
    describe('emergency contacts', () => {
      it('adds a contact', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
        vi.mocked(api.createStaffEmergencyContact).mockResolvedValue({
          id: 'ec1', name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233',
          alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false,
        });

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="new-contact-name"]').setValue('Bushra Ahmed');
        await wrapper.find('[data-testid="new-contact-relationship"]').setValue('Spouse');
        await wrapper.find('[data-testid="new-contact-phone"]').setValue('0300-1112233');
        await wrapper.find('[data-testid="add-contact-submit"]').trigger('click');
        await flushPromises();

        expect(api.createStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', {
          name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233',
          alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
        });
      });

      it('edits and deletes a contact', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
          emergencyContacts: [
            { id: 'ec1', name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233', alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false },
          ],
        }));
        vi.mocked(api.updateStaffEmergencyContact).mockResolvedValue({
          id: 'ec1', name: 'Bushra A.', relationship: 'Spouse', phone: '0300-1112233', alternatePhone: null, email: null, address: null, priority: 1, isPrimary: false,
        });
        vi.mocked(api.deleteStaffEmergencyContact).mockResolvedValue(undefined);

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="edit-contact-ec1"]').trigger('click');
        await wrapper.find('[data-testid="edit-contact-name-ec1"]').setValue('Bushra A.');
        await wrapper.find('[data-testid="save-contact-ec1"]').trigger('click');
        await flushPromises();
        expect(api.updateStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', 'ec1', {
          name: 'Bushra A.', relationship: 'Spouse', phone: '0300-1112233',
          alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
        });

        await wrapper.find('[data-testid="delete-contact-ec1"]').trigger('click');
        await flushPromises();
        expect(api.deleteStaffEmergencyContact).toHaveBeenCalledWith('token-1', 'st1', 'ec1');
      });
    });
  ```

- [ ] **Step 4: Run the tests to verify they fail**

  Run: `cd staff-console && npx vitest run StaffProfileView.spec.ts`
  Expected: FAIL — the "Add contact"/edit/delete controls don't exist yet.

- [ ] **Step 5: Add the Emergency Contacts section to `StaffProfileView.vue`**

  Add these imports at the top:

  ```typescript
  import EntityTable from '../components/EntityTable.vue';
  import { useConfirm } from '../lib/useConfirm';
  ```

  Add immediately after `const auth = useAuthStore();`:

  ```typescript
  const { confirm } = useConfirm();
  ```

  Add this block after the `onBeforeUnmount(...)` photo cleanup:

  ```typescript
  // --- Emergency Contacts section ----------------------------------------------------------------
  const contactsErrorMessage = ref<string | null>(null);
  const isSavingContact = ref(false);

  const newContact = reactive({ name: '', relationship: '', phone: '', alternatePhone: '', email: '', priority: '1', isPrimary: false });
  function resetNewContact() {
    newContact.name = '';
    newContact.relationship = '';
    newContact.phone = '';
    newContact.alternatePhone = '';
    newContact.email = '';
    newContact.priority = '1';
    newContact.isPrimary = false;
  }

  async function onAddContact() {
    if (!auth.accessToken || !newContact.name.trim() || !newContact.relationship.trim() || !newContact.phone.trim()) return;
    contactsErrorMessage.value = null;
    isSavingContact.value = true;
    try {
      await api.createStaffEmergencyContact(auth.accessToken, staffId, {
        name: newContact.name.trim(),
        relationship: newContact.relationship.trim(),
        phone: newContact.phone.trim(),
        alternatePhone: newContact.alternatePhone || undefined,
        email: newContact.email || undefined,
        priority: Number(newContact.priority) || 1,
        isPrimary: newContact.isPrimary,
      });
      resetNewContact();
      await load();
    } catch (err) {
      contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this contact.';
    } finally {
      isSavingContact.value = false;
    }
  }

  const editingContactId = ref<string | null>(null);
  const editContactForm = reactive({ name: '', relationship: '', phone: '', alternatePhone: '', email: '', priority: '1', isPrimary: false });

  function startEditContact(contact: StaffProfileDetail['emergencyContacts'][number]) {
    editingContactId.value = contact.id;
    editContactForm.name = contact.name;
    editContactForm.relationship = contact.relationship;
    editContactForm.phone = contact.phone;
    editContactForm.alternatePhone = contact.alternatePhone ?? '';
    editContactForm.email = contact.email ?? '';
    editContactForm.priority = String(contact.priority);
    editContactForm.isPrimary = contact.isPrimary;
  }

  function cancelEditContact() {
    editingContactId.value = null;
  }

  async function onSaveContact(contactId: string) {
    if (!auth.accessToken || !editContactForm.name.trim()) return;
    contactsErrorMessage.value = null;
    try {
      await api.updateStaffEmergencyContact(auth.accessToken, staffId, contactId, {
        name: editContactForm.name.trim(),
        relationship: editContactForm.relationship.trim(),
        phone: editContactForm.phone.trim(),
        alternatePhone: editContactForm.alternatePhone || undefined,
        email: editContactForm.email || undefined,
        priority: Number(editContactForm.priority) || 1,
        isPrimary: editContactForm.isPrimary,
      });
      editingContactId.value = null;
      await load();
    } catch (err) {
      contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not save this contact.';
    }
  }

  async function onDeleteContact(contactId: string) {
    if (!auth.accessToken) return;
    if (!(await confirm({ title: 'Delete this emergency contact?', message: 'This cannot be undone.', danger: true }))) return;
    contactsErrorMessage.value = null;
    try {
      await api.deleteStaffEmergencyContact(auth.accessToken, staffId, contactId);
      await load();
    } catch (err) {
      contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this contact.';
    }
  }
  ```

  Add this `<section>` in the template, immediately after the closing `</section>` of the
  "Profile" section (still inside `<div class="sections">`):

  ```html
        <section class="profile-section">
          <h2>Emergency Contacts</h2>
          <p v-if="contactsErrorMessage" class="error" role="alert">{{ contactsErrorMessage }}</p>

          <EntityTable
            :items="profile.emergencyContacts"
            :columns="[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'priority', label: 'Priority' },
              { key: 'isPrimary', label: 'Primary' },
            ]"
            row-key="id"
            :editing-id="editingContactId"
          >
            <template #cell-name="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-contact-name-${item.id}`" v-model="editContactForm.name" type="text" />
              <span v-else>{{ item.name }}</span>
            </template>
            <template #cell-relationship="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-contact-relationship-${item.id}`" v-model="editContactForm.relationship" type="text" />
              <span v-else>{{ item.relationship }}</span>
            </template>
            <template #cell-phone="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-contact-phone-${item.id}`" v-model="editContactForm.phone" type="text" />
              <span v-else>{{ item.phone }}</span>
            </template>
            <template #cell-priority="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-contact-priority-${item.id}`" v-model="editContactForm.priority" type="text" />
              <span v-else>{{ item.priority }}</span>
            </template>
            <template #cell-isPrimary="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-contact-isPrimary-${item.id}`" v-model="editContactForm.isPrimary" type="checkbox" />
              <span v-else>{{ item.isPrimary ? 'Yes' : 'No' }}</span>
            </template>
            <template #actions="{ item, editing }">
              <template v-if="editing">
                <Button :data-testid="`save-contact-${item.id}`" @click="onSaveContact(item.id)">Save</Button>
                <Button variant="secondary" @click="cancelEditContact">Cancel</Button>
              </template>
              <template v-else>
                <Button :data-testid="`edit-contact-${item.id}`" @click="startEditContact(item)">Edit</Button>
                <Button variant="secondary" :data-testid="`delete-contact-${item.id}`" @click="onDeleteContact(item.id)">Delete</Button>
              </template>
            </template>
          </EntityTable>

          <h3>Add contact</h3>
          <div class="inline-form">
            <FormField v-model="newContact.name" label="Name" type="text" data-testid="new-contact-name" placeholder="Name" grow />
            <FormField v-model="newContact.relationship" label="Relationship" type="text" data-testid="new-contact-relationship" placeholder="Relationship" grow />
            <FormField v-model="newContact.phone" label="Phone" type="text" data-testid="new-contact-phone" placeholder="Phone" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="newContact.alternatePhone" label="Alternate phone" type="text" data-testid="new-contact-alternatePhone" placeholder="Alternate phone" grow />
            <FormField v-model="newContact.email" label="Email" type="email" data-testid="new-contact-email" placeholder="Email" grow />
            <FormField v-model="newContact.priority" label="Priority" type="text" data-testid="new-contact-priority" placeholder="Priority" />
            <FormField v-model="newContact.isPrimary" label="Primary contact" type="checkbox" data-testid="new-contact-isPrimary" />
          </div>
          <Button data-testid="add-contact-submit" :disabled="isSavingContact" @click="onAddContact">Add Contact</Button>
        </section>
  ```

- [ ] **Step 6: Run the tests to verify they pass**

  Run: `npx vitest run StaffProfileView.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 7: Type-check**

  Run: `npm run type-check`
  Expected: passes.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add emergency contacts to the Staff profile"
  ```

---

### Task 3: Staff profile — Experience section

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Modify: `staff-console/src/views/StaffProfileView.vue`
- Modify: `staff-console/src/views/StaffProfileView.spec.ts`

**Interfaces:**
- Consumes: `StaffProfileDetail.experience` (Task 1).
- Produces: `api.createStaffExperience`/`updateStaffExperience`/`deleteStaffExperience` — no
  later task depends on these. This is the "extend fields for teacher like student, with past
  experience" requirement, applying to every `employeeType`, not just `TEACHER`.

- [ ] **Step 1: Add payload types to `api.ts`**

  Insert immediately after `UpdateStaffEmergencyContactPayload`:

  ```typescript
  export interface CreateStaffExperiencePayload {
    organization: string;
    role: string;
    fromDate?: string;
    toDate?: string;
    description?: string;
  }

  export interface UpdateStaffExperiencePayload {
    organization?: string;
    role?: string;
    fromDate?: string;
    toDate?: string;
    description?: string;
  }
  ```

- [ ] **Step 2: Add methods to `api.ts`**

  Insert immediately after `deleteStaffEmergencyContact`:

  ```typescript
    async createStaffExperience(
      accessToken: string,
      staffId: string,
      payload: CreateStaffExperiencePayload,
    ): Promise<StaffExperienceDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async updateStaffExperience(
      accessToken: string,
      staffId: string,
      experienceId: string,
      payload: UpdateStaffExperiencePayload,
    ): Promise<StaffExperienceDetail> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience/${experienceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify(payload),
        },
      );
      return asJson(res);
    },

    async deleteStaffExperience(accessToken: string, staffId: string, experienceId: string): Promise<void> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience/${experienceId}`,
        { method: 'DELETE', headers: authHeaders(accessToken) },
      );
      if (!res.ok) {
        throw new ApiError(await parseErrorMessage(res), res.status);
      }
    },
  ```

- [ ] **Step 3: Write the failing tests**

  Add to `StaffProfileView.spec.ts`: extend the `vi.mock('../lib/api', ...)` factory's `api`
  object with `createStaffExperience: vi.fn(), updateStaffExperience: vi.fn(),
  deleteStaffExperience: vi.fn(),`. Then add this `describe` block:

  ```typescript
    describe('experience', () => {
      it('adds an experience entry', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
        vi.mocked(api.createStaffExperience).mockResolvedValue({
          id: 'exp1', organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: null, toDate: null, description: null,
        });

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="new-experience-organization"]').setValue('City Grammar School');
        await wrapper.find('[data-testid="new-experience-role"]').setValue('Janitorial Staff');
        await wrapper.find('[data-testid="add-experience-submit"]').trigger('click');
        await flushPromises();

        expect(api.createStaffExperience).toHaveBeenCalledWith('token-1', 'st1', {
          organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: undefined, toDate: undefined, description: undefined,
        });
      });

      it('edits and deletes an experience entry', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
          experience: [
            { id: 'exp1', organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: '2020-01-01', toDate: '2022-12-31', description: null },
          ],
        }));
        vi.mocked(api.updateStaffExperience).mockResolvedValue({
          id: 'exp1', organization: 'City Grammar School', role: 'Senior Janitorial Staff', fromDate: '2020-01-01', toDate: '2022-12-31', description: null,
        });
        vi.mocked(api.deleteStaffExperience).mockResolvedValue(undefined);

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="edit-experience-exp1"]').trigger('click');
        await wrapper.find('[data-testid="edit-experience-role-exp1"]').setValue('Senior Janitorial Staff');
        await wrapper.find('[data-testid="save-experience-exp1"]').trigger('click');
        await flushPromises();
        expect(api.updateStaffExperience).toHaveBeenCalledWith('token-1', 'st1', 'exp1', {
          organization: 'City Grammar School', role: 'Senior Janitorial Staff',
          fromDate: '2020-01-01', toDate: '2022-12-31', description: undefined,
        });

        await wrapper.find('[data-testid="delete-experience-exp1"]').trigger('click');
        await flushPromises();
        expect(api.deleteStaffExperience).toHaveBeenCalledWith('token-1', 'st1', 'exp1');
      });
    });
  ```

- [ ] **Step 4: Run the tests to verify they fail**

  Run: `cd staff-console && npx vitest run StaffProfileView.spec.ts`
  Expected: FAIL — the "Add experience"/edit/delete controls don't exist yet.

- [ ] **Step 5: Add the Experience section to `StaffProfileView.vue`**

  Add this block after the Emergency Contacts script block (after `onDeleteContact`):

  ```typescript
  // --- Experience section -------------------------------------------------------------------
  const experienceErrorMessage = ref<string | null>(null);
  const isSavingExperience = ref(false);

  const newExperience = reactive({ organization: '', role: '', fromDate: '', toDate: '', description: '' });
  function resetNewExperience() {
    newExperience.organization = '';
    newExperience.role = '';
    newExperience.fromDate = '';
    newExperience.toDate = '';
    newExperience.description = '';
  }

  async function onAddExperience() {
    if (!auth.accessToken || !newExperience.organization.trim() || !newExperience.role.trim()) return;
    experienceErrorMessage.value = null;
    isSavingExperience.value = true;
    try {
      await api.createStaffExperience(auth.accessToken, staffId, {
        organization: newExperience.organization.trim(),
        role: newExperience.role.trim(),
        fromDate: newExperience.fromDate || undefined,
        toDate: newExperience.toDate || undefined,
        description: newExperience.description || undefined,
      });
      resetNewExperience();
      await load();
    } catch (err) {
      experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not add this experience entry.';
    } finally {
      isSavingExperience.value = false;
    }
  }

  const editingExperienceId = ref<string | null>(null);
  const editExperienceForm = reactive({ organization: '', role: '', fromDate: '', toDate: '', description: '' });

  function startEditExperience(entry: StaffProfileDetail['experience'][number]) {
    editingExperienceId.value = entry.id;
    editExperienceForm.organization = entry.organization;
    editExperienceForm.role = entry.role;
    editExperienceForm.fromDate = entry.fromDate ? entry.fromDate.slice(0, 10) : '';
    editExperienceForm.toDate = entry.toDate ? entry.toDate.slice(0, 10) : '';
    editExperienceForm.description = entry.description ?? '';
  }

  function cancelEditExperience() {
    editingExperienceId.value = null;
  }

  async function onSaveExperience(experienceId: string) {
    if (!auth.accessToken || !editExperienceForm.organization.trim() || !editExperienceForm.role.trim()) return;
    experienceErrorMessage.value = null;
    try {
      await api.updateStaffExperience(auth.accessToken, staffId, experienceId, {
        organization: editExperienceForm.organization.trim(),
        role: editExperienceForm.role.trim(),
        fromDate: editExperienceForm.fromDate || undefined,
        toDate: editExperienceForm.toDate || undefined,
        description: editExperienceForm.description || undefined,
      });
      editingExperienceId.value = null;
      await load();
    } catch (err) {
      experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not save this experience entry.';
    }
  }

  async function onDeleteExperience(experienceId: string) {
    if (!auth.accessToken) return;
    if (!(await confirm({ title: 'Delete this experience entry?', message: 'This cannot be undone.', danger: true }))) return;
    experienceErrorMessage.value = null;
    try {
      await api.deleteStaffExperience(auth.accessToken, staffId, experienceId);
      await load();
    } catch (err) {
      experienceErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this experience entry.';
    }
  }
  ```

  Add this `<section>` in the template, immediately after the closing `</section>` of the
  "Emergency Contacts" section:

  ```html
        <section class="profile-section">
          <h2>Experience</h2>
          <p v-if="experienceErrorMessage" class="error" role="alert">{{ experienceErrorMessage }}</p>

          <EntityTable
            :items="profile.experience"
            :columns="[
              { key: 'organization', label: 'Organization' },
              { key: 'role', label: 'Role' },
              { key: 'fromDate', label: 'From' },
              { key: 'toDate', label: 'To' },
            ]"
            row-key="id"
            :editing-id="editingExperienceId"
          >
            <template #cell-organization="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-experience-organization-${item.id}`" v-model="editExperienceForm.organization" type="text" />
              <span v-else>{{ item.organization }}</span>
            </template>
            <template #cell-role="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-experience-role-${item.id}`" v-model="editExperienceForm.role" type="text" />
              <span v-else>{{ item.role }}</span>
            </template>
            <template #cell-fromDate="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-experience-fromDate-${item.id}`" v-model="editExperienceForm.fromDate" type="date" />
              <span v-else>{{ item.fromDate ? item.fromDate.slice(0, 10) : '—' }}</span>
            </template>
            <template #cell-toDate="{ item, editing }">
              <input v-if="editing" :data-testid="`edit-experience-toDate-${item.id}`" v-model="editExperienceForm.toDate" type="date" />
              <span v-else>{{ item.toDate ? item.toDate.slice(0, 10) : '—' }}</span>
            </template>
            <template #actions="{ item, editing }">
              <template v-if="editing">
                <Button :data-testid="`save-experience-${item.id}`" @click="onSaveExperience(item.id)">Save</Button>
                <Button variant="secondary" @click="cancelEditExperience">Cancel</Button>
              </template>
              <template v-else>
                <Button :data-testid="`edit-experience-${item.id}`" @click="startEditExperience(item)">Edit</Button>
                <Button variant="secondary" :data-testid="`delete-experience-${item.id}`" @click="onDeleteExperience(item.id)">Delete</Button>
              </template>
            </template>
          </EntityTable>

          <h3>Add experience</h3>
          <div class="inline-form">
            <FormField v-model="newExperience.organization" label="Organization" type="text" data-testid="new-experience-organization" placeholder="Organization" grow />
            <FormField v-model="newExperience.role" label="Role" type="text" data-testid="new-experience-role" placeholder="Role" grow />
          </div>
          <div class="inline-form">
            <FormField v-model="newExperience.fromDate" label="From" type="date" data-testid="new-experience-fromDate" />
            <FormField v-model="newExperience.toDate" label="To" type="date" data-testid="new-experience-toDate" />
          </div>
          <FormField v-model="newExperience.description" label="Description" type="textarea" data-testid="new-experience-description" placeholder="Description" />
          <Button data-testid="add-experience-submit" :disabled="isSavingExperience" @click="onAddExperience">Add Experience</Button>
        </section>
  ```

- [ ] **Step 6: Run the tests to verify they pass**

  Run: `npx vitest run StaffProfileView.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 7: Type-check**

  Run: `npm run type-check`
  Expected: passes.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add work experience to the Staff profile"
  ```

---

### Task 4: Staff profile — Documents section

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Modify: `staff-console/src/views/StaffProfileView.vue`
- Modify: `staff-console/src/views/StaffProfileView.spec.ts`

**Interfaces:**
- Consumes: `StaffProfileDetail.documents` (Task 1), `api.uploadFile` (existing), `StatusPill`
  component, `DOCUMENT_TYPE_OPTIONS` (`../lib/staff-profile.constants`, re-exported from Task 1).
- Produces: `api.addStaffDocument`/`verifyStaffDocument`. This completes the Staff frontend.

- [ ] **Step 1: Add payload type to `api.ts`**

  Insert immediately after `UpdateStaffExperiencePayload`:

  ```typescript
  export interface AddStaffDocumentPayload {
    documentType: string;
    fileId: string;
    expiryDate?: string;
    notes?: string;
  }
  ```

- [ ] **Step 2: Add methods to `api.ts`**

  Insert immediately after `deleteStaffExperience`:

  ```typescript
    async addStaffDocument(
      accessToken: string,
      staffId: string,
      payload: AddStaffDocumentPayload,
    ): Promise<StaffDocumentDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async verifyStaffDocument(
      accessToken: string,
      staffId: string,
      documentId: string,
      verified: boolean,
    ): Promise<StaffDocumentDetail> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/staff/${staffId}/documents/${documentId}/verify`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify({ verified }),
        },
      );
      return asJson(res);
    },
  ```

- [ ] **Step 3: Write the failing tests**

  Add to `StaffProfileView.spec.ts`: extend the `vi.mock('../lib/api', ...)` factory's `api`
  object with `addStaffDocument: vi.fn(), verifyStaffDocument: vi.fn(),`. Then add this `describe`
  block:

  ```typescript
    describe('documents', () => {
      it('uploads a file and adds a document', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile());
        vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f3' });
        vi.mocked(api.addStaffDocument).mockResolvedValue({
          id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
          expiryDate: null, verificationStatus: 'PENDING', verifiedById: null, verifiedAt: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z',
        });

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="new-document-type"]').setValue('CNIC');
        const fileInput = wrapper.find('[data-testid="new-document-file"]');
        const file = new File(['data'], 'cnic.pdf', { type: 'application/pdf' });
        Object.defineProperty(fileInput.element, 'files', { value: [file] });
        await fileInput.trigger('change');
        await wrapper.find('[data-testid="add-document-submit"]').trigger('click');
        await flushPromises();

        expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
        expect(api.addStaffDocument).toHaveBeenCalledWith('token-1', 'st1', {
          documentType: 'CNIC', fileId: 'f3', expiryDate: undefined, notes: undefined,
        });
      });

      it('verifies and rejects a pending document', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({
          documents: [
            { id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }, expiryDate: null, verificationStatus: 'PENDING', verifiedById: null, verifiedAt: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z' },
          ],
        }));
        vi.mocked(api.verifyStaffDocument).mockResolvedValue({
          id: 'doc1', documentType: 'CNIC', file: { id: 'f3', originalName: 'cnic.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }, expiryDate: null, verificationStatus: 'VERIFIED', verifiedById: 'admin-1', verifiedAt: '2026-01-02T00:00:00.000Z', notes: null, createdAt: '2026-01-01T00:00:00.000Z',
        });

        const wrapper = await mountView();
        await flushPromises();

        await wrapper.find('[data-testid="verify-document-doc1"]').trigger('click');
        await flushPromises();

        expect(api.verifyStaffDocument).toHaveBeenCalledWith('token-1', 'st1', 'doc1', true);
      });

      it('shows "No documents on file" when there are none', async () => {
        vi.mocked(api.getStaffProfile).mockResolvedValue(baseProfile({ documents: [] }));

        const wrapper = await mountView();
        await flushPromises();

        expect(wrapper.text()).toContain('No documents on file.');
      });
    });
  ```

- [ ] **Step 4: Run the tests to verify they fail**

  Run: `cd staff-console && npx vitest run StaffProfileView.spec.ts`
  Expected: FAIL — the Documents controls don't exist yet.

- [ ] **Step 5: Add the Documents section to `StaffProfileView.vue`**

  Add this import:

  ```typescript
  import StatusPill from '../components/StatusPill.vue';
  import { DOCUMENT_TYPE_OPTIONS } from '../lib/staff-profile.constants';
  ```

  (Merge `DOCUMENT_TYPE_OPTIONS` into the existing `import { GENDER_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS } from '../lib/staff-profile.constants';` line rather than adding a
  second one.)

  Add this block after the Experience script block (after `onDeleteExperience`):

  ```typescript
  // --- Documents section ---------------------------------------------------------------------
  const documentsErrorMessage = ref<string | null>(null);
  const isSavingDocument = ref(false);
  const newDocument = reactive({ documentType: '', expiryDate: '', notes: '' });
  const newDocumentFile = ref<File | null>(null);

  function onNewDocumentFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    newDocumentFile.value = input.files?.[0] ?? null;
  }

  function resetNewDocument() {
    newDocument.documentType = '';
    newDocument.expiryDate = '';
    newDocument.notes = '';
    newDocumentFile.value = null;
  }

  async function onAddDocument() {
    if (!auth.accessToken || !newDocument.documentType || !newDocumentFile.value) return;
    documentsErrorMessage.value = null;
    isSavingDocument.value = true;
    try {
      const uploaded = await api.uploadFile(auth.accessToken, newDocumentFile.value);
      await api.addStaffDocument(auth.accessToken, staffId, {
        documentType: newDocument.documentType,
        fileId: uploaded.id,
        expiryDate: newDocument.expiryDate || undefined,
        notes: newDocument.notes || undefined,
      });
      resetNewDocument();
      await load();
    } catch (err) {
      documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not add this document.';
    } finally {
      isSavingDocument.value = false;
    }
  }

  function documentTone(status: string): 'success' | 'warning' | 'critical' {
    if (status === 'VERIFIED') return 'success';
    if (status === 'REJECTED') return 'critical';
    return 'warning';
  }

  async function onVerifyDocument(documentId: string, verified: boolean) {
    if (!auth.accessToken) return;
    documentsErrorMessage.value = null;
    try {
      await api.verifyStaffDocument(auth.accessToken, staffId, documentId, verified);
      await load();
    } catch (err) {
      documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not update this document.';
    }
  }
  ```

  Add this `<section>` in the template, immediately after the closing `</section>` of the
  "Experience" section:

  ```html
        <section class="profile-section">
          <h2>Documents</h2>
          <p v-if="documentsErrorMessage" class="error" role="alert">{{ documentsErrorMessage }}</p>

          <p v-if="!profile.documents.length">No documents on file.</p>
          <EntityTable
            v-else
            :items="profile.documents"
            :columns="[
              { key: 'documentType', label: 'Type' },
              { key: 'file', label: 'File' },
              { key: 'verificationStatus', label: 'Status' },
              { key: 'expiryDate', label: 'Expiry' },
            ]"
            row-key="id"
            :editing-id="null"
          >
            <template #cell-file="{ item }">{{ item.file.originalName }}</template>
            <template #cell-verificationStatus="{ item }">
              <StatusPill :tone="documentTone(item.verificationStatus)" :label="item.verificationStatus" />
            </template>
            <template #cell-expiryDate="{ item }">{{ item.expiryDate ? item.expiryDate.slice(0, 10) : '—' }}</template>
            <template #actions="{ item }">
              <template v-if="item.verificationStatus === 'PENDING'">
                <Button :data-testid="`verify-document-${item.id}`" @click="onVerifyDocument(item.id, true)">Verify</Button>
                <Button variant="secondary" :data-testid="`reject-document-${item.id}`" @click="onVerifyDocument(item.id, false)">Reject</Button>
              </template>
            </template>
          </EntityTable>

          <h3>Add document</h3>
          <div class="inline-form">
            <FormField v-model="newDocument.documentType" label="Document type" type="select" data-testid="new-document-type" placeholder="Document type" :options="DOCUMENT_TYPE_OPTIONS" />
            <FormField v-model="newDocument.expiryDate" label="Expiry date" type="date" data-testid="new-document-expiryDate" />
          </div>
          <div class="form-field">
            <label class="sr-only" for="new-document-file-input">File</label>
            <input id="new-document-file-input" type="file" data-testid="new-document-file" @change="onNewDocumentFileChange" />
          </div>
          <FormField v-model="newDocument.notes" label="Notes" type="textarea" data-testid="new-document-notes" placeholder="Notes" />
          <Button data-testid="add-document-submit" :disabled="isSavingDocument" @click="onAddDocument">Add Document</Button>
        </section>
  ```

- [ ] **Step 6: Run the tests to verify they pass**

  Run: `npx vitest run StaffProfileView.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 7: Type-check and run the full frontend test suite**

  Run: `cd staff-console && npm run type-check && npm run test`
  Expected: both pass. This completes the Staff side of the plan.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add documents to the Staff profile"
  ```

---

### Task 5: Hiring API client

**Files:**
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Consumes: `CampusSummary` (existing, from `api.listCampuses`).
- Produces: `HiringCandidateSummary`, `HiringApplicationSummary` types and
  `api.createHiringCandidate`/`findHiringCandidatesByPhone`/`createHiringApplication`/
  `listHiringApplications`/`getHiringApplication`/`updateHiringApplicationStatus`/
  `rejectHiringApplication`/`approveHiringApplication` — Tasks 6-8 consume these directly. As
  noted in Global Constraints, `api.ts` has no dedicated spec file in this codebase; this task is
  verified by type-checking, and indirectly by Tasks 6-8's component specs which mock these exact
  method names.

- [ ] **Step 1: Add Hiring types to `api.ts`**

  Insert immediately after `export interface ApplicationSummary { ... }`:

  ```typescript
  export interface HiringCandidateSummary {
    id: string;
    name: string;
    dateOfBirth: string | null;
    cnic: string | null;
    contactPhone: string;
    contactEmail: string | null;
    resumeFileId: string | null;
  }

  export interface HiringApplicationSummary {
    id: string;
    candidateId: string;
    candidateName: string;
    employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
    campusId: string;
    status: string;
    decisionNotes: string | null;
    reviewedById: string | null;
    createdStaffId: string | null;
  }
  ```

- [ ] **Step 2: Add Hiring methods to `api.ts`**

  Insert immediately after `approveApplication`, before `previewBulkImport`:

  ```typescript
    async createHiringCandidate(
      accessToken: string,
      payload: { name: string; dateOfBirth?: string; cnic?: string; contactPhone: string; contactEmail?: string; resumeFileId?: string },
    ): Promise<{ candidate: HiringCandidateSummary; possibleDuplicate: HiringCandidateSummary | null }> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async findHiringCandidatesByPhone(accessToken: string, contactPhone: string): Promise<HiringCandidateSummary[]> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/hiring/candidates?contactPhone=${encodeURIComponent(contactPhone)}`,
        { headers: authHeaders(accessToken) },
      );
      return asJson(res);
    },

    async createHiringApplication(
      accessToken: string,
      payload: { candidateId: string; employeeType: string; campusId: string },
    ): Promise<HiringApplicationSummary> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async listHiringApplications(
      accessToken: string,
      params?: { campusId?: string; status?: string },
    ): Promise<HiringApplicationSummary[]> {
      const query = new URLSearchParams();
      if (params?.campusId) query.set('campusId', params.campusId);
      if (params?.status) query.set('status', params.status);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications${suffix}`, {
        headers: authHeaders(accessToken),
      });
      return asJson(res);
    },

    async getHiringApplication(accessToken: string, id: string): Promise<HiringApplicationSummary> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}`, {
        headers: authHeaders(accessToken),
      });
      return asJson(res);
    },

    async updateHiringApplicationStatus(
      accessToken: string,
      id: string,
      payload: { status?: 'SHORTLISTED' | 'INTERVIEWED'; decisionNotes?: string },
    ): Promise<HiringApplicationSummary> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async rejectHiringApplication(accessToken: string, id: string, decisionNotes: string): Promise<HiringApplicationSummary> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({ decisionNotes }),
      });
      return asJson(res);
    },

    async approveHiringApplication(
      accessToken: string,
      id: string,
      payload: {
        dateOfBirth?: string; cnic?: string; mobile?: string; email?: string; joiningDate?: string;
        login?: { identifier: string; password: string };
      },
    ): Promise<HiringApplicationSummary> {
      const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },
  ```

- [ ] **Step 3: Type-check**

  Run: `cd staff-console && npm run type-check`
  Expected: passes. (No unit test for this task — see Global Constraints.)

- [ ] **Step 4: Commit**

  ```bash
  git add staff-console/src/lib/api.ts
  git commit -m "feat(staff-console): add Hiring candidates/applications API client methods"
  ```

---

### Task 6: Hiring candidate intake page

**Files:**
- Create: `staff-console/src/views/HiringCandidateIntakeView.vue`
- Create: `staff-console/src/views/HiringCandidateIntakePageView.vue`
- Create: `staff-console/src/views/HiringCandidateIntakeView.spec.ts`
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `api.listCampuses` (existing), `api.uploadFile` (existing),
  `api.createHiringCandidate`/`createHiringApplication` (Task 5), `EMPLOYEE_TYPE_OPTIONS`
  (Task 1).
- Produces: the `/admin/hiring/new` route. No later task depends on this view's internals.

- [ ] **Step 1: Write the failing test**

  ```typescript
  // staff-console/src/views/HiringCandidateIntakeView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import HiringCandidateIntakeView from './HiringCandidateIntakeView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api } from '../lib/api';

  vi.mock('../lib/api', () => ({
    api: {
      listCampuses: vi.fn(),
      createHiringCandidate: vi.fn(),
      createHiringApplication: vi.fn(),
      uploadFile: vi.fn(),
    },
  }));

  describe('HiringCandidateIntakeView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
      vi.mocked(api.listCampuses).mockResolvedValue([
        { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'SchoolOS School' },
      ]);
    });

    it('creates a candidate, then an application once the candidate exists', async () => {
      vi.mocked(api.createHiringCandidate).mockResolvedValue({
        candidate: { id: 'cand1', name: 'Bilal Hussain', dateOfBirth: null, cnic: null, contactPhone: '0333-4445566', contactEmail: null, resumeFileId: null },
        possibleDuplicate: null,
      });
      vi.mocked(api.createHiringApplication).mockResolvedValue({
        id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD',
        campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null,
      });

      const wrapper = mount(HiringCandidateIntakeView);
      await flushPromises();

      await wrapper.find('[data-testid="candidate-name"]').setValue('Bilal Hussain');
      await wrapper.find('[data-testid="candidate-phone"]').setValue('0333-4445566');
      await wrapper.find('[data-testid="candidate-submit"]').trigger('click');
      await flushPromises();

      expect(api.createHiringCandidate).toHaveBeenCalledWith('token-1', {
        name: 'Bilal Hussain', dateOfBirth: undefined, cnic: undefined,
        contactPhone: '0333-4445566', contactEmail: undefined, resumeFileId: undefined,
      });
      expect(wrapper.find('[data-testid="application-employee-type"]').exists()).toBe(true);

      await wrapper.find('[data-testid="application-employee-type"]').setValue('GUARD');
      await wrapper.find('[data-testid="application-campus"]').setValue('cam1');
      await wrapper.find('[data-testid="application-submit"]').trigger('click');
      await flushPromises();

      expect(api.createHiringApplication).toHaveBeenCalledWith('token-1', {
        candidateId: 'cand1', employeeType: 'GUARD', campusId: 'cam1',
      });
      expect(wrapper.text()).toContain('Application created.');
    });

    it('shows a duplicate-candidate banner without blocking submission', async () => {
      vi.mocked(api.createHiringCandidate).mockResolvedValue({
        candidate: { id: 'cand2', name: 'Sana Malik', dateOfBirth: null, cnic: null, contactPhone: '0333-7778899', contactEmail: null, resumeFileId: null },
        possibleDuplicate: { id: 'cand1', name: 'Sana Malik', dateOfBirth: null, cnic: null, contactPhone: '0333-7778899', contactEmail: null, resumeFileId: null },
      });

      const wrapper = mount(HiringCandidateIntakeView);
      await flushPromises();

      await wrapper.find('[data-testid="candidate-name"]').setValue('Sana Malik');
      await wrapper.find('[data-testid="candidate-phone"]').setValue('0333-7778899');
      await wrapper.find('[data-testid="candidate-submit"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="duplicate-banner"]').text()).toContain('Sana Malik');
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `cd staff-console && npx vitest run HiringCandidateIntakeView.spec.ts`
  Expected: FAIL — `Cannot find module './HiringCandidateIntakeView.vue'`.

- [ ] **Step 3: Write `HiringCandidateIntakeView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringCandidateIntakeView.vue -->
  <script setup lang="ts">
  import { ref } from 'vue';
  import { useAuthStore } from '../stores/auth';
  import { api, type CampusSummary, type HiringCandidateSummary } from '../lib/api';
  import { EMPLOYEE_TYPE_OPTIONS } from '../lib/staff-profile.constants';
  import FormField from '../components/FormField.vue';
  import Button from '../components/Button.vue';

  const auth = useAuthStore();

  const campuses = ref<CampusSummary[]>([]);
  const errorMessage = ref<string | null>(null);
  const applicationErrorMessage = ref<string | null>(null);

  const candidateName = ref('');
  const candidateDob = ref('');
  const candidateCnic = ref('');
  const candidatePhone = ref('');
  const candidateEmail = ref('');
  const candidateResumeFile = ref<File | null>(null);
  const isSavingCandidate = ref(false);

  const candidateId = ref<string | null>(null);
  const possibleDuplicate = ref<HiringCandidateSummary | null>(null);
  const showDuplicateBanner = ref(false);

  const applicationEmployeeType = ref('');
  const applicationCampusId = ref('');
  const isSavingApplication = ref(false);
  const applicationCreated = ref(false);

  async function loadOptions() {
    if (!auth.accessToken) return;
    try {
      campuses.value = await api.listCampuses(auth.accessToken);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
    }
  }
  loadOptions();

  function onResumeFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    candidateResumeFile.value = input.files?.[0] ?? null;
  }

  async function onCreateCandidate() {
    if (!auth.accessToken || !candidateName.value.trim() || !candidatePhone.value.trim()) return;
    errorMessage.value = null;
    isSavingCandidate.value = true;
    try {
      let resumeFileId: string | undefined;
      if (candidateResumeFile.value) {
        const uploaded = await api.uploadFile(auth.accessToken, candidateResumeFile.value);
        resumeFileId = uploaded.id;
      }
      const res = await api.createHiringCandidate(auth.accessToken, {
        name: candidateName.value.trim(),
        dateOfBirth: candidateDob.value || undefined,
        cnic: candidateCnic.value || undefined,
        contactPhone: candidatePhone.value.trim(),
        contactEmail: candidateEmail.value || undefined,
        resumeFileId,
      });
      candidateId.value = res.candidate.id;
      possibleDuplicate.value = res.possibleDuplicate;
      showDuplicateBanner.value = res.possibleDuplicate !== null;
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not create this candidate.';
    } finally {
      isSavingCandidate.value = false;
    }
  }

  function dismissDuplicateBanner() {
    showDuplicateBanner.value = false;
  }

  async function onCreateApplication() {
    if (!auth.accessToken || !candidateId.value || !applicationEmployeeType.value || !applicationCampusId.value) return;
    applicationErrorMessage.value = null;
    isSavingApplication.value = true;
    try {
      await api.createHiringApplication(auth.accessToken, {
        candidateId: candidateId.value,
        employeeType: applicationEmployeeType.value,
        campusId: applicationCampusId.value,
      });
      applicationCreated.value = true;
    } catch (err) {
      applicationErrorMessage.value = err instanceof Error ? err.message : 'Could not create this application.';
    } finally {
      isSavingApplication.value = false;
    }
  }
  </script>

  <template>
    <div class="candidate-intake">
      <h1>New Hiring Candidate</h1>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <section class="form-section">
        <h2>Candidate details</h2>
        <div class="inline-form">
          <FormField v-model="candidateName" label="Name" type="text" data-testid="candidate-name" placeholder="Candidate's full name" grow />
          <FormField v-model="candidateDob" label="Date of birth" type="date" data-testid="candidate-dob" />
          <FormField v-model="candidateCnic" label="CNIC" type="text" data-testid="candidate-cnic" placeholder="CNIC" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="candidatePhone" label="Contact phone" type="text" data-testid="candidate-phone" placeholder="Contact phone" grow />
          <FormField v-model="candidateEmail" label="Contact email" type="email" data-testid="candidate-email" placeholder="Contact email" grow />
        </div>
        <div class="form-field">
          <label class="sr-only" for="candidate-resume-input">Résumé</label>
          <input id="candidate-resume-input" type="file" data-testid="candidate-resume" @change="onResumeFileChange" />
        </div>
        <Button data-testid="candidate-submit" :disabled="isSavingCandidate" @click="onCreateCandidate">
          Create Candidate
        </Button>

        <div v-if="showDuplicateBanner && possibleDuplicate" class="duplicate-banner" data-testid="duplicate-banner" role="alert">
          A similar candidate already exists — {{ possibleDuplicate.name }}
          <button type="button" class="dismiss-banner" @click="dismissDuplicateBanner">Dismiss</button>
        </div>
      </section>

      <section v-if="candidateId" class="form-section">
        <h2>Application</h2>
        <p v-if="applicationErrorMessage" class="error" role="alert">{{ applicationErrorMessage }}</p>
        <p v-if="applicationCreated" class="success">Application created.</p>
        <div class="inline-form">
          <FormField
            v-model="applicationEmployeeType"
            label="Employee type"
            type="select"
            data-testid="application-employee-type"
            placeholder="Choose an employee type"
            :options="EMPLOYEE_TYPE_OPTIONS"
          />
          <FormField
            v-model="applicationCampusId"
            label="Campus"
            type="select"
            data-testid="application-campus"
            placeholder="Choose a campus"
            :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
          />
          <Button data-testid="application-submit" :disabled="isSavingApplication" @click="onCreateApplication">
            Create Application
          </Button>
        </div>
      </section>
    </div>
  </template>

  <style scoped>
  .candidate-intake {
    max-width: 900px;
  }
  .form-section {
    margin-bottom: var(--space-4);
  }
  .error {
    color: var(--color-destructive);
    margin-bottom: var(--space-3);
  }
  .success {
    color: var(--color-accent);
    margin-bottom: var(--space-3);
  }
  .inline-form {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .duplicate-banner {
    margin-top: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-muted-bg);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .dismiss-banner {
    border: none;
    background: none;
    color: var(--color-accent);
    cursor: pointer;
    font: inherit;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  </style>
  ```

- [ ] **Step 4: Write `HiringCandidateIntakePageView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringCandidateIntakePageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import HiringCandidateIntakeView from './HiringCandidateIntakeView.vue';
  </script>

  <template>
    <AppShell>
      <HiringCandidateIntakeView />
    </AppShell>
  </template>
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx vitest run HiringCandidateIntakeView.spec.ts`
  Expected: PASS, 2 tests.

- [ ] **Step 6: Add the route**

  In `staff-console/src/router/index.ts`, insert immediately after the `/admin/staff/:id` route
  block (added in Task 1):

  ```typescript
    {
      path: '/admin/hiring/new',
      name: 'admin-hiring-new',
      component: () => import('../views/HiringCandidateIntakePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'New Candidate' },
    },
  ```

- [ ] **Step 7: Type-check**

  Run: `cd staff-console && npm run type-check`
  Expected: passes.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add Hiring candidate intake page"
  ```

---

### Task 7: Hiring queue page

**Files:**
- Create: `staff-console/src/views/HiringQueueView.vue`
- Create: `staff-console/src/views/HiringQueuePageView.vue`
- Create: `staff-console/src/views/HiringQueueView.spec.ts`
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `api.listCampuses` (existing), `api.listHiringApplications` (Task 5).
- Produces: the `/admin/hiring` route. No later task depends on this view's internals.

- [ ] **Step 1: Write the failing test**

  ```typescript
  // staff-console/src/views/HiringQueueView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import HiringQueueView from './HiringQueueView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api } from '../lib/api';

  async function mountView() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/hiring', name: 'admin-hiring', component: HiringQueueView },
        { path: '/admin/hiring/:id', name: 'admin-hiring-detail', component: { template: '<div>detail</div>' } },
      ],
    });
    await router.push('/admin/hiring');
    await router.isReady();
    return mount(HiringQueueView, { global: { plugins: [router] } });
  }

  vi.mock('../lib/api', () => ({
    api: { listCampuses: vi.fn(), listHiringApplications: vi.fn() },
  }));

  describe('HiringQueueView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
      vi.mocked(api.listCampuses).mockResolvedValue([
        { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'SchoolOS School' },
      ]);
      vi.mocked(api.listHiringApplications).mockResolvedValue([
        { id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD', campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null },
      ]);
    });

    it('lists hiring applications with candidate name and status', async () => {
      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Bilal Hussain');
      expect(wrapper.text()).toContain('SUBMITTED');
    });

    it("links each row to that application's detail page", async () => {
      const wrapper = await mountView();
      await flushPromises();

      const link = wrapper.find('[data-testid="view-application-app1"]');
      expect(link.exists()).toBe(true);
      expect(link.attributes('href')).toBe('/admin/hiring/app1');
    });

    it('reloads filtered by campus and status when either filter changes', async () => {
      const wrapper = await mountView();
      await flushPromises();
      vi.mocked(api.listHiringApplications).mockResolvedValue([]);

      await wrapper.find('[data-testid="filter-status"]').setValue('SHORTLISTED');
      await flushPromises();

      expect(api.listHiringApplications).toHaveBeenCalledWith('token-1', {
        campusId: undefined, status: 'SHORTLISTED',
      });
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `cd staff-console && npx vitest run HiringQueueView.spec.ts`
  Expected: FAIL — `Cannot find module './HiringQueueView.vue'`.

- [ ] **Step 3: Write `HiringQueueView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringQueueView.vue -->
  <script setup lang="ts">
  import { ref } from 'vue';
  import { RouterLink } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { api, type CampusSummary, type HiringApplicationSummary } from '../lib/api';
  import EntityTable from '../components/EntityTable.vue';
  import FormField from '../components/FormField.vue';

  const STATUS_OPTIONS = [
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'SHORTLISTED', label: 'Shortlisted' },
    { value: 'INTERVIEWED', label: 'Interviewed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  const auth = useAuthStore();

  const campuses = ref<CampusSummary[]>([]);
  const applications = ref<HiringApplicationSummary[]>([]);
  const errorMessage = ref<string | null>(null);

  const selectedCampusId = ref('');
  const selectedStatus = ref('');

  async function loadCampuses() {
    if (!auth.accessToken) return;
    try {
      campuses.value = await api.listCampuses(auth.accessToken);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
    }
  }

  async function loadApplications() {
    if (!auth.accessToken) return;
    errorMessage.value = null;
    try {
      applications.value = await api.listHiringApplications(auth.accessToken, {
        campusId: selectedCampusId.value || undefined,
        status: selectedStatus.value || undefined,
      });
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not load hiring applications.';
    }
  }

  async function init() {
    await loadCampuses();
    await loadApplications();
  }
  init();
  </script>

  <template>
    <div class="hiring-queue">
      <h1>Hiring</h1>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <div class="filter-row">
        <FormField
          v-model="selectedCampusId"
          label="Campus"
          type="select"
          data-testid="filter-campus"
          placeholder="All campuses"
          :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
          @update:model-value="loadApplications"
        />
        <FormField
          v-model="selectedStatus"
          label="Status"
          type="select"
          data-testid="filter-status"
          placeholder="All statuses"
          :options="STATUS_OPTIONS"
          @update:model-value="loadApplications"
        />
      </div>

      <EntityTable
        :items="applications"
        :columns="[
          { key: 'candidateName', label: 'Candidate' },
          { key: 'employeeType', label: 'Employee Type' },
          { key: 'status', label: 'Status' },
        ]"
        row-key="id"
        :editing-id="null"
      >
        <template #actions="{ item }">
          <RouterLink :data-testid="`view-application-${item.id}`" :to="`/admin/hiring/${item.id}`">
            View
          </RouterLink>
        </template>
      </EntityTable>
    </div>
  </template>

  <style scoped>
  .hiring-queue {
    max-width: 900px;
  }
  .error {
    color: var(--color-destructive);
    margin-bottom: var(--space-3);
  }
  .filter-row {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  </style>
  ```

- [ ] **Step 4: Write `HiringQueuePageView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringQueuePageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import HiringQueueView from './HiringQueueView.vue';
  </script>

  <template>
    <AppShell>
      <HiringQueueView />
    </AppShell>
  </template>
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx vitest run HiringQueueView.spec.ts`
  Expected: PASS, 3 tests.

- [ ] **Step 6: Add the route**

  In `staff-console/src/router/index.ts`, insert immediately after the `/admin/hiring/new` route
  block (added in Task 6):

  ```typescript
    {
      path: '/admin/hiring',
      name: 'admin-hiring',
      component: () => import('../views/HiringQueuePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring' },
    },
  ```

- [ ] **Step 7: Type-check**

  Run: `cd staff-console && npm run type-check`
  Expected: passes.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add Hiring queue page"
  ```

---

### Task 8: Hiring application detail/review page

**Files:**
- Create: `staff-console/src/views/HiringApplicationDetailView.vue`
- Create: `staff-console/src/views/HiringApplicationDetailPageView.vue`
- Create: `staff-console/src/views/HiringApplicationDetailView.spec.ts`
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `api.listCampuses` (existing), `api.getHiringApplication`/
  `updateHiringApplicationStatus`/`rejectHiringApplication`/`approveHiringApplication` (Task 5).
- Produces: the `/admin/hiring/:id` route. This is where `HiringApplicationsService.approve()`'s
  transaction (creating the `Staff` row, and a `Teacher` row for `TEACHER` hires) is triggered
  from the UI.

- [ ] **Step 1: Write the failing test**

  ```typescript
  // staff-console/src/views/HiringApplicationDetailView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import HiringApplicationDetailView from './HiringApplicationDetailView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api, type HiringApplicationSummary } from '../lib/api';

  async function mountView(id = 'app1') {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/admin/hiring/:id', name: 'admin-hiring-detail', component: HiringApplicationDetailView }],
    });
    await router.push(`/admin/hiring/${id}`);
    await router.isReady();
    return mount(HiringApplicationDetailView, { global: { plugins: [router] } });
  }

  function baseApplication(overrides: Partial<HiringApplicationSummary> = {}): HiringApplicationSummary {
    return {
      id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD',
      campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null,
      ...overrides,
    };
  }

  vi.mock('../lib/api', () => ({
    api: {
      getHiringApplication: vi.fn(),
      listCampuses: vi.fn(),
      updateHiringApplicationStatus: vi.fn(),
      rejectHiringApplication: vi.fn(),
      approveHiringApplication: vi.fn(),
    },
  }));

  describe('HiringApplicationDetailView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
      vi.mocked(api.listCampuses).mockResolvedValue([
        { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'SchoolOS School' },
      ]);
    });

    it('shows the application read-only, with campus name resolved', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Bilal Hussain');
      expect(wrapper.text()).toContain('PECHS Campus');
      expect(wrapper.text()).toContain('SUBMITTED');
    });

    it('marks the application shortlisted', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
      vi.mocked(api.updateHiringApplicationStatus).mockResolvedValue(baseApplication({ status: 'SHORTLISTED' }));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="mark-shortlisted"]').trigger('click');
      await flushPromises();

      expect(api.updateHiringApplicationStatus).toHaveBeenCalledWith('token-1', 'app1', { status: 'SHORTLISTED' });
      expect(wrapper.text()).toContain('SHORTLISTED');
    });

    it('rejects the application with decision notes', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
      vi.mocked(api.rejectHiringApplication).mockResolvedValue(baseApplication({ status: 'REJECTED', decisionNotes: 'Not a fit' }));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="reject-decision-notes"]').setValue('Not a fit');
      await wrapper.find('[data-testid="reject-submit"]').trigger('click');
      await flushPromises();

      expect(api.rejectHiringApplication).toHaveBeenCalledWith('token-1', 'app1', 'Not a fit');
      expect(wrapper.find('[data-testid="approve-submit"]').exists()).toBe(false);
    });

    it('approves a non-teacher hire without requiring a login', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
      vi.mocked(api.approveHiringApplication).mockResolvedValue(baseApplication({ status: 'APPROVED', createdStaffId: 'st1' }));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="approve-mobile"]').setValue('0300-1112233');
      await wrapper.find('[data-testid="approve-submit"]').trigger('click');
      await flushPromises();

      expect(api.approveHiringApplication).toHaveBeenCalledWith('token-1', 'app1', {
        dateOfBirth: undefined, cnic: undefined, mobile: '0300-1112233', email: undefined, joiningDate: undefined, login: undefined,
      });
    });

    it('requires a login identifier/password to approve a TEACHER hire', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication({ employeeType: 'TEACHER' }));

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="approve-login-identifier"]').exists()).toBe(true);

      await wrapper.find('[data-testid="approve-submit"]').trigger('click');
      await flushPromises();

      expect(api.approveHiringApplication).not.toHaveBeenCalled();

      await wrapper.find('[data-testid="approve-login-identifier"]').setValue('new.teacher@schoolos.edu.pk');
      await wrapper.find('[data-testid="approve-login-password"]').setValue('InitialPass1!');
      await wrapper.find('[data-testid="approve-submit"]').trigger('click');
      await flushPromises();

      expect(api.approveHiringApplication).toHaveBeenCalledWith('token-1', 'app1', {
        dateOfBirth: undefined, cnic: undefined, mobile: undefined, email: undefined, joiningDate: undefined,
        login: { identifier: 'new.teacher@schoolos.edu.pk', password: 'InitialPass1!' },
      });
    });

    it('hides decision actions once the application is already terminal', async () => {
      vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication({ status: 'APPROVED' }));

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="mark-shortlisted"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="reject-submit"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="approve-submit"]').exists()).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `cd staff-console && npx vitest run HiringApplicationDetailView.spec.ts`
  Expected: FAIL — `Cannot find module './HiringApplicationDetailView.vue'`.

- [ ] **Step 3: Write `HiringApplicationDetailView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringApplicationDetailView.vue -->
  <script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRoute } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { api, type CampusSummary, type HiringApplicationSummary } from '../lib/api';
  import FormField from '../components/FormField.vue';
  import Button from '../components/Button.vue';

  const auth = useAuthStore();
  const route = useRoute();
  const applicationId = route.params.id as string;

  const application = ref<HiringApplicationSummary | null>(null);
  const campuses = ref<CampusSummary[]>([]);
  const errorMessage = ref<string | null>(null);

  const campusName = computed(() => {
    if (!application.value) return '—';
    return campuses.value.find((c) => c.id === application.value!.campusId)?.name ?? application.value.campusId;
  });

  const isMarkingStatus = ref(false);

  const rejectDecisionNotes = ref('');
  const isRejecting = ref(false);
  const rejectErrorMessage = ref<string | null>(null);

  const approveDateOfBirth = ref('');
  const approveCnic = ref('');
  const approveMobile = ref('');
  const approveEmail = ref('');
  const approveJoiningDate = ref('');
  const approveLoginIdentifier = ref('');
  const approveLoginPassword = ref('');
  const isApproving = ref(false);
  const approveErrorMessage = ref<string | null>(null);

  async function load() {
    if (!auth.accessToken) return;
    try {
      [application.value, campuses.value] = await Promise.all([
        api.getHiringApplication(auth.accessToken, applicationId),
        api.listCampuses(auth.accessToken),
      ]);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not load this hiring application.';
    }
  }
  load();

  async function onMarkStatus(status: 'SHORTLISTED' | 'INTERVIEWED') {
    if (!auth.accessToken) return;
    errorMessage.value = null;
    isMarkingStatus.value = true;
    try {
      application.value = await api.updateHiringApplicationStatus(auth.accessToken, applicationId, { status });
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Could not update this application.';
    } finally {
      isMarkingStatus.value = false;
    }
  }

  async function onReject() {
    if (!auth.accessToken || !rejectDecisionNotes.value.trim()) return;
    rejectErrorMessage.value = null;
    isRejecting.value = true;
    try {
      application.value = await api.rejectHiringApplication(auth.accessToken, applicationId, rejectDecisionNotes.value.trim());
    } catch (err) {
      rejectErrorMessage.value = err instanceof Error ? err.message : 'Could not reject this application.';
    } finally {
      isRejecting.value = false;
    }
  }

  async function onApprove() {
    if (!auth.accessToken || !application.value) return;
    const requiresLogin = application.value.employeeType === 'TEACHER';
    if (requiresLogin && (!approveLoginIdentifier.value.trim() || !approveLoginPassword.value)) return;
    approveErrorMessage.value = null;
    isApproving.value = true;
    try {
      application.value = await api.approveHiringApplication(auth.accessToken, applicationId, {
        dateOfBirth: approveDateOfBirth.value || undefined,
        cnic: approveCnic.value || undefined,
        mobile: approveMobile.value || undefined,
        email: approveEmail.value || undefined,
        joiningDate: approveJoiningDate.value || undefined,
        login: requiresLogin
          ? { identifier: approveLoginIdentifier.value.trim(), password: approveLoginPassword.value }
          : undefined,
      });
    } catch (err) {
      approveErrorMessage.value = err instanceof Error ? err.message : 'Could not approve this application.';
    } finally {
      isApproving.value = false;
    }
  }
  </script>

  <template>
    <div class="application-detail">
      <h1>Hiring Application</h1>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <div v-if="application" class="application-info">
        <p><strong>Candidate:</strong> {{ application.candidateName }}</p>
        <p><strong>Employee type:</strong> {{ application.employeeType }}</p>
        <p><strong>Campus:</strong> {{ campusName }}</p>
        <p><strong>Status:</strong> {{ application.status }}</p>
        <p v-if="application.decisionNotes"><strong>Decision notes:</strong> {{ application.decisionNotes }}</p>

        <template v-if="application.status !== 'APPROVED' && application.status !== 'REJECTED'">
          <div class="inline-form">
            <Button data-testid="mark-shortlisted" :disabled="isMarkingStatus" @click="onMarkStatus('SHORTLISTED')">
              Mark Shortlisted
            </Button>
            <Button data-testid="mark-interviewed" :disabled="isMarkingStatus" @click="onMarkStatus('INTERVIEWED')">
              Mark Interviewed
            </Button>
          </div>

          <section class="sub-form">
            <h2>Reject</h2>
            <p v-if="rejectErrorMessage" class="error" role="alert">{{ rejectErrorMessage }}</p>
            <FormField
              v-model="rejectDecisionNotes"
              label="Decision notes"
              type="text"
              data-testid="reject-decision-notes"
              placeholder="Reason for rejection"
              grow
            />
            <Button data-testid="reject-submit" variant="secondary" :disabled="isRejecting" @click="onReject">
              Reject
            </Button>
          </section>

          <section class="sub-form">
            <h2>Approve</h2>
            <p v-if="approveErrorMessage" class="error" role="alert">{{ approveErrorMessage }}</p>
            <div class="inline-form">
              <FormField v-model="approveDateOfBirth" label="Date of birth" type="date" data-testid="approve-dateOfBirth" />
              <FormField v-model="approveCnic" label="CNIC" type="text" data-testid="approve-cnic" placeholder="CNIC" grow />
              <FormField v-model="approveMobile" label="Mobile" type="text" data-testid="approve-mobile" placeholder="Mobile" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="approveEmail" label="Email" type="email" data-testid="approve-email" placeholder="Email" grow />
              <FormField v-model="approveJoiningDate" label="Joining date" type="date" data-testid="approve-joiningDate" />
            </div>

            <template v-if="application.employeeType === 'TEACHER'">
              <p class="hint">A login is required to hire a teacher.</p>
              <div class="inline-form">
                <FormField v-model="approveLoginIdentifier" label="Login email" type="text" data-testid="approve-login-identifier" placeholder="Login email" grow />
                <FormField v-model="approveLoginPassword" label="Initial password" type="password" data-testid="approve-login-password" placeholder="Initial password" grow />
              </div>
            </template>

            <Button data-testid="approve-submit" :disabled="isApproving" @click="onApprove">Approve</Button>
          </section>
        </template>
      </div>
    </div>
  </template>

  <style scoped>
  .application-detail {
    max-width: 900px;
  }
  .error {
    color: var(--color-destructive);
    margin-bottom: var(--space-3);
  }
  .hint {
    color: var(--color-muted, #64748b);
    font-size: var(--font-size-sm);
  }
  .application-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .sub-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-3);
  }
  .inline-form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  </style>
  ```

- [ ] **Step 4: Write `HiringApplicationDetailPageView.vue`**

  ```vue
  <!-- staff-console/src/views/HiringApplicationDetailPageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import HiringApplicationDetailView from './HiringApplicationDetailView.vue';
  </script>

  <template>
    <AppShell>
      <HiringApplicationDetailView />
    </AppShell>
  </template>
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx vitest run HiringApplicationDetailView.spec.ts`
  Expected: PASS, 6 tests.

- [ ] **Step 6: Add the route**

  In `staff-console/src/router/index.ts`, insert immediately after the `/admin/hiring` route
  block (added in Task 7):

  ```typescript
    {
      path: '/admin/hiring/:id',
      name: 'admin-hiring-detail',
      component: () => import('../views/HiringApplicationDetailPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring Application' },
    },
  ```

- [ ] **Step 7: Type-check**

  Run: `cd staff-console && npm run type-check`
  Expected: passes.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add Hiring application review/approve page"
  ```

---

### Task 9: Wire up Hiring nav, i18n, command palette; final verification

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`
- Modify: `staff-console/src/locales/en.json`
- Modify: `staff-console/src/locales/ur.json`
- Modify: `docs/database/migration-plan.md`

**Interfaces:**
- Consumes: the `/admin/hiring` route (Task 7).
- Produces: nothing further consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Add the `canManageHiring` gate and nav link**

  In `staff-console/src/components/AppShell.vue`, insert this computed immediately after
  `canManageBulkImport`:

  ```typescript
  // Deliberately SCHOOL_ADMIN/SUPER_ADMIN only, unlike canManageAdmissions — matches
  // HiringCandidatesController/HiringApplicationsController's own @Roles (no ACCOUNTS; hiring is
  // an HR function, not a fee-adjacent one, per the backend plan's Global Constraints).
  const canManageHiring = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
  ```

  In the "Operations" `nav-group`, insert this `RouterLink` immediately after the `nav-admissions`
  one:

  ```html
        <RouterLink v-if="canManageHiring" data-testid="nav-hiring" to="/admin/hiring"
          ><Icon name="users" />{{ t('nav.hiring') }}</RouterLink
        >
  ```

- [ ] **Step 2: Add the i18n key**

  In `staff-console/src/locales/en.json`, inside `"nav"`, insert `"hiring": "Hiring",`
  immediately after `"admissions": "Admissions",`.

  In `staff-console/src/locales/ur.json`, inside `"nav"`, insert `"hiring": "بھرتی",` immediately
  after `"admissions": "داخلے",`.

- [ ] **Step 3: Add command-palette entries**

  In `AppShell.vue`'s `goToItems` computed, change the `canManagePeople.value` block from:

  ```typescript
    if (canManagePeople.value) {
      items.push(
        { testid: 'cmdk-students', label: 'Students', icon: 'users', to: '/admin/students' },
        { testid: 'cmdk-parents', label: 'Parents', icon: 'user-circle', to: '/admin/parents' },
        { testid: 'cmdk-teachers', label: 'Teachers', icon: 'chalkboard', to: '/admin/teachers' },
      );
    }
  ```

  to:

  ```typescript
    if (canManagePeople.value) {
      items.push(
        { testid: 'cmdk-students', label: 'Students', icon: 'users', to: '/admin/students' },
        { testid: 'cmdk-staff', label: 'Staff', icon: 'users', to: '/admin/staff' },
        { testid: 'cmdk-parents', label: 'Parents', icon: 'user-circle', to: '/admin/parents' },
        { testid: 'cmdk-teachers', label: 'Teachers', icon: 'chalkboard', to: '/admin/teachers' },
      );
    }
  ```

  Then insert this block immediately after the `canManageCirculars.value` block, before
  `items.push({ testid: 'cmdk-messages', ...})`:

  ```typescript
    if (canManageHiring.value) {
      items.push({ testid: 'cmdk-hiring', label: 'Hiring', icon: 'users', to: '/admin/hiring' });
    }
  ```

- [ ] **Step 4: Write the failing nav test**

  In `staff-console/src/components/AppShell.spec.ts`, add `{ path: '/admin/hiring', name:
  'admin-hiring', component: { template: '<div>hiring</div>' } }` to the `routes` array in
  `makeRouter()`, immediately after the `/admin/students` route entry (or after `nav-staff`'s
  route, if Task 1's Step 17 already added one there). Then add this test after the
  `'shows nav-staff for SCHOOL_ADMIN/SUPER_ADMIN and hides it for ACCOUNTS/TEACHER'` test (added
  in Task 1):

  ```typescript
    it('shows nav-hiring for SCHOOL_ADMIN/SUPER_ADMIN and hides it for ACCOUNTS', async () => {
      let wrapper = await mountAsRole('SCHOOL_ADMIN');
      expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-hiring"]').attributes('href')).toBe('/admin/hiring');

      wrapper = await mountAsRole('SUPER_ADMIN');
      expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(true);

      wrapper = await mountAsRole('ACCOUNTS');
      expect(wrapper.find('[data-testid="nav-hiring"]').exists()).toBe(false);
    });
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `cd staff-console && npx vitest run AppShell.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 6: Update `docs/database/migration-plan.md`'s Sub-project 3 checklist**

  Change the line:

  ```markdown
  - [ ] Staff-console UI (Staff profile page, Hiring queue/intake/review pages) — a separate
        follow-on UI implementation plan, matching how Sub-project 1B followed Sub-project 1
  ```

  to:

  ```markdown
  - [x] Staff-console UI (Staff profile page, Hiring queue/intake/review pages) — a separate
        follow-on UI implementation plan, matching how Sub-project 1B followed Sub-project 1
  ```

- [ ] **Step 7: Full verification**

  ```bash
  cd staff-console
  npm run type-check
  npm run test
  npm run build
  ```

  Expected: type-check clean, every test passes (existing suite + this plan's new
  `StaffManagementView`/`StaffProfileView`/`HiringCandidateIntakeView`/`HiringQueueView`/
  `HiringApplicationDetailView`/`AppShell` specs), build succeeds.

- [ ] **Step 8: Commit**

  ```bash
  git add staff-console/src docs/database/migration-plan.md
  git commit -m "feat(staff-console): wire up Hiring nav/command-palette; close out Sub-project 3 UI"
  ```

---

## What this plan deliberately does not include

- **Bulk-import for Staff** — no bulk-import path exists on the backend for `Staff`/`Hiring`
  models; out of scope here too, matching the backend plan's own scope cut.
- **Non-teaching staff logins/RBAC UI** — there is no login/permission model for non-`TEACHER`
  hires yet (flagged as an explicit open decision in the design doc); nothing here assumes one.
- **e2e/browser test coverage** — matches the backend plan's unit-test-only precedent; this plan
  is Vitest component-test-only, no Playwright/Cypress.
- **A "withdrawn" status for hiring applications** — `HiringApplicationsService` doesn't support
  one (unlike Admissions' `WITHDRAWN`); the queue's status filter only offers the five statuses
  the backend actually produces.
