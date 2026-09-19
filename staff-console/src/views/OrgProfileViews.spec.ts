import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolProfileView from './SchoolProfileView.vue';
import CampusProfileView from './CampusProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ params: { id: mockRouteId.value } }),
}));
const mockRouteId = vi.hoisted(() => ({ value: 's1' }));

vi.mock('../lib/api', () => ({ api: { listSchools: vi.fn(), listCampuses: vi.fn() } }));

const SCHOOL: SchoolSummary = {
  id: 's1', name: 'The SchoolOS School', code: 'TSS', registrationNumber: 'REG-001', website: null, logoFileId: null,
  principalName: 'Dr. Amina Khan', principalPhone: null, principalEmail: null, establishedDate: '1998-04-01',
  schoolType: 'K-12', educationBoard: 'Cambridge', status: 'ACTIVE', timezone: 'Asia/Karachi', currency: 'PKR',
  alternatePhone: null, addressId: null, address: '1 Main Rd', phone: '021-111', email: null,
  campusCount: 1, studentCount: 120, staffCount: 15,
};
const CAMPUS: CampusSummary = {
  id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The SchoolOS School', code: 'GEJ', campusType: 'Main',
  logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, openingDate: '2010-08-01',
  capacity: 600, latitude: null, longitude: null, status: 'INACTIVE', departments: ['Primary', 'Secondary'],
  alternatePhone: null, addressId: null, address: '10 Campus Rd', phone: null, email: null, studentCount: 60, staffCount: 8,
};

const mountOpts = { global: { stubs: { RouterLink: RouterLinkStub } } };

describe('School / Campus profile pages', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    useAuthStore().role = 'SUPER_ADMIN';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSchools).mockResolvedValue([SCHOOL]);
    vi.mocked(api.listCampuses).mockResolvedValue([CAMPUS]);
  });

  it('school profile shows overview, stats and links to its campuses', async () => {
    mockRouteId.value = 's1';
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.find('[data-testid="profile-name"]').text()).toBe('The SchoolOS School');
    expect(wrapper.text()).toContain('REG-001');
    expect(wrapper.text()).toContain('Cambridge');
    expect(wrapper.text()).toContain('120');
    expect(wrapper.findComponent<typeof RouterLinkStub>('[data-testid="campus-link-c1"]').props('to')).toBe('/admin/campuses/c1');
  });

  it('school profile reports an unknown school', async () => {
    mockRouteId.value = 'missing';
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.text()).toContain('School not found.');
  });

  it('campus profile shows details, an inactive status and a link back to its school', async () => {
    mockRouteId.value = 'c1';
    const wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.find('[data-testid="profile-name"]').text()).toBe('Gulistan-e-Jauhar');
    expect(wrapper.text()).toContain('Inactive');
    expect(wrapper.text()).toContain('Primary, Secondary');
    expect(wrapper.text()).toContain('600');
    expect(wrapper.findComponent<typeof RouterLinkStub>('[data-testid="school-link"]').props('to')).toBe('/admin/schools/s1');
  });
});
