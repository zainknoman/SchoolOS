import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CampusProfileView from './CampusProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

const route = vi.hoisted(() => ({ params: { id: 'c1' } as Record<string, string>, query: {} as Record<string, string> }));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
}));
vi.mock('../lib/api', () => ({ api: { listCampuses: vi.fn(), listSchools: vi.fn(), filePreviewUrl: vi.fn(), createCampus: vi.fn() } }));

const CAMPUS = {
  id: 'c1', name: 'Gulistan', schoolId: 's1', schoolName: 'The School', code: 'G', campusType: null, logoFileId: null,
  principalName: null, principalPhone: null, principalEmail: null, openingDate: null, capacity: null, latitude: null,
  longitude: null, status: 'ACTIVE' as const, departments: [], alternatePhone: null, addressId: null, address: null,
  phone: null, email: null, studentCount: 1, staffCount: 1,
};

describe('CampusProfileView role gating', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 't';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([CAMPUS]);
    vi.mocked(api.listSchools).mockResolvedValue([{ id: 's1', name: 'The School' }] as never);
    route.params = { id: 'c1' };
    route.query = {};
  });

  it('offers Edit to a SUPER_ADMIN', async () => {
    useAuthStore().role = 'SUPER_ADMIN';
    const wrapper = mount(CampusProfileView);
    await flushPromises();
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(true);
  });

  it('hides Edit from a SCHOOL_ADMIN and does not call the SUPER_ADMIN-only schools list', async () => {
    useAuthStore().role = 'SCHOOL_ADMIN';
    const wrapper = mount(CampusProfileView);
    await flushPromises();
    expect(wrapper.text()).toContain('Gulistan');
    expect(wrapper.find('[data-testid="edit-profile"]').exists()).toBe(false);
    expect(api.listSchools).not.toHaveBeenCalled();
  });

  it('lets a SCHOOL_ADMIN with zero campuses add the first one, school pre-selected from the session', async () => {
    const auth = useAuthStore();
    auth.role = 'SCHOOL_ADMIN';
    auth.schoolId = 'school-9';
    auth.campusId = null;
    route.params = {};
    vi.mocked(api.listCampuses).mockResolvedValue([]);
    vi.mocked(api.createCampus).mockResolvedValue({ id: 'new' } as never);
    const wrapper = mount(CampusProfileView);
    await flushPromises();

    expect(api.listSchools).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="field-school"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="field-school-readonly"]').text()).toBe('Your school');

    await wrapper.find('[data-testid="field-name"]').setValue('First Campus');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith('t', expect.objectContaining({ schoolId: 'school-9', name: 'First Campus' }));
  });

  it('still gives a SUPER_ADMIN the school picker on Add Campus', async () => {
    useAuthStore().role = 'SUPER_ADMIN';
    route.params = {};
    const wrapper = mount(CampusProfileView);
    await flushPromises();

    expect(api.listSchools).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="field-school"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="field-school-readonly"]').exists()).toBe(false);
  });
});
