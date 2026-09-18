import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CampusManagementView from './CampusManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    listCampuses: vi.fn(),
    createCampus: vi.fn(),
    updateCampus: vi.fn(),
    deleteCampus: vi.fn(),
    uploadFile: vi.fn(),
    filePreviewUrl: vi.fn((_token: string, fileId: string) => `https://files.example/${fileId}`),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

const FULL_CAMPUS = {
  id: 'c1',
  name: 'Gulistan-e-Jauhar',
  schoolId: 's1',
  schoolName: 'The SchoolOS School',
  code: 'GEJ',
  campusType: 'Main',
  logoFileId: 'file-logo-1',
  principalName: 'Ms. Sara',
  principalPhone: '021-777-0001',
  principalEmail: 'sara@schoolos.edu.pk',
  openingDate: '2010-08-15',
  capacity: 500,
  latitude: 24.9056,
  longitude: 67.0822,
  status: 'ACTIVE' as const,
  departments: ['Science', 'Admin'],
  alternatePhone: '021-333-9999',
  addressId: null,
  address: '10 Campus Rd',
  phone: '021-333',
  email: 'gej@schoolos.edu.pk',
  studentCount: 60,
  staffCount: 8,
};

describe('CampusManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.filePreviewUrl).mockImplementation((_token: string, fileId: string) => `https://files.example/${fileId}`);
    vi.mocked(api.listSchools).mockResolvedValue([
      { id: 's1', name: 'The SchoolOS School', code: null, registrationNumber: null, website: null, logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, establishedDate: null, schoolType: null, educationBoard: null, status: 'ACTIVE' as const, timezone: null, currency: null, alternatePhone: null, addressId: null, address: null, phone: null, email: null, campusCount: 1, studentCount: 0, staffCount: 0 },
    ]);
    vi.mocked(api.listCampuses).mockResolvedValue([FULL_CAMPUS]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists campuses with code/status/type columns plus school, address/contact details and live stats', async () => {
    const wrapper = mount(CampusManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Gulistan-e-Jauhar');
    expect(wrapper.text()).toContain('GEJ');
    expect(wrapper.text()).toContain('Active');
    expect(wrapper.text()).toContain('Main');
    expect(wrapper.text()).toContain('The SchoolOS School');
    expect(wrapper.text()).toContain('10 Campus Rd');
    expect(wrapper.text()).toContain('021-333');
    expect(wrapper.text()).toContain('60');
    expect(wrapper.text()).toContain('8');
  });

  it('creates a new campus through the Add modal with all the new profile fields', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-name"]').setValue('Gulshan-e-Iqbal');
    await wrapper.find('[data-testid="field-code"]').setValue('GI2');
    await wrapper.find('[data-testid="field-campus-type"]').setValue('Branch');
    await wrapper.find('[data-testid="field-status"]').setValue('INACTIVE');
    await wrapper.find('[data-testid="field-address"]').setValue('20 New Rd');
    await wrapper.find('[data-testid="field-phone"]').setValue('021-444');
    await wrapper.find('[data-testid="field-alternate-phone"]').setValue('021-445');
    await wrapper.find('[data-testid="field-email"]').setValue('gulshan@schoolos.edu.pk');
    await wrapper.find('[data-testid="field-principal-name"]').setValue('Mr. Tariq');
    await wrapper.find('[data-testid="field-principal-phone"]').setValue('021-446');
    await wrapper.find('[data-testid="field-principal-email"]').setValue('tariq@schoolos.edu.pk');
    await wrapper.find('[data-testid="field-latitude"]').setValue('24.8');
    await wrapper.find('[data-testid="field-longitude"]').setValue('67.1');
    await wrapper.find('[data-testid="field-capacity"]').setValue('300');
    await wrapper.find('[data-testid="field-opening-date"]').setValue('2020-01-01');
    await wrapper.find('[data-testid="field-departments"]').setValue('Science, Admin,  IT');

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith('token-1', {
      schoolId: 's1',
      name: 'Gulshan-e-Iqbal',
      code: 'GI2',
      campusType: 'Branch',
      logoFileId: undefined,
      principalName: 'Mr. Tariq',
      principalPhone: '021-446',
      principalEmail: 'tariq@schoolos.edu.pk',
      openingDate: '2020-01-01',
      capacity: 300,
      latitude: 24.8,
      longitude: 67.1,
      status: 'INACTIVE',
      departments: ['Science', 'Admin', 'IT'],
      alternatePhone: '021-445',
      address: '20 New Rd',
      phone: '021-444',
      email: 'gulshan@schoolos.edu.pk',
    });
    expect(api.listCampuses).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('uploads a logo file on selection and submits the returned file id as logoFileId', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'uploaded-file-9' });

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-name"]').setValue('Logo Campus');

    const file = new File(['logo-bytes'], 'logo.png', { type: 'image/png' });
    const input = wrapper.find('[data-testid="field-logo-input"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ logoFileId: 'uploaded-file-9' }),
    );
  });

  it('opens the Edit modal pre-filled with the row data (school is not editable) and submits every field to api.updateCampus, excluding schoolId', async () => {
    vi.mocked(api.updateCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-c1"]').trigger('click');

    expect(wrapper.find('[data-testid="field-school"]').exists()).toBe(false);
    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('Gulistan-e-Jauhar');
    expect((wrapper.find('[data-testid="field-code"]').element as HTMLInputElement).value).toBe('GEJ');
    expect((wrapper.find('[data-testid="field-campus-type"]').element as HTMLInputElement).value).toBe('Main');
    expect((wrapper.find('[data-testid="field-status"]').element as HTMLSelectElement).value).toBe('ACTIVE');
    expect((wrapper.find('[data-testid="field-address"]').element as HTMLInputElement).value).toBe('10 Campus Rd');
    expect((wrapper.find('[data-testid="field-phone"]').element as HTMLInputElement).value).toBe('021-333');
    expect((wrapper.find('[data-testid="field-alternate-phone"]').element as HTMLInputElement).value).toBe('021-333-9999');
    expect((wrapper.find('[data-testid="field-email"]').element as HTMLInputElement).value).toBe('gej@schoolos.edu.pk');
    expect((wrapper.find('[data-testid="field-principal-name"]').element as HTMLInputElement).value).toBe('Ms. Sara');
    expect((wrapper.find('[data-testid="field-principal-phone"]').element as HTMLInputElement).value).toBe('021-777-0001');
    expect((wrapper.find('[data-testid="field-principal-email"]').element as HTMLInputElement).value).toBe('sara@schoolos.edu.pk');
    expect((wrapper.find('[data-testid="field-latitude"]').element as HTMLInputElement).value).toBe('24.9056');
    expect((wrapper.find('[data-testid="field-longitude"]').element as HTMLInputElement).value).toBe('67.0822');
    expect((wrapper.find('[data-testid="field-capacity"]').element as HTMLInputElement).value).toBe('500');
    expect((wrapper.find('[data-testid="field-opening-date"]').element as HTMLInputElement).value).toBe('2010-08-15');
    expect((wrapper.find('[data-testid="field-departments"]').element as HTMLInputElement).value).toBe('Science, Admin');

    await wrapper.find('[data-testid="field-name"]').setValue('Gulistan-e-Jauhar (Main)');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(api.updateCampus).toHaveBeenCalledWith('token-1', 'c1', {
      name: 'Gulistan-e-Jauhar (Main)',
      code: 'GEJ',
      campusType: 'Main',
      logoFileId: 'file-logo-1',
      principalName: 'Ms. Sara',
      principalPhone: '021-777-0001',
      principalEmail: 'sara@schoolos.edu.pk',
      openingDate: '2010-08-15',
      capacity: 500,
      latitude: 24.9056,
      longitude: 67.0822,
      status: 'ACTIVE',
      departments: ['Science', 'Admin'],
      alternatePhone: '021-333-9999',
      address: '10 Campus Rd',
      phone: '021-333',
      email: 'gej@schoolos.edu.pk',
    });
    expect(api.updateCampus).not.toHaveBeenCalledWith('token-1', 'c1', expect.objectContaining({ schoolId: expect.anything() }));
  });

  it('round-trips the comma-separated departments field: typing "Science, Admin,  IT" submits departments as a trimmed array', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-name"]').setValue('Departments Campus');
    await wrapper.find('[data-testid="field-departments"]').setValue('Science, Admin,  IT');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ departments: ['Science', 'Admin', 'IT'] }),
    );
  });

  it('does not send an empty departments array when the field is left blank or has trailing commas/spaces', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-name"]').setValue('No Departments Campus');
    await wrapper.find('[data-testid="field-departments"]').setValue('Science, ');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ departments: ['Science'] }),
    );
  });

  it('pre-fills the Edit modal without crashing when optional fields are null', async () => {
    vi.mocked(api.listCampuses).mockResolvedValue([
      {
        id: 'c2',
        name: 'Bare Campus',
        schoolId: 's1',
        schoolName: 'The SchoolOS School',
        code: null,
        campusType: null,
        logoFileId: null,
        principalName: null,
        principalPhone: null,
        principalEmail: null,
        openingDate: null,
        capacity: null,
        latitude: null,
        longitude: null,
        status: 'ACTIVE',
        departments: [],
        alternatePhone: null,
        addressId: null,
        address: null,
        phone: null,
        email: null,
        studentCount: 0,
        staffCount: 0,
      },
    ]);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-c2"]').trigger('click');

    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('Bare Campus');
    expect((wrapper.find('[data-testid="field-code"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('[data-testid="field-address"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('[data-testid="field-departments"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('[data-testid="field-capacity"]').element as HTMLInputElement).value).toBe('');
  });

  it('deletes a campus after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteCampus).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).toHaveBeenCalledWith('token-1', 'c1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this campus?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteCampus).mockRejectedValue(new Error('Cannot delete this Campus: other records still reference it.'));

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Campus');
  });

  it('shows the backend error banner when creating a campus fails', async () => {
    vi.mocked(api.createCampus).mockRejectedValue(new Error('A campus with this code already exists.'));

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-school"]').setValue('s1');
    await wrapper.find('[data-testid="field-name"]').setValue('Duplicate Campus');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('A campus with this code already exists.');
  });

  it('shows the backend error banner when updating a campus fails', async () => {
    vi.mocked(api.updateCampus).mockRejectedValue(new Error('Could not update this campus.'));

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-c1"]').trigger('click');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Could not update this campus.');
  });
});
