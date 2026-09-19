import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolProfileView from './SchoolProfileView.vue';
import CampusProfileView from './CampusProfileView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';

const push = vi.hoisted(() => vi.fn());
const routeState = vi.hoisted(() => ({ params: {} as Record<string, string>, query: {} as Record<string, string> }));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => routeState,
  useRouter: () => ({ push }),
}));
vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(), listCampuses: vi.fn(), createSchool: vi.fn(), updateSchool: vi.fn(),
    createCampus: vi.fn(), updateCampus: vi.fn(), uploadFile: vi.fn(),
    filePreviewUrl: vi.fn((_t: string, id: string) => `https://files.example/${id}`),
  },
}));

const SCHOOL: SchoolSummary = {
  id: 's1', name: 'The SchoolOS School', code: 'TSS', registrationNumber: 'REG-001', website: null, logoFileId: null,
  principalName: 'Dr. Amina Khan', principalPhone: null, principalEmail: null, establishedDate: '1998-04-01T00:00:00.000Z',
  schoolType: 'K-12', educationBoard: 'Cambridge', status: 'ACTIVE', timezone: 'Asia/Karachi', currency: 'PKR',
  alternatePhone: null, addressId: null, address: '1 Main Rd', phone: '021-111', email: null,
  campusCount: 1, studentCount: 120, staffCount: 15,
};
const CAMPUS: CampusSummary = {
  id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The SchoolOS School', code: 'GEJ', campusType: 'Main',
  logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, openingDate: null,
  capacity: 600, latitude: null, longitude: null, status: 'ACTIVE', departments: ['Primary'],
  alternatePhone: null, addressId: null, address: '10 Campus Rd', phone: null, email: null, studentCount: 60, staffCount: 8,
};

const mountOpts = { global: { stubs: { RouterLink: RouterLinkStub } } };

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().accessToken = 'token-1';
  Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
  vi.mocked(api.filePreviewUrl).mockImplementation((_t: string, id: string) => `https://files.example/${id}`);
  vi.mocked(api.listSchools).mockResolvedValue([SCHOOL]);
  vi.mocked(api.listCampuses).mockResolvedValue([CAMPUS]);
  push.mockReset();
  routeState.params = {};
  routeState.query = {};
});

describe('School profile — add and edit on the profile screen', () => {
  it('adds a school from /admin/schools/new (no :id) and returns to the list', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.find('[data-testid="add-submit"]').attributes('disabled')).toBeDefined();
    await wrapper.find('[data-testid="field-name"]').setValue('Second School');
    await wrapper.find('[data-testid="field-code"]').setValue('SS2');
    await wrapper.find('[data-testid="field-status"]').setValue('INACTIVE');
    await wrapper.find('[data-testid="field-principal-name"]').setValue('Mr. Bilal');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ name: 'Second School', code: 'SS2', status: 'INACTIVE', principalName: 'Mr. Bilal' }),
    );
    expect(push).toHaveBeenCalledWith('/admin/schools');
  });

  it('edits in place: Edit reveals a pre-filled form, Save calls updateSchool and returns to the read-only view', async () => {
    routeState.params = { id: 's1' };
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-profile"]').trigger('click');

    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('The SchoolOS School');
    expect((wrapper.find('[data-testid="field-established-date"]').element as HTMLInputElement).value).toBe('1998-04-01');

    await wrapper.find('[data-testid="field-name"]').setValue('Renamed School');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(api.updateSchool).toHaveBeenCalledWith('token-1', 's1', expect.objectContaining({ name: 'Renamed School' }));
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('opens straight into edit mode with ?edit=1, and Cancel leaves without saving', async () => {
    routeState.params = { id: 's1' };
    routeState.query = { edit: '1' };
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(true);
    await wrapper.find('[data-testid="cancel-edit"]').trigger('click');
    expect(api.updateSchool).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('uploads a logo on selection and submits the returned file id', async () => {
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'file-9' } as never);
    vi.mocked(api.createSchool).mockResolvedValue(undefined);
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const input = wrapper.find('[data-testid="field-logo-input"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'logo.png', { type: 'image/png' })] });
    await input.trigger('change');
    await flushPromises();
    await wrapper.find('[data-testid="field-name"]').setValue('Logo School');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith('token-1', expect.objectContaining({ logoFileId: 'file-9' }));
  });

  it('shows the backend error banner when saving fails', async () => {
    vi.mocked(api.createSchool).mockRejectedValue(new Error('A school with this code already exists.'));
    const wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();

    await wrapper.find('[data-testid="field-name"]').setValue('Duplicate');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('A school with this code already exists.');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('Campus profile — add and edit on the profile screen', () => {
  it('adds a campus from /admin/campuses/new: needs a school, then returns to the list', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);
    const wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();

    await wrapper.find('[data-testid="field-name"]').setValue('New Campus');
    expect(wrapper.find('[data-testid="add-submit"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-code"]').setValue('NC');
    await wrapper.find('[data-testid="field-capacity"]').setValue('300');
    await wrapper.find('[data-testid="field-departments"]').setValue('Science, Admin,  IT');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ schoolId: 's1', name: 'New Campus', code: 'NC', capacity: 300, departments: ['Science', 'Admin', 'IT'] }),
    );
    expect(push).toHaveBeenCalledWith('/admin/campuses');
  });

  it('edits in place without a school field, and never sends schoolId or an empty departments array', async () => {
    routeState.params = { id: 'c1' };
    vi.mocked(api.updateCampus).mockResolvedValue(undefined);
    const wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();

    await wrapper.find('[data-testid="edit-profile"]').trigger('click');
    expect(wrapper.find('[data-testid="field-school"]').exists()).toBe(false);
    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('Gulistan-e-Jauhar');

    await wrapper.find('[data-testid="field-departments"]').setValue(' , ');
    await wrapper.find('[data-testid="field-name"]').setValue('Renamed Campus');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    const payload = vi.mocked(api.updateCampus).mock.calls[0]![2] as Record<string, unknown>;
    expect(payload.name).toBe('Renamed Campus');
    expect(payload.departments).toBeUndefined();
    expect(payload).not.toHaveProperty('schoolId');
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('shows the backend error banner when updating fails and stays in edit mode', async () => {
    routeState.params = { id: 'c1' };
    routeState.query = { edit: '1' };
    vi.mocked(api.updateCampus).mockRejectedValue(new Error('Capacity must be positive.'));
    const wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();

    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Capacity must be positive.');
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(true);
  });
});

describe('Profile header logo', () => {
  it('school: shows the uploaded logo when one exists, initials when not', async () => {
    routeState.params = { id: 's1' };
    vi.mocked(api.listSchools).mockResolvedValue([{ ...SCHOOL, logoFileId: 'file-1' }]);
    let wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-logo"]').attributes('src')).toBe('https://files.example/file-1');

    vi.mocked(api.listSchools).mockResolvedValue([SCHOOL]);
    wrapper = mount(SchoolProfileView, mountOpts);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-logo"]').exists()).toBe(false);
    expect(wrapper.find('.org-avatar').text()).toBe('TS');
  });

  it('campus: shows the uploaded logo when one exists, initials when not', async () => {
    routeState.params = { id: 'c1' };
    vi.mocked(api.listCampuses).mockResolvedValue([{ ...CAMPUS, logoFileId: 'file-2' }]);
    let wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-logo"]').attributes('src')).toBe('https://files.example/file-2');

    vi.mocked(api.listCampuses).mockResolvedValue([CAMPUS]);
    wrapper = mount(CampusProfileView, mountOpts);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-logo"]').exists()).toBe(false);
    expect(wrapper.find('.org-avatar').text()).toBe('GU');
  });
});
