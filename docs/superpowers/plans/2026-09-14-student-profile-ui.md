# Student Profile UI (Sub-project 1B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-console UI for the Student profile backend surface added by Sub-project 1
(identity/contact/academic fields, addresses, previous school, emergency contacts, medical/welfare
info, documents, current-enrollment roll number) — a new `/admin/students/:id` detail page reachable
from the existing student list.

**Architecture:** One new `StudentProfilePageView.vue` → `StudentProfileView.vue` pair (matching
every other detail page in this app), built up section-by-section, each section defaulting to a
read-only display with a per-section "Edit" toggle that reveals a form scoped to that section's own
backend endpoint. Every mutation re-fetches the whole profile afterward — no local/optimistic
patching. A small, targeted extension to the shared `FormField.vue` component (adding `textarea`/
`email` variants) is done first since later sections depend on it.

**Tech Stack:** Vue 3 (`<script setup>`), Vue Router, Pinia, Vitest + `@vue/test-utils`, the existing
hand-rolled `fetch`-based `api.ts` client (no HTTP library).

**Spec:** `docs/superpowers/specs/2026-09-14-student-profile-ui-design.md`

## Global Constraints

- Every new/modified file follows this codebase's existing conventions exactly — verified against
  `StudentManagementView.vue`/`.spec.ts`, `ApplicationDetailView.vue`, `FormField.vue`/`.spec.ts`,
  `EntityTable.vue`, and `staff-console/src/lib/api.ts` before writing each task below. Do not
  introduce new UI patterns (modals, tabs, toasts, etc.) beyond what those files already establish.
- No `Tabs` component exists in this codebase and none is introduced — the profile page is one
  scrollable column of `<h2>`-sectioned content.
- No optimistic UI: every mutation re-fetches `GET profile` and replaces the whole `profile` ref.
- `FormField.vue` gains exactly two new `type` variants this plan needs: `'textarea'` and `'email'`.
  No `'number'` variant is added — numeric fields (`priority`) are plain `'text'` inputs, converted
  with `Number(...)` at the point they're sent to the API, matching how this codebase already
  handles every other "string in the DOM, typed value in the payload" case.
- The API client does **not** get `listEmergencyContacts`/`listDocuments` methods — the UI only ever
  calls `GET profile`, which already nests both lists. Those two backend routes exist for other
  future consumers, not this one.
- Emergency-contact editing (the in-place `EntityTable` row edit) covers scalar fields only (`name`,
  `relationship`, `phone`, `alternatePhone`, `email`, `priority`, `isPrimary`). Address on an
  emergency contact is settable only at creation time, in the "Add contact" form — `EntityTable`'s
  flat row/column editing model has no natural slot for a nested multi-field address sub-form, and
  no other view in this codebase does expandable-row editing. This is a deliberate scope cut, not an
  oversight.
- Every new route requires `SCHOOL_ADMIN`/`SUPER_ADMIN` (`meta.requiresRole`), matching
  `/admin/students`.
- All 4 backend enums used here (`Gender`, `BloodGroup`, `StudentStatus`, `DocumentType`) are
  hardcoded `{ value, label }[]` constants — no backend "list enum values" endpoint exists or is
  needed.
- This codebase has no file-preview/download URL convention anywhere (checked `DiaryView.vue`,
  `CircularsView.vue` — attachments are listed by name only, never rendered as `<img>` or a link).
  Documents and the profile photo are displayed the same way: by filename/presence, never as an
  image preview.

---

### Task 1: Extend `FormField.vue` with `textarea` and `email` variants

**Files:**
- Modify: `staff-console/src/components/FormField.vue`
- Modify: `staff-console/src/components/FormField.spec.ts`

**Interfaces:**
- Produces: `FormField`'s `type` prop accepts `'textarea'` and `'email'` in addition to the existing
  5 values. `'textarea'` renders a `<textarea>` (not `<input>`); `'email'` falls through to the
  existing `<input :type="type">` branch unchanged.

- [ ] **Step 1: Write the failing tests**

  Add to `staff-console/src/components/FormField.spec.ts`, after the existing `'renders a date
  input'` test:

  ```typescript
  it('renders an email input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Email', type: 'email' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('email');
  });

  it('renders a textarea and emits update:modelValue on input', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Notes', type: 'textarea', placeholder: 'Notes' },
    });
    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes('placeholder')).toBe('Notes');
    await textarea.setValue('Some notes');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Some notes']);
  });
  ```

  Add to the existing `'exposes a focus() method that focuses the inner control'` block area (as a
  new, separate test right after it):

  ```typescript
  it('exposes a focus() method that focuses a textarea control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Notes', type: 'textarea' },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.find('textarea').element);
    wrapper.unmount();
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `cd staff-console && npx vitest run src/components/FormField.spec.ts`
  Expected: the two new non-focus tests FAIL (`type` prop rejects `'email'`/`'textarea'` per the TS
  union, and no `<textarea>` is rendered); the new focus test FAILs (`wrapper.find('textarea')` finds
  nothing).

- [ ] **Step 3: Extend the component**

  In `staff-console/src/components/FormField.vue`, change the `type` prop union:

  ```typescript
  type: 'text' | 'password' | 'date' | 'email' | 'select' | 'checkbox' | 'textarea';
  ```

  Change the `inputRef` type to include `HTMLTextAreaElement`:

  ```typescript
  const inputRef = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
  ```

  In the template, add a `<textarea>` branch between the existing `<select>` and `<input>` branches:

  ```vue
    <select
      v-if="type === 'select'"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options ?? []" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <textarea
      v-else-if="type === 'textarea'"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      ref="inputRef"
      :type="type"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  ```

  In `<style scoped>`, change the existing selector to include `textarea`, and add a textarea-only
  rule right after it:

  ```css
  .form-field input,
  .form-field select,
  .form-field textarea {
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font: inherit;
  }
  .form-field textarea {
    min-height: 4.5rem;
    resize: vertical;
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/components/FormField.spec.ts`
  Expected: PASS, all 13 tests (the 10 original plus the 3 new ones).

- [ ] **Step 5: Run the full frontend test suite and type-check**

  Run: `npm test && npm run type-check`
  Expected: all pass — this change is additive to an existing prop union, so no other file using
  `FormField` with `'text'`/`'password'`/`'date'`/`'select'`/`'checkbox'` is affected.

- [ ] **Step 6: Commit**

  ```bash
  cd staff-console
  git add src/components/FormField.vue src/components/FormField.spec.ts
  git commit -m "feat(form-field): add textarea and email input variants"
  ```

---

### Task 2: Student-profile API types, client methods, and enum-option constants

**Files:**
- Create: `staff-console/src/lib/student-profile.constants.ts`
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Consumes: `API_BASE_URL`, `ApiError`, `parseErrorMessage`, `authHeaders`, `asJson` — all already
  defined at the top of `api.ts`; no changes to any of them.
- Produces: `StudentProfileDetail`, `AddressDetail`, `AddressInput`, `StudentPreviousSchoolDetail`,
  `StudentEmergencyContactDetail`, `StudentMedicalInfoDetail`, `StudentDocumentDetail`,
  `StudentCurrentEnrollmentDetail` types; `UpdateStudentProfilePayload`,
  `UpdateCurrentEnrollmentPayload`, `UpdatePreviousSchoolPayload`, `CreateEmergencyContactPayload`,
  `UpdateEmergencyContactPayload`, `UpdateMedicalInfoPayload`, `AddDocumentPayload` payload types;
  `api.getStudentProfile`, `api.updateStudentProfile`, `api.updateStudentCurrentEnrollment`,
  `api.upsertStudentPreviousSchool`, `api.createStudentEmergencyContact`,
  `api.updateStudentEmergencyContact`, `api.deleteStudentEmergencyContact`,
  `api.upsertStudentMedicalInfo`, `api.addStudentDocument`, `api.verifyStudentDocument` methods; and
  `GENDER_OPTIONS`, `BLOOD_GROUP_OPTIONS`, `STUDENT_STATUS_OPTIONS`, `DOCUMENT_TYPE_OPTIONS` constants
  — every later task in this plan imports from here.

This task has no dedicated spec file of its own (`api.ts` has none in this codebase — every existing
view exercises it only through mocks in that view's own spec), matching how the sibling backend
plan's Task 1 (schema/migration/seed) also had no unit test of its own. Correctness is verified by
`type-check` here and, transitively, by every later task's view spec mocking these exact method
names/signatures.

- [ ] **Step 1: Write the enum-option constants**

  Create `staff-console/src/lib/student-profile.constants.ts`:

  ```typescript
  // staff-console/src/lib/student-profile.constants.ts
  // Mirrors backend/prisma/schema.prisma's Gender/BloodGroup/StudentStatus/DocumentType enums.
  // No backend "list enum values" endpoint exists — these are small, stable, code-level constants.

  export interface SelectOption {
    value: string;
    label: string;
  }

  export const GENDER_OPTIONS: SelectOption[] = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
  ];

  export const BLOOD_GROUP_OPTIONS: SelectOption[] = [
    { value: 'A_POS', label: 'A+' },
    { value: 'A_NEG', label: 'A-' },
    { value: 'B_POS', label: 'B+' },
    { value: 'B_NEG', label: 'B-' },
    { value: 'AB_POS', label: 'AB+' },
    { value: 'AB_NEG', label: 'AB-' },
    { value: 'O_POS', label: 'O+' },
    { value: 'O_NEG', label: 'O-' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ];

  export const STUDENT_STATUS_OPTIONS: SelectOption[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'LEFT', label: 'Left' },
    { value: 'GRADUATED', label: 'Graduated' },
    { value: 'WITHDRAWN', label: 'Withdrawn' },
  ];

  export const DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
    { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
    { value: 'B_FORM', label: 'B-Form' },
    { value: 'LEAVING_CERTIFICATE', label: 'Leaving Certificate' },
    { value: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate' },
    { value: 'PREVIOUS_REPORT_CARD', label: 'Previous Report Card' },
    { value: 'PHOTOGRAPH', label: 'Photograph' },
    { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
    { value: 'CNIC', label: 'CNIC' },
    { value: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' },
    { value: 'CV', label: 'CV' },
    { value: 'OTHER', label: 'Other' },
  ];
  ```

- [ ] **Step 2: Add the response/detail types to `api.ts`**

  Add after the existing `StudentAdminSummary` interface (found by searching for
  `export interface StudentAdminSummary`):

  ```typescript
  export interface AddressDetail {
    id: string;
    line1: string;
    line2: string | null;
    area: string | null;
    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
  }

  export interface AddressInput {
    line1: string;
    line2?: string;
    area?: string;
    city?: string;
    district?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  }

  export interface StudentPreviousSchoolDetail {
    id: string;
    schoolName: string;
    address: AddressDetail | null;
    contactNumber: string | null;
    email: string | null;
    lastClassAttended: string | null;
    admissionDate: string | null;
    leavingDate: string | null;
    leavingCertificateNumber: string | null;
    leavingCertificateDate: string | null;
    reasonForLeaving: string | null;
    academicRemarks: string | null;
  }

  export interface StudentEmergencyContactDetail {
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

  export interface StudentMedicalInfoDetail {
    id: string;
    bloodGroup: string | null;
    allergies: string | null;
    medicalConditions: string | null;
    specialEducationalNeeds: string | null;
    medicationNotes: string | null;
    emergencyMedicalNotes: string | null;
  }

  export interface StudentDocumentDetail {
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

  export interface StudentCurrentEnrollmentDetail {
    id: string;
    rollNumber: string | null;
    remarks: string | null;
    section: {
      id: string;
      name: string;
      class: { id: string; name: string; campus: { id: string; name: string } };
    };
  }

  export interface StudentProfileDetail {
    id: string;
    grNumber: string;
    name: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    preferredName: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    nationality: string | null;
    religion: string | null;
    bFormNumber: string | null;
    profilePhotoFileId: string | null;
    status: 'ACTIVE' | 'LEFT' | 'GRADUATED' | 'WITHDRAWN';
    admissionDate: string | null;
    leavingDate: string | null;
    leavingReason: string | null;
    studentMobile: string | null;
    studentEmail: string | null;
    currentAddress: AddressDetail | null;
    permanentAddress: AddressDetail | null;
    previousSchool: StudentPreviousSchoolDetail | null;
    emergencyContacts: StudentEmergencyContactDetail[];
    medicalInfo: StudentMedicalInfoDetail | null;
    documents: StudentDocumentDetail[];
    // The backend's PROFILE_INCLUDE filters to the active enrollment with `take: 1` — 0 or 1 items.
    enrollments: StudentCurrentEnrollmentDetail[];
  }

  export interface UpdateStudentProfilePayload {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    preferredName?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    placeOfBirth?: string;
    nationality?: string;
    religion?: string;
    bFormNumber?: string;
    status?: 'ACTIVE' | 'LEFT' | 'GRADUATED' | 'WITHDRAWN';
    admissionDate?: string;
    leavingDate?: string;
    leavingReason?: string;
    studentMobile?: string;
    studentEmail?: string;
    profilePhotoFileId?: string;
    currentAddress?: AddressInput;
    permanentAddress?: AddressInput;
  }

  export interface UpdateCurrentEnrollmentPayload {
    rollNumber?: string;
    remarks?: string;
  }

  export interface UpdatePreviousSchoolPayload {
    schoolName: string;
    contactNumber?: string;
    email?: string;
    lastClassAttended?: string;
    admissionDate?: string;
    leavingDate?: string;
    leavingCertificateNumber?: string;
    leavingCertificateDate?: string;
    reasonForLeaving?: string;
    academicRemarks?: string;
    address?: AddressInput;
  }

  export interface CreateEmergencyContactPayload {
    name: string;
    relationship: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    priority?: number;
    isPrimary?: boolean;
    address?: AddressInput;
  }

  export interface UpdateEmergencyContactPayload {
    name?: string;
    relationship?: string;
    phone?: string;
    alternatePhone?: string;
    email?: string;
    priority?: number;
    isPrimary?: boolean;
  }

  export interface UpdateMedicalInfoPayload {
    bloodGroup?: string;
    allergies?: string;
    medicalConditions?: string;
    specialEducationalNeeds?: string;
    medicationNotes?: string;
    emergencyMedicalNotes?: string;
  }

  export interface AddDocumentPayload {
    documentType: string;
    fileId: string;
    expiryDate?: string;
    notes?: string;
  }
  ```

- [ ] **Step 3: Add the API methods**

  Add after the existing `deleteStudent` method (found by searching for `async deleteStudent`):

  ```typescript
    async getStudentProfile(accessToken: string, studentId: string): Promise<StudentProfileDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/profile`, {
        headers: authHeaders(accessToken),
      });
      return asJson(res);
    },

    async updateStudentProfile(
      accessToken: string,
      studentId: string,
      payload: UpdateStudentProfilePayload,
    ): Promise<StudentProfileDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async updateStudentCurrentEnrollment(
      accessToken: string,
      studentId: string,
      payload: UpdateCurrentEnrollmentPayload,
    ): Promise<StudentCurrentEnrollmentDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/current-enrollment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async upsertStudentPreviousSchool(
      accessToken: string,
      studentId: string,
      payload: UpdatePreviousSchoolPayload,
    ): Promise<StudentPreviousSchoolDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/previous-school`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async createStudentEmergencyContact(
      accessToken: string,
      studentId: string,
      payload: CreateEmergencyContactPayload,
    ): Promise<StudentEmergencyContactDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async updateStudentEmergencyContact(
      accessToken: string,
      studentId: string,
      contactId: string,
      payload: UpdateEmergencyContactPayload,
    ): Promise<StudentEmergencyContactDetail> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify(payload),
        },
      );
      return asJson(res);
    },

    async deleteStudentEmergencyContact(accessToken: string, studentId: string, contactId: string): Promise<void> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts/${contactId}`,
        { method: 'DELETE', headers: authHeaders(accessToken) },
      );
      if (!res.ok) {
        throw new ApiError(await parseErrorMessage(res), res.status);
      }
    },

    async upsertStudentMedicalInfo(
      accessToken: string,
      studentId: string,
      payload: UpdateMedicalInfoPayload,
    ): Promise<StudentMedicalInfoDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/medical-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async addStudentDocument(
      accessToken: string,
      studentId: string,
      payload: AddDocumentPayload,
    ): Promise<StudentDocumentDetail> {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      });
      return asJson(res);
    },

    async verifyStudentDocument(
      accessToken: string,
      studentId: string,
      documentId: string,
      verified: boolean,
    ): Promise<StudentDocumentDetail> {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/students/${studentId}/documents/${documentId}/verify`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify({ verified }),
        },
      );
      return asJson(res);
    },
  ```

- [ ] **Step 4: Type-check and run the full test suite**

  Run: `cd staff-console && npm run type-check && npm test`
  Expected: both pass. No existing file references any of these new names yet, so this step only
  proves the new code itself compiles and the existing suite is unaffected.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/api.ts src/lib/student-profile.constants.ts
  git commit -m "feat(student-profile): add API client types/methods and enum option constants"
  ```

---

### Task 3: `StudentProfileView` skeleton + Profile section (identity/contact/academic + addresses)

**Files:**
- Create: `staff-console/src/views/StudentProfilePageView.vue`
- Create: `staff-console/src/views/StudentProfileView.vue`
- Create: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `api.getStudentProfile`, `api.updateStudentProfile`, `useAuthStore`, `FormField`,
  `Button`, `GENDER_OPTIONS`, `STUDENT_STATUS_OPTIONS` (Task 2); `useRoute` (Task 4 needs the same
  `studentId`/`profile`/`load` — see that task's Interfaces block for what it reuses from here).
- Produces: `StudentProfileView.vue`'s exported-by-convention `studentId`, `profile`, `load()`,
  `pageErrorMessage` — every subsequent task (4-8) adds a new section to this same file and appends
  to this same spec file, reusing exactly these three.

- [ ] **Step 1: Write the failing test for the page-level load and the Profile section**

  Create `staff-console/src/views/StudentProfileView.spec.ts`:

  ```typescript
  // staff-console/src/views/StudentProfileView.spec.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { mount, flushPromises } from '@vue/test-utils';
  import { createPinia, setActivePinia } from 'pinia';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import StudentProfileView from './StudentProfileView.vue';
  import { useAuthStore } from '../stores/auth';
  import { api, type StudentProfileDetail } from '../lib/api';

  async function mountView(studentId = 's1') {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/admin/students/:id', name: 'admin-student-profile', component: StudentProfileView }],
    });
    await router.push(`/admin/students/${studentId}`);
    await router.isReady();
    return mount(StudentProfileView, { global: { plugins: [router] } });
  }

  function baseProfile(overrides: Partial<StudentProfileDetail> = {}): StudentProfileDetail {
    return {
      id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
      firstName: 'Eshaal', middleName: null, lastName: 'Sample', preferredName: null,
      gender: 'FEMALE', dateOfBirth: '2016-03-14', placeOfBirth: null, nationality: 'Pakistani',
      religion: null, bFormNumber: null, profilePhotoFileId: null, status: 'ACTIVE',
      admissionDate: '2022-08-01', leavingDate: null, leavingReason: null,
      studentMobile: null, studentEmail: null,
      currentAddress: null, permanentAddress: null,
      previousSchool: null, emergencyContacts: [], medicalInfo: null, documents: [],
      enrollments: [],
      ...overrides,
    };
  }

  vi.mock('../lib/api', () => ({
    api: {
      getStudentProfile: vi.fn(),
      updateStudentProfile: vi.fn(),
    },
  }));

  describe('StudentProfileView', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      auth.accessToken = 'token-1';
      Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    });

    it('loads and displays the student profile read-only', async () => {
      vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());

      const wrapper = await mountView();
      await flushPromises();

      expect(api.getStudentProfile).toHaveBeenCalledWith('token-1', 's1');
      expect(wrapper.text()).toContain('Eshaal Sample');
      expect(wrapper.text()).toContain('GR-1001');
      expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
    });

    it('shows a page-level error when the profile fails to load', async () => {
      vi.mocked(api.getStudentProfile).mockRejectedValue(new Error('Student not found'));

      const wrapper = await mountView();
      await flushPromises();

      expect(wrapper.find('[role="alert"]').text()).toContain('Student not found');
    });

    it('edits and saves profile fields', async () => {
      vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
      vi.mocked(api.updateStudentProfile).mockResolvedValue(baseProfile({ firstName: 'Renamed' }));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="edit-profile"]').trigger('click');
      await wrapper.find('[data-testid="profile-firstName"]').setValue('Renamed');
      await wrapper.find('[data-testid="profile-save"]').trigger('click');
      await flushPromises();

      expect(api.updateStudentProfile).toHaveBeenCalledWith(
        'token-1',
        's1',
        expect.objectContaining({ firstName: 'Renamed' }),
      );
      expect(api.getStudentProfile).toHaveBeenCalledTimes(2);
      expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
    });

    it('creates a new currentAddress when the student has none yet', async () => {
      vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
      vi.mocked(api.updateStudentProfile).mockResolvedValue(baseProfile());

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="edit-profile"]').trigger('click');
      await wrapper.find('[data-testid="profile-currentAddress-line1"]').setValue('House 1, Street 2');
      await wrapper.find('[data-testid="profile-save"]').trigger('click');
      await flushPromises();

      expect(api.updateStudentProfile).toHaveBeenCalledWith(
        'token-1',
        's1',
        expect.objectContaining({ currentAddress: expect.objectContaining({ line1: 'House 1, Street 2' }) }),
      );
    });

    it('cancels an edit without saving', async () => {
      vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="edit-profile"]').trigger('click');
      await wrapper.find('[data-testid="profile-firstName"]').setValue('Discard me');
      await wrapper.find('[data-testid="profile-cancel"]').trigger('click');

      expect(api.updateStudentProfile).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Eshaal Sample');
    });

    it('shows an error and stays in edit mode when saving the profile fails', async () => {
      vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile());
      vi.mocked(api.updateStudentProfile).mockRejectedValue(new Error('This B-Form number is already in use.'));

      const wrapper = await mountView();
      await flushPromises();

      await wrapper.find('[data-testid="edit-profile"]').trigger('click');
      await wrapper.find('[data-testid="profile-save"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="profile-error"]').text()).toContain('B-Form number');
      expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `cd staff-console && npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: FAIL — `Cannot find module './StudentProfileView.vue'`.

- [ ] **Step 3: Write `StudentProfilePageView.vue`**

  ```vue
  <!-- staff-console/src/views/StudentProfilePageView.vue -->
  <script setup lang="ts">
  import AppShell from '../components/AppShell.vue';
  import StudentProfileView from './StudentProfileView.vue';
  </script>

  <template>
    <AppShell>
      <StudentProfileView />
    </AppShell>
  </template>
  ```

- [ ] **Step 4: Write `StudentProfileView.vue`**

  ```vue
  <!-- staff-console/src/views/StudentProfileView.vue -->
  <script setup lang="ts">
  import { reactive, ref } from 'vue';
  import { useRoute } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { api, type AddressInput, type StudentProfileDetail } from '../lib/api';
  import { GENDER_OPTIONS, STUDENT_STATUS_OPTIONS } from '../lib/student-profile.constants';
  import FormField from '../components/FormField.vue';
  import Button from '../components/Button.vue';

  const auth = useAuthStore();
  const route = useRoute();
  const studentId = route.params.id as string;

  const profile = ref<StudentProfileDetail | null>(null);
  const pageErrorMessage = ref<string | null>(null);

  async function load() {
    if (!auth.accessToken) return;
    try {
      profile.value = await api.getStudentProfile(auth.accessToken, studentId);
    } catch (err) {
      pageErrorMessage.value = err instanceof Error ? err.message : 'Could not load this student.';
    }
  }
  load();

  function emptyAddress(): AddressInput {
    return { line1: '', line2: '', area: '', city: '', district: '', province: '', postalCode: '', country: '' };
  }
  function addressPayload(a: AddressInput): AddressInput | undefined {
    return a.line1.trim() ? a : undefined;
  }

  // --- Profile section (identity/contact/academic + addresses) --------------------------------
  const isEditingProfile = ref(false);
  const profileErrorMessage = ref<string | null>(null);
  const isSavingProfile = ref(false);

  const profileForm = reactive({
    firstName: '', middleName: '', lastName: '', preferredName: '',
    gender: '', dateOfBirth: '', placeOfBirth: '', nationality: '', religion: '', bFormNumber: '',
    status: 'ACTIVE', admissionDate: '', leavingDate: '', leavingReason: '',
    studentMobile: '', studentEmail: '',
  });
  const currentAddressForm = reactive<AddressInput>(emptyAddress());
  const permanentAddressForm = reactive<AddressInput>(emptyAddress());
  const profilePhotoFile = ref<File | null>(null);

  function startEditProfile() {
    if (!profile.value) return;
    const p = profile.value;
    profileForm.firstName = p.firstName ?? '';
    profileForm.middleName = p.middleName ?? '';
    profileForm.lastName = p.lastName ?? '';
    profileForm.preferredName = p.preferredName ?? '';
    profileForm.gender = p.gender ?? '';
    profileForm.dateOfBirth = p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '';
    profileForm.placeOfBirth = p.placeOfBirth ?? '';
    profileForm.nationality = p.nationality ?? '';
    profileForm.religion = p.religion ?? '';
    profileForm.bFormNumber = p.bFormNumber ?? '';
    profileForm.status = p.status;
    profileForm.admissionDate = p.admissionDate ? p.admissionDate.slice(0, 10) : '';
    profileForm.leavingDate = p.leavingDate ? p.leavingDate.slice(0, 10) : '';
    profileForm.leavingReason = p.leavingReason ?? '';
    profileForm.studentMobile = p.studentMobile ?? '';
    profileForm.studentEmail = p.studentEmail ?? '';
    Object.assign(currentAddressForm, p.currentAddress ? { ...emptyAddress(), ...p.currentAddress } : emptyAddress());
    Object.assign(permanentAddressForm, p.permanentAddress ? { ...emptyAddress(), ...p.permanentAddress } : emptyAddress());
    profilePhotoFile.value = null;
    profileErrorMessage.value = null;
    isEditingProfile.value = true;
  }

  function cancelEditProfile() {
    isEditingProfile.value = false;
    profileErrorMessage.value = null;
  }

  function onProfilePhotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    profilePhotoFile.value = input.files?.[0] ?? null;
  }

  async function onSaveProfile() {
    if (!auth.accessToken) return;
    profileErrorMessage.value = null;
    isSavingProfile.value = true;
    try {
      let profilePhotoFileId: string | undefined;
      if (profilePhotoFile.value) {
        const uploaded = await api.uploadFile(auth.accessToken, profilePhotoFile.value);
        profilePhotoFileId = uploaded.id;
      }
      await api.updateStudentProfile(auth.accessToken, studentId, {
        firstName: profileForm.firstName || undefined,
        middleName: profileForm.middleName || undefined,
        lastName: profileForm.lastName || undefined,
        preferredName: profileForm.preferredName || undefined,
        gender: (profileForm.gender || undefined) as StudentProfileDetail['gender'] & string | undefined,
        dateOfBirth: profileForm.dateOfBirth || undefined,
        placeOfBirth: profileForm.placeOfBirth || undefined,
        nationality: profileForm.nationality || undefined,
        religion: profileForm.religion || undefined,
        bFormNumber: profileForm.bFormNumber || undefined,
        status: profileForm.status as StudentProfileDetail['status'],
        admissionDate: profileForm.admissionDate || undefined,
        leavingDate: profileForm.leavingDate || undefined,
        leavingReason: profileForm.leavingReason || undefined,
        studentMobile: profileForm.studentMobile || undefined,
        studentEmail: profileForm.studentEmail || undefined,
        profilePhotoFileId,
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
  </script>

  <template>
    <div class="student-profile">
      <h1 v-if="profile">{{ profile.name }}</h1>
      <h1 v-else>Student Profile</h1>
      <p v-if="pageErrorMessage" class="error" role="alert">{{ pageErrorMessage }}</p>

      <div v-if="profile" class="sections">
        <section class="profile-section">
          <div class="section-header">
            <h2>Profile</h2>
            <Button v-if="!isEditingProfile" data-testid="edit-profile" @click="startEditProfile">Edit</Button>
          </div>
          <p v-if="profileErrorMessage" data-testid="profile-error" class="error" role="alert">{{ profileErrorMessage }}</p>

          <dl v-if="!isEditingProfile" class="detail-grid">
            <dt>GR Number</dt><dd>{{ profile.grNumber }}</dd>
            <dt>Full name</dt><dd>{{ profile.name }}</dd>
            <dt>Preferred name</dt><dd>{{ profile.preferredName ?? '—' }}</dd>
            <dt>Gender</dt><dd>{{ profile.gender ?? '—' }}</dd>
            <dt>Date of birth</dt><dd>{{ profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '—' }}</dd>
            <dt>Nationality</dt><dd>{{ profile.nationality ?? '—' }}</dd>
            <dt>Religion</dt><dd>{{ profile.religion ?? '—' }}</dd>
            <dt>B-Form number</dt><dd>{{ profile.bFormNumber ?? '—' }}</dd>
            <dt>Status</dt><dd>{{ profile.status }}</dd>
            <dt>Admission date</dt><dd>{{ profile.admissionDate ? profile.admissionDate.slice(0, 10) : '—' }}</dd>
            <dt>Mobile</dt><dd>{{ profile.studentMobile ?? '—' }}</dd>
            <dt>Email</dt><dd>{{ profile.studentEmail ?? '—' }}</dd>
            <dt>Profile photo</dt><dd>{{ profile.profilePhotoFileId ? 'On file' : 'Not uploaded' }}</dd>
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
              <FormField v-model="profileForm.preferredName" label="Preferred name" type="text" data-testid="profile-preferredName" placeholder="Preferred name" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.gender" label="Gender" type="select" data-testid="profile-gender" placeholder="Gender" :options="GENDER_OPTIONS" />
              <FormField v-model="profileForm.dateOfBirth" label="Date of birth" type="date" data-testid="profile-dateOfBirth" />
              <FormField v-model="profileForm.placeOfBirth" label="Place of birth" type="text" data-testid="profile-placeOfBirth" placeholder="Place of birth" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.nationality" label="Nationality" type="text" data-testid="profile-nationality" placeholder="Nationality" grow />
              <FormField v-model="profileForm.religion" label="Religion" type="text" data-testid="profile-religion" placeholder="Religion" grow />
              <FormField v-model="profileForm.bFormNumber" label="B-Form number" type="text" data-testid="profile-bFormNumber" placeholder="B-Form number" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="profileForm.status" label="Status" type="select" data-testid="profile-status" :options="STUDENT_STATUS_OPTIONS" />
              <FormField v-model="profileForm.admissionDate" label="Admission date" type="date" data-testid="profile-admissionDate" />
              <FormField v-model="profileForm.leavingDate" label="Leaving date" type="date" data-testid="profile-leavingDate" />
            </div>
            <FormField v-model="profileForm.leavingReason" label="Leaving reason" type="textarea" data-testid="profile-leavingReason" placeholder="Leaving reason" />
            <div class="inline-form">
              <FormField v-model="profileForm.studentMobile" label="Mobile" type="text" data-testid="profile-studentMobile" placeholder="Mobile" grow />
              <FormField v-model="profileForm.studentEmail" label="Email" type="email" data-testid="profile-studentEmail" placeholder="Email" grow />
            </div>
            <div class="form-field">
              <label class="sr-only" for="profile-photo-input">Profile photo</label>
              <input id="profile-photo-input" type="file" accept="image/*" data-testid="profile-photo-input" @change="onProfilePhotoChange" />
            </div>

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
  .student-profile {
    max-width: 900px;
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

  Note on the `gender as ... & string | undefined` cast in `onSaveProfile`: `profileForm.gender` is a
  plain `string` (needed so the empty `''` placeholder state is representable, which `FormField`'s
  `select` requires), but `UpdateStudentProfilePayload.gender` is the narrow union. The cast is
  scoped to this one assignment and mirrors the same "widen for the form, narrow at the API
  boundary" shape `profileForm.status` uses via a plain `as`.

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 6 tests.

- [ ] **Step 6: Type-check**

  Run: `npm run type-check`
  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/views/StudentProfilePageView.vue src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add profile page skeleton with identity/contact/academic section"
  ```

---

### Task 4: Current Enrollment section (roll number + remarks)

**Files:**
- Modify: `staff-console/src/views/StudentProfileView.vue`
- Modify: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `studentId`, `profile`, `load()` (Task 3); `api.updateStudentCurrentEnrollment` (Task 2).
- Produces: nothing new later tasks depend on — this section is self-contained.

- [ ] **Step 1: Write the failing tests**

  Add to the mocked `api` object in `StudentProfileView.spec.ts`:

  ```typescript
      updateStudentCurrentEnrollment: vi.fn(),
  ```

  Add a helper enrollment fixture near `baseProfile` and two new tests inside the `describe` block:

  ```typescript
  const activeEnrollment = {
    id: 'enr-1', rollNumber: '12', remarks: null,
    section: { id: 'sec-1', name: '3A', class: { id: 'c-1', name: 'Grade 3', campus: { id: 'cam-1', name: 'PECHS Campus' } } },
  };

  it('shows the current enrollment and edits roll number/remarks', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ enrollments: [activeEnrollment] }));
    vi.mocked(api.updateStudentCurrentEnrollment).mockResolvedValue({ ...activeEnrollment, rollNumber: '15' });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Grade 3');
    expect(wrapper.text()).toContain('PECHS Campus');

    await wrapper.find('[data-testid="edit-enrollment"]').trigger('click');
    await wrapper.find('[data-testid="enrollment-rollNumber"]').setValue('15');
    await wrapper.find('[data-testid="enrollment-save"]').trigger('click');
    await flushPromises();

    expect(api.updateStudentCurrentEnrollment).toHaveBeenCalledWith('token-1', 's1', {
      rollNumber: '15', remarks: undefined,
    });
  });

  it('shows "No active enrollment" and no edit control when there is none', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ enrollments: [] }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No active enrollment');
    expect(wrapper.find('[data-testid="edit-enrollment"]').exists()).toBe(false);
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: the two new tests FAIL (no enrollment section rendered yet).

- [ ] **Step 3: Add the Current Enrollment section**

  In `StudentProfileView.vue`'s `<script setup>`, add after the Profile section's code (after
  `onSaveProfile`):

  ```typescript
  // --- Current Enrollment section (roll number + remarks) --------------------------------------
  const isEditingEnrollment = ref(false);
  const enrollmentErrorMessage = ref<string | null>(null);
  const isSavingEnrollment = ref(false);
  const enrollmentForm = reactive({ rollNumber: '', remarks: '' });

  function startEditEnrollment() {
    const enrollment = profile.value?.enrollments[0];
    enrollmentForm.rollNumber = enrollment?.rollNumber ?? '';
    enrollmentForm.remarks = enrollment?.remarks ?? '';
    enrollmentErrorMessage.value = null;
    isEditingEnrollment.value = true;
  }

  function cancelEditEnrollment() {
    isEditingEnrollment.value = false;
    enrollmentErrorMessage.value = null;
  }

  async function onSaveEnrollment() {
    if (!auth.accessToken) return;
    enrollmentErrorMessage.value = null;
    isSavingEnrollment.value = true;
    try {
      await api.updateStudentCurrentEnrollment(auth.accessToken, studentId, {
        rollNumber: enrollmentForm.rollNumber || undefined,
        remarks: enrollmentForm.remarks || undefined,
      });
      await load();
      isEditingEnrollment.value = false;
    } catch (err) {
      enrollmentErrorMessage.value = err instanceof Error ? err.message : 'Could not save the enrollment.';
    } finally {
      isSavingEnrollment.value = false;
    }
  }
  ```

  In the template, add a new `<section>` right after the closing `</section>` of the Profile
  section (still inside `.sections`):

  ```vue
        <section class="profile-section">
          <div class="section-header">
            <h2>Current Enrollment</h2>
            <Button v-if="!isEditingEnrollment && profile.enrollments[0]" data-testid="edit-enrollment" @click="startEditEnrollment">Edit</Button>
          </div>
          <p v-if="enrollmentErrorMessage" class="error" role="alert">{{ enrollmentErrorMessage }}</p>

          <p v-if="!profile.enrollments[0]">No active enrollment.</p>
          <template v-else>
            <dl v-if="!isEditingEnrollment" class="detail-grid">
              <dt>Class</dt><dd>{{ profile.enrollments[0].section.class.name }}{{ profile.enrollments[0].section.name }}</dd>
              <dt>Campus</dt><dd>{{ profile.enrollments[0].section.class.campus.name }}</dd>
              <dt>Roll number</dt><dd>{{ profile.enrollments[0].rollNumber ?? '—' }}</dd>
              <dt>Remarks</dt><dd>{{ profile.enrollments[0].remarks ?? '—' }}</dd>
            </dl>
            <div v-else class="edit-form">
              <FormField v-model="enrollmentForm.rollNumber" label="Roll number" type="text" data-testid="enrollment-rollNumber" placeholder="Roll number" grow />
              <FormField v-model="enrollmentForm.remarks" label="Remarks" type="textarea" data-testid="enrollment-remarks" placeholder="Remarks" />
              <div class="form-actions">
                <Button data-testid="enrollment-save" :disabled="isSavingEnrollment" @click="onSaveEnrollment">Save</Button>
                <Button variant="secondary" data-testid="enrollment-cancel" @click="cancelEditEnrollment">Cancel</Button>
              </div>
            </div>
          </template>
        </section>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 8 tests.

- [ ] **Step 5: Type-check**

  Run: `npm run type-check`

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add current enrollment roll number/remarks section"
  ```

---

### Task 5: Previous School section

**Files:**
- Modify: `staff-console/src/views/StudentProfileView.vue`
- Modify: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `studentId`, `profile`, `load()`, `emptyAddress()`, `addressPayload()` (Task 3);
  `api.upsertStudentPreviousSchool` (Task 2).

- [ ] **Step 1: Write the failing tests**

  Add to the mocked `api` object:

  ```typescript
      upsertStudentPreviousSchool: vi.fn(),
  ```

  Add tests:

  ```typescript
  it('adds a previous school when none exists yet', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ previousSchool: null }));
    vi.mocked(api.upsertStudentPreviousSchool).mockResolvedValue({
      id: 'ps1', schoolName: 'Old School', address: null, contactNumber: null, email: null,
      lastClassAttended: null, admissionDate: null, leavingDate: null, leavingCertificateNumber: null,
      leavingCertificateDate: null, reasonForLeaving: null, academicRemarks: null,
    });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No previous school on file');
    await wrapper.find('[data-testid="edit-previous-school"]').trigger('click');
    await wrapper.find('[data-testid="previous-school-schoolName"]').setValue('Old School');
    await wrapper.find('[data-testid="previous-school-save"]').trigger('click');
    await flushPromises();

    expect(api.upsertStudentPreviousSchool).toHaveBeenCalledWith(
      'token-1', 's1', expect.objectContaining({ schoolName: 'Old School' }),
    );
  });

  it('shows an existing previous school read-only, and its address when present', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({
      previousSchool: {
        id: 'ps1', schoolName: 'Beaconhouse Prep', address: { id: 'a1', line1: 'Old House', line2: null, area: null, city: 'Karachi', district: null, province: null, postalCode: null, country: 'Pakistan' },
        contactNumber: null, email: null, lastClassAttended: 'Grade 2', admissionDate: null, leavingDate: null,
        leavingCertificateNumber: null, leavingCertificateDate: null, reasonForLeaving: null, academicRemarks: null,
      },
    }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Beaconhouse Prep');
    expect(wrapper.text()).toContain('Old House');
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: the two new tests FAIL.

- [ ] **Step 3: Add the Previous School section**

  In `<script setup>`, add after the Enrollment section's code:

  ```typescript
  // --- Previous School section ------------------------------------------------------------------
  const isEditingPreviousSchool = ref(false);
  const previousSchoolErrorMessage = ref<string | null>(null);
  const isSavingPreviousSchool = ref(false);
  const previousSchoolForm = reactive({
    schoolName: '', contactNumber: '', email: '', lastClassAttended: '',
    admissionDate: '', leavingDate: '', leavingCertificateNumber: '', leavingCertificateDate: '',
    reasonForLeaving: '', academicRemarks: '',
  });
  const previousSchoolAddressForm = reactive<AddressInput>(emptyAddress());

  function startEditPreviousSchool() {
    const ps = profile.value?.previousSchool;
    previousSchoolForm.schoolName = ps?.schoolName ?? '';
    previousSchoolForm.contactNumber = ps?.contactNumber ?? '';
    previousSchoolForm.email = ps?.email ?? '';
    previousSchoolForm.lastClassAttended = ps?.lastClassAttended ?? '';
    previousSchoolForm.admissionDate = ps?.admissionDate ? ps.admissionDate.slice(0, 10) : '';
    previousSchoolForm.leavingDate = ps?.leavingDate ? ps.leavingDate.slice(0, 10) : '';
    previousSchoolForm.leavingCertificateNumber = ps?.leavingCertificateNumber ?? '';
    previousSchoolForm.leavingCertificateDate = ps?.leavingCertificateDate ? ps.leavingCertificateDate.slice(0, 10) : '';
    previousSchoolForm.reasonForLeaving = ps?.reasonForLeaving ?? '';
    previousSchoolForm.academicRemarks = ps?.academicRemarks ?? '';
    Object.assign(previousSchoolAddressForm, ps?.address ? { ...emptyAddress(), ...ps.address } : emptyAddress());
    previousSchoolErrorMessage.value = null;
    isEditingPreviousSchool.value = true;
  }

  function cancelEditPreviousSchool() {
    isEditingPreviousSchool.value = false;
    previousSchoolErrorMessage.value = null;
  }

  async function onSavePreviousSchool() {
    if (!auth.accessToken || !previousSchoolForm.schoolName.trim()) return;
    previousSchoolErrorMessage.value = null;
    isSavingPreviousSchool.value = true;
    try {
      await api.upsertStudentPreviousSchool(auth.accessToken, studentId, {
        schoolName: previousSchoolForm.schoolName.trim(),
        contactNumber: previousSchoolForm.contactNumber || undefined,
        email: previousSchoolForm.email || undefined,
        lastClassAttended: previousSchoolForm.lastClassAttended || undefined,
        admissionDate: previousSchoolForm.admissionDate || undefined,
        leavingDate: previousSchoolForm.leavingDate || undefined,
        leavingCertificateNumber: previousSchoolForm.leavingCertificateNumber || undefined,
        leavingCertificateDate: previousSchoolForm.leavingCertificateDate || undefined,
        reasonForLeaving: previousSchoolForm.reasonForLeaving || undefined,
        academicRemarks: previousSchoolForm.academicRemarks || undefined,
        address: addressPayload(previousSchoolAddressForm),
      });
      await load();
      isEditingPreviousSchool.value = false;
    } catch (err) {
      previousSchoolErrorMessage.value = err instanceof Error ? err.message : 'Could not save the previous school.';
    } finally {
      isSavingPreviousSchool.value = false;
    }
  }
  ```

  In the template, add after the Current Enrollment `</section>`:

  ```vue
        <section class="profile-section">
          <div class="section-header">
            <h2>Previous School</h2>
            <Button v-if="!isEditingPreviousSchool" data-testid="edit-previous-school" @click="startEditPreviousSchool">Edit</Button>
          </div>
          <p v-if="previousSchoolErrorMessage" class="error" role="alert">{{ previousSchoolErrorMessage }}</p>

          <template v-if="!isEditingPreviousSchool">
            <p v-if="!profile.previousSchool">No previous school on file.</p>
            <dl v-else class="detail-grid">
              <dt>School</dt><dd>{{ profile.previousSchool.schoolName }}</dd>
              <dt>Last class attended</dt><dd>{{ profile.previousSchool.lastClassAttended ?? '—' }}</dd>
              <dt>Contact</dt><dd>{{ profile.previousSchool.contactNumber ?? '—' }}</dd>
              <dt>Email</dt><dd>{{ profile.previousSchool.email ?? '—' }}</dd>
              <dt>Reason for leaving</dt><dd>{{ profile.previousSchool.reasonForLeaving ?? '—' }}</dd>
              <dt>Address</dt>
              <dd>{{ profile.previousSchool.address ? [profile.previousSchool.address.line1, profile.previousSchool.address.city].filter(Boolean).join(', ') : '—' }}</dd>
            </dl>
          </template>
          <div v-else class="edit-form">
            <div class="inline-form">
              <FormField v-model="previousSchoolForm.schoolName" label="School name" type="text" data-testid="previous-school-schoolName" placeholder="School name" grow />
              <FormField v-model="previousSchoolForm.lastClassAttended" label="Last class attended" type="text" data-testid="previous-school-lastClassAttended" placeholder="Last class attended" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="previousSchoolForm.contactNumber" label="Contact number" type="text" data-testid="previous-school-contactNumber" placeholder="Contact number" grow />
              <FormField v-model="previousSchoolForm.email" label="Email" type="email" data-testid="previous-school-email" placeholder="Email" grow />
            </div>
            <div class="inline-form">
              <FormField v-model="previousSchoolForm.admissionDate" label="Admission date" type="date" data-testid="previous-school-admissionDate" />
              <FormField v-model="previousSchoolForm.leavingDate" label="Leaving date" type="date" data-testid="previous-school-leavingDate" />
            </div>
            <div class="inline-form">
              <FormField v-model="previousSchoolForm.leavingCertificateNumber" label="Leaving certificate #" type="text" data-testid="previous-school-leavingCertificateNumber" placeholder="Leaving certificate #" grow />
              <FormField v-model="previousSchoolForm.leavingCertificateDate" label="Leaving certificate date" type="date" data-testid="previous-school-leavingCertificateDate" />
            </div>
            <FormField v-model="previousSchoolForm.reasonForLeaving" label="Reason for leaving" type="textarea" data-testid="previous-school-reasonForLeaving" placeholder="Reason for leaving" />
            <FormField v-model="previousSchoolForm.academicRemarks" label="Academic remarks" type="textarea" data-testid="previous-school-academicRemarks" placeholder="Academic remarks" />

            <h3>Address</h3>
            <div class="inline-form">
              <FormField v-model="previousSchoolAddressForm.line1" label="Line 1" type="text" data-testid="previous-school-address-line1" placeholder="Line 1" grow />
              <FormField v-model="previousSchoolAddressForm.city" label="City" type="text" data-testid="previous-school-address-city" placeholder="City" grow />
            </div>

            <div class="form-actions">
              <Button data-testid="previous-school-save" :disabled="isSavingPreviousSchool" @click="onSavePreviousSchool">Save</Button>
              <Button variant="secondary" data-testid="previous-school-cancel" @click="cancelEditPreviousSchool">Cancel</Button>
            </div>
          </div>
        </section>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 10 tests.

- [ ] **Step 5: Type-check**

  Run: `npm run type-check`

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add previous school section"
  ```

---

### Task 6: Emergency Contacts section (list + add/edit/delete)

**Files:**
- Modify: `staff-console/src/views/StudentProfileView.vue`
- Modify: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `studentId`, `profile`, `load()` (Task 3); `EntityTable`, `useConfirm` (existing
  components/lib); `api.createStudentEmergencyContact`, `api.updateStudentEmergencyContact`,
  `api.deleteStudentEmergencyContact` (Task 2).

- [ ] **Step 1: Write the failing tests**

  Add to the mocked `api` object:

  ```typescript
      createStudentEmergencyContact: vi.fn(),
      updateStudentEmergencyContact: vi.fn(),
      deleteStudentEmergencyContact: vi.fn(),
  ```

  Add to the top of the file, alongside the existing `vi.mock('../lib/api', ...)` block:

  ```typescript
  vi.mock('../lib/useConfirm', () => ({
    useConfirm: vi.fn(),
  }));
  ```

  Add `import { useConfirm } from '../lib/useConfirm';` to the imports, and in `beforeEach`, after
  `Object.values(api).forEach(...)`, add:

  ```typescript
      vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  ```

  Add tests:

  ```typescript
  const emergencyContact = {
    id: 'ec1', name: 'Amina Sample', relationship: 'Mother', phone: '0300-1234567',
    alternatePhone: null, email: null, address: null, priority: 1, isPrimary: true,
  };

  it('lists emergency contacts and adds a new one', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.createStudentEmergencyContact).mockResolvedValue({ ...emergencyContact, id: 'ec2', name: 'New Contact' });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Amina Sample');

    await wrapper.find('[data-testid="new-contact-name"]').setValue('New Contact');
    await wrapper.find('[data-testid="new-contact-relationship"]').setValue('Uncle');
    await wrapper.find('[data-testid="new-contact-phone"]').setValue('0311-0000000');
    await wrapper.find('[data-testid="add-contact-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudentEmergencyContact).toHaveBeenCalledWith('token-1', 's1', {
      name: 'New Contact', relationship: 'Uncle', phone: '0311-0000000',
      alternatePhone: undefined, email: undefined, priority: 1, isPrimary: false,
    });
  });

  it('edits an emergency contact in place', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.updateStudentEmergencyContact).mockResolvedValue({ ...emergencyContact, name: 'Renamed Contact' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="edit-contact-ec1"]').trigger('click');
    await wrapper.find('[data-testid="edit-contact-name-ec1"]').setValue('Renamed Contact');
    await wrapper.find('[data-testid="save-contact-ec1"]').trigger('click');
    await flushPromises();

    expect(api.updateStudentEmergencyContact).toHaveBeenCalledWith(
      'token-1', 's1', 'ec1', expect.objectContaining({ name: 'Renamed Contact' }),
    );
  });

  it('deletes an emergency contact after confirmation', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ emergencyContacts: [emergencyContact] }));
    vi.mocked(api.deleteStudentEmergencyContact).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-contact-ec1"]').trigger('click');
    await flushPromises();

    expect(api.deleteStudentEmergencyContact).toHaveBeenCalledWith('token-1', 's1', 'ec1');
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: the three new tests FAIL.

- [ ] **Step 3: Add the Emergency Contacts section**

  In `<script setup>`, add the `EntityTable` and `useConfirm` imports at the top alongside the
  existing ones:

  ```typescript
  import EntityTable from '../components/EntityTable.vue';
  import { useConfirm } from '../lib/useConfirm';
  ```

  Add `const { confirm } = useConfirm();` near the top, alongside `const auth = useAuthStore();`.

  Add after the Previous School section's code:

  ```typescript
  // --- Emergency Contacts section -----------------------------------------------------------------
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
      await api.createStudentEmergencyContact(auth.accessToken, studentId, {
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

  function startEditContact(contact: StudentProfileDetail['emergencyContacts'][number]) {
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
      await api.updateStudentEmergencyContact(auth.accessToken, studentId, contactId, {
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
      await api.deleteStudentEmergencyContact(auth.accessToken, studentId, contactId);
      await load();
    } catch (err) {
      contactsErrorMessage.value = err instanceof Error ? err.message : 'Could not delete this contact.';
    }
  }
  ```

  Add `StudentProfileDetail` import already present from Task 3 covers the type reference above (no
  new import needed — it's the same type used for `profile`).

  In the template, add after the Previous School `</section>`:

  ```vue
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

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 13 tests.

- [ ] **Step 5: Type-check**

  Run: `npm run type-check`

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add emergency contacts CRUD section"
  ```

---

### Task 7: Medical/Welfare Info section

**Files:**
- Modify: `staff-console/src/views/StudentProfileView.vue`
- Modify: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `studentId`, `profile`, `load()` (Task 3); `BLOOD_GROUP_OPTIONS` (Task 2);
  `api.upsertStudentMedicalInfo` (Task 2).

- [ ] **Step 1: Write the failing test**

  Add to the mocked `api` object:

  ```typescript
      upsertStudentMedicalInfo: vi.fn(),
  ```

  Add test:

  ```typescript
  it('edits and saves medical info', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ medicalInfo: null }));
    vi.mocked(api.upsertStudentMedicalInfo).mockResolvedValue({
      id: 'm1', bloodGroup: 'O_POS', allergies: 'None known', medicalConditions: null,
      specialEducationalNeeds: null, medicationNotes: null, emergencyMedicalNotes: null,
    });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('No medical information on file');
    await wrapper.find('[data-testid="edit-medical-info"]').trigger('click');
    await wrapper.find('[data-testid="medical-bloodGroup"]').setValue('O_POS');
    await wrapper.find('[data-testid="medical-allergies"]').setValue('None known');
    await wrapper.find('[data-testid="medical-save"]').trigger('click');
    await flushPromises();

    expect(api.upsertStudentMedicalInfo).toHaveBeenCalledWith('token-1', 's1', {
      bloodGroup: 'O_POS', allergies: 'None known', medicalConditions: undefined,
      specialEducationalNeeds: undefined, medicationNotes: undefined, emergencyMedicalNotes: undefined,
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Add the Medical Info section**

  In `<script setup>`, add the constants import (extend the existing import from Task 3):

  ```typescript
  import { GENDER_OPTIONS, STUDENT_STATUS_OPTIONS, BLOOD_GROUP_OPTIONS } from '../lib/student-profile.constants';
  ```

  Add after the Emergency Contacts section's code:

  ```typescript
  // --- Medical/Welfare Info section -------------------------------------------------------------
  const isEditingMedicalInfo = ref(false);
  const medicalInfoErrorMessage = ref<string | null>(null);
  const isSavingMedicalInfo = ref(false);
  const medicalInfoForm = reactive({
    bloodGroup: '', allergies: '', medicalConditions: '', specialEducationalNeeds: '',
    medicationNotes: '', emergencyMedicalNotes: '',
  });

  function startEditMedicalInfo() {
    const m = profile.value?.medicalInfo;
    medicalInfoForm.bloodGroup = m?.bloodGroup ?? '';
    medicalInfoForm.allergies = m?.allergies ?? '';
    medicalInfoForm.medicalConditions = m?.medicalConditions ?? '';
    medicalInfoForm.specialEducationalNeeds = m?.specialEducationalNeeds ?? '';
    medicalInfoForm.medicationNotes = m?.medicationNotes ?? '';
    medicalInfoForm.emergencyMedicalNotes = m?.emergencyMedicalNotes ?? '';
    medicalInfoErrorMessage.value = null;
    isEditingMedicalInfo.value = true;
  }

  function cancelEditMedicalInfo() {
    isEditingMedicalInfo.value = false;
    medicalInfoErrorMessage.value = null;
  }

  async function onSaveMedicalInfo() {
    if (!auth.accessToken) return;
    medicalInfoErrorMessage.value = null;
    isSavingMedicalInfo.value = true;
    try {
      await api.upsertStudentMedicalInfo(auth.accessToken, studentId, {
        bloodGroup: medicalInfoForm.bloodGroup || undefined,
        allergies: medicalInfoForm.allergies || undefined,
        medicalConditions: medicalInfoForm.medicalConditions || undefined,
        specialEducationalNeeds: medicalInfoForm.specialEducationalNeeds || undefined,
        medicationNotes: medicalInfoForm.medicationNotes || undefined,
        emergencyMedicalNotes: medicalInfoForm.emergencyMedicalNotes || undefined,
      });
      await load();
      isEditingMedicalInfo.value = false;
    } catch (err) {
      medicalInfoErrorMessage.value = err instanceof Error ? err.message : 'Could not save medical info.';
    } finally {
      isSavingMedicalInfo.value = false;
    }
  }
  ```

  In the template, add after the Emergency Contacts `</section>`:

  ```vue
        <section class="profile-section">
          <div class="section-header">
            <h2>Medical / Welfare Info</h2>
            <Button v-if="!isEditingMedicalInfo" data-testid="edit-medical-info" @click="startEditMedicalInfo">Edit</Button>
          </div>
          <p v-if="medicalInfoErrorMessage" class="error" role="alert">{{ medicalInfoErrorMessage }}</p>

          <template v-if="!isEditingMedicalInfo">
            <p v-if="!profile.medicalInfo">No medical information on file.</p>
            <dl v-else class="detail-grid">
              <dt>Blood group</dt><dd>{{ profile.medicalInfo.bloodGroup ?? '—' }}</dd>
              <dt>Allergies</dt><dd>{{ profile.medicalInfo.allergies ?? '—' }}</dd>
              <dt>Medical conditions</dt><dd>{{ profile.medicalInfo.medicalConditions ?? '—' }}</dd>
              <dt>Special educational needs</dt><dd>{{ profile.medicalInfo.specialEducationalNeeds ?? '—' }}</dd>
              <dt>Medication notes</dt><dd>{{ profile.medicalInfo.medicationNotes ?? '—' }}</dd>
              <dt>Emergency medical notes</dt><dd>{{ profile.medicalInfo.emergencyMedicalNotes ?? '—' }}</dd>
            </dl>
          </template>
          <div v-else class="edit-form">
            <FormField v-model="medicalInfoForm.bloodGroup" label="Blood group" type="select" data-testid="medical-bloodGroup" placeholder="Blood group" :options="BLOOD_GROUP_OPTIONS" />
            <FormField v-model="medicalInfoForm.allergies" label="Allergies" type="textarea" data-testid="medical-allergies" placeholder="Allergies" />
            <FormField v-model="medicalInfoForm.medicalConditions" label="Medical conditions" type="textarea" data-testid="medical-medicalConditions" placeholder="Medical conditions" />
            <FormField v-model="medicalInfoForm.specialEducationalNeeds" label="Special educational needs" type="textarea" data-testid="medical-specialEducationalNeeds" placeholder="Special educational needs" />
            <FormField v-model="medicalInfoForm.medicationNotes" label="Medication notes" type="textarea" data-testid="medical-medicationNotes" placeholder="Medication notes" />
            <FormField v-model="medicalInfoForm.emergencyMedicalNotes" label="Emergency medical notes" type="textarea" data-testid="medical-emergencyMedicalNotes" placeholder="Emergency medical notes" />
            <div class="form-actions">
              <Button data-testid="medical-save" :disabled="isSavingMedicalInfo" @click="onSaveMedicalInfo">Save</Button>
              <Button variant="secondary" data-testid="medical-cancel" @click="cancelEditMedicalInfo">Cancel</Button>
            </div>
          </div>
        </section>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 14 tests.

- [ ] **Step 5: Type-check**

  Run: `npm run type-check`

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add medical/welfare info section"
  ```

---

### Task 8: Documents section (add/list/verify)

**Files:**
- Modify: `staff-console/src/views/StudentProfileView.vue`
- Modify: `staff-console/src/views/StudentProfileView.spec.ts`

**Interfaces:**
- Consumes: `studentId`, `profile`, `load()` (Task 3); `DOCUMENT_TYPE_OPTIONS` (Task 2);
  `api.uploadFile` (already exists, used the same way `DiaryView.vue` uses it);
  `api.addStudentDocument`, `api.verifyStudentDocument` (Task 2); `StatusPill` (existing component).

- [ ] **Step 1: Write the failing tests**

  Add to the mocked `api` object:

  ```typescript
      uploadFile: vi.fn(),
      addStudentDocument: vi.fn(),
      verifyStudentDocument: vi.fn(),
  ```

  Add tests:

  ```typescript
  const pendingDocument = {
    id: 'd1', documentType: 'BIRTH_CERTIFICATE',
    file: { id: 'f1', originalName: 'birth-cert.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
    expiryDate: null, verificationStatus: 'PENDING' as const, verifiedById: null, verifiedAt: null,
    notes: null, createdAt: '2026-09-14T00:00:00.000Z',
  };

  it('lists documents and uploads a new one', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'f2' });
    vi.mocked(api.addStudentDocument).mockResolvedValue({ ...pendingDocument, id: 'd2' });

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('birth-cert.pdf');

    await wrapper.find('[data-testid="new-document-type"]').setValue('CNIC');
    const fileInput = wrapper.find('[data-testid="new-document-file"]');
    const file = new File(['data'], 'cnic.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await wrapper.find('[data-testid="add-document-submit"]').trigger('click');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);
    expect(api.addStudentDocument).toHaveBeenCalledWith('token-1', 's1', {
      documentType: 'CNIC', fileId: 'f2', expiryDate: undefined, notes: undefined,
    });
  });

  it('verifies a pending document', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.verifyStudentDocument).mockResolvedValue({ ...pendingDocument, verificationStatus: 'VERIFIED' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="verify-document-d1"]').trigger('click');
    await flushPromises();

    expect(api.verifyStudentDocument).toHaveBeenCalledWith('token-1', 's1', 'd1', true);
  });

  it('rejects a pending document', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({ documents: [pendingDocument] }));
    vi.mocked(api.verifyStudentDocument).mockResolvedValue({ ...pendingDocument, verificationStatus: 'REJECTED' });

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="reject-document-d1"]').trigger('click');
    await flushPromises();

    expect(api.verifyStudentDocument).toHaveBeenCalledWith('token-1', 's1', 'd1', false);
  });

  it('hides verify/reject actions for a document that is already decided', async () => {
    vi.mocked(api.getStudentProfile).mockResolvedValue(baseProfile({
      documents: [{ ...pendingDocument, verificationStatus: 'VERIFIED' }],
    }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.find('[data-testid="verify-document-d1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="reject-document-d1"]').exists()).toBe(false);
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: the four new tests FAIL.

- [ ] **Step 3: Add the Documents section**

  In `<script setup>`, add the `StatusPill` import and extend the constants import:

  ```typescript
  import { GENDER_OPTIONS, STUDENT_STATUS_OPTIONS, BLOOD_GROUP_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '../lib/student-profile.constants';
  import StatusPill from '../components/StatusPill.vue';
  ```

  Add after the Medical Info section's code:

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
      await api.addStudentDocument(auth.accessToken, studentId, {
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
      await api.verifyStudentDocument(auth.accessToken, studentId, documentId, verified);
      await load();
    } catch (err) {
      documentsErrorMessage.value = err instanceof Error ? err.message : 'Could not update this document.';
    }
  }
  ```

  In the template, add after the Medical Info `</section>`, still inside `.sections`:

  ```vue
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

  This reuses `EntityTable` per the design spec, passing `:editing-id="null"` since documents have no
  in-place row edit — only row actions (Verify/Reject) — so no row ever matches `editingId` and every
  `cell-*` slot's `editing` param is always `false` (unused here, the default `{{ item[col.key] }}`
  rendering is overridden by explicit `cell-*` slots for every column anyway). No new CSS is needed —
  `EntityTable.vue` already carries its own scoped `.entity-table` styles.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/views/StudentProfileView.spec.ts`
  Expected: PASS, all 18 tests.

- [ ] **Step 5: Type-check**

  Run: `npm run type-check`

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/StudentProfileView.vue src/views/StudentProfileView.spec.ts
  git commit -m "feat(student-profile): add documents add/list/verify section"
  ```

---

### Task 9: Wire the route and the "View Profile" link

**Files:**
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/views/StudentManagementView.vue`
- Modify: `staff-console/src/views/StudentManagementView.spec.ts`

**Interfaces:**
- Consumes: `StudentProfilePageView.vue` (Task 3).
- Produces: the `/admin/students/:id` route, named `admin-student-profile` — this is the only name
  any future consumer (e.g. a "View Profile" link added elsewhere later) should route to.

- [ ] **Step 1: Write the failing test**

  Add to `StudentManagementView.spec.ts`, inside the existing `describe` block, after the `'lists
  students with their section and parent names'` test:

  ```typescript
  it('links each row to that student\'s profile page', async () => {
    const wrapper = await mountView();
    await flushPromises();

    const link = wrapper.find('[data-testid="view-profile-s1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/admin/students/s1');
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `cd staff-console && npx vitest run src/views/StudentManagementView.spec.ts`
  Expected: FAIL — no such link rendered yet.

- [ ] **Step 3: Add the route**

  In `staff-console/src/router/index.ts`, add immediately after the existing `/admin/students`
  route block (found by searching for `name: 'admin-students'`):

  ```typescript
    {
      path: '/admin/students/:id',
      name: 'admin-student-profile',
      component: () => import('../views/StudentProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Student Profile' },
    },
  ```

- [ ] **Step 4: Add the "View Profile" link**

  In `staff-console/src/views/StudentManagementView.vue`, add the import:

  ```typescript
  import { RouterLink } from 'vue-router';
  ```

  In the template, inside the `#actions` slot of the `EntityTable`, add the link as the first
  element of the `v-else` (non-editing) branch, right before the existing "Edit" `Button`:

  ```vue
        <template v-else>
          <RouterLink :data-testid="`view-profile-${item.id}`" :to="`/admin/students/${item.id}`">View Profile</RouterLink>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
  ```

  (leave the rest of that `v-else` block — the "Delete" `Button` — unchanged, and leave the `v-if`
  editing branch above it unchanged).

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx vitest run src/views/StudentManagementView.spec.ts`
  Expected: PASS, all 8 tests (7 original + 1 new).

- [ ] **Step 6: Run the full frontend suite and type-check**

  Run: `npm test && npm run type-check`
  Expected: all pass — this proves `StudentProfilePageView.vue`'s lazy import resolves and every
  view built across Tasks 1-8 is wired together correctly.

- [ ] **Step 7: Commit**

  ```bash
  git add src/router/index.ts src/views/StudentManagementView.vue src/views/StudentManagementView.spec.ts
  git commit -m "feat(student-profile): wire /admin/students/:id route and View Profile link"
  ```

---

### Task 10: Final regression pass

**Files:** none created/modified — verification only.

- [ ] **Step 1: Run the full frontend test suite**

  Run: `cd staff-console && npm test`
  Expected: every test passes — the full pre-existing suite plus every test added in Tasks 1-9.

- [ ] **Step 2: Run typecheck/build**

  Run: `npm run build`
  Expected: `type-check` and `build-only` both succeed with no TypeScript errors.

- [ ] **Step 3: Run lint**

  Run: `npm run lint`
  Expected: no new lint errors introduced by this plan's files.

- [ ] **Step 4: Manually smoke-test one full flow**

  Start the frontend (`npm run dev`) and the backend (`cd ../backend && npm run start:dev`), log in
  as a seeded `SCHOOL_ADMIN`, then:
  1. Go to Students, click "View Profile" on any row — confirm the profile page loads with that
     student's data (or an empty/read-only state if the seed hasn't populated Sub-project 1 fields
     for that student — see the note below).
  2. Click "Edit" on Profile, change the first name, Save — confirm it persists after a page reload.
  3. Add an emergency contact, confirm it appears in the table; edit it in place; delete it with
     confirmation.
  4. Upload a document, confirm it appears as `PENDING`; click Verify, confirm the `StatusPill`
     updates to `VERIFIED` and the Verify/Reject buttons disappear.

  **Note:** as of this plan's writing, `backend/prisma/seed.ts` does not populate any Sub-project 1
  data (no `Address`/`previousSchool`/`emergencyContacts`/`medicalInfo`/`documents`, no `Student`
  identity fields) for any seeded student — every section will render its empty state on a freshly
  seeded student. That's expected, not a bug in this plan; smoke-test by adding data through the new
  UI itself (steps 2-4 above), which is exactly what step 2 does.

- [ ] **Step 5: Update `PROJECT-STATUS.md`**

  Add a new checklist entry under the current sprint section (matching this repo's existing
  convention — see project memory `roadmap-checklist-convention`) noting: staff-console
  `/admin/students/:id` profile page added, covering all 6 Sub-project 1 backend sub-resources;
  `FormField.vue` extended with `textarea`/`email` variants.

- [ ] **Step 6: Commit**

  ```bash
  git add PROJECT-STATUS.md
  git commit -m "docs: log Student Profile UI (Sub-project 1B) in PROJECT-STATUS"
  ```
