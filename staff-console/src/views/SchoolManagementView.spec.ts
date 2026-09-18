import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolManagementView from './SchoolManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    createSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
    uploadFile: vi.fn(),
    filePreviewUrl: vi.fn((_token: string, fileId: string) => `https://files.example/${fileId}`),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

const FULL_SCHOOL = {
  id: 's1',
  name: 'The SchoolOS School',
  code: 'TSS',
  registrationNumber: 'REG-001',
  website: 'https://schoolos.edu.pk',
  logoFileId: 'file-logo-1',
  principalName: 'Dr. Amina Khan',
  principalPhone: '021-555-0001',
  principalEmail: 'principal@schoolos.edu.pk',
  establishedDate: '1998-04-01',
  schoolType: 'K-12',
  educationBoard: 'Cambridge',
  status: 'ACTIVE' as const,
  timezone: 'Asia/Karachi',
  currency: 'PKR',
  alternatePhone: '021-111-9999',
  addressId: null,
  address: '1 Main Rd',
  phone: '021-111',
  email: 'info@schoolos.edu.pk',
  campusCount: 2,
  studentCount: 120,
  staffCount: 15,
};

describe('SchoolManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.filePreviewUrl).mockImplementation((_token: string, fileId: string) => `https://files.example/${fileId}`);
    vi.mocked(api.listSchools).mockResolvedValue([FULL_SCHOOL]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists schools with code/status columns plus address/contact details and live stats', async () => {
    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('The SchoolOS School');
    expect(wrapper.text()).toContain('TSS');
    expect(wrapper.text()).toContain('Active');
    expect(wrapper.text()).toContain('1 Main Rd');
    expect(wrapper.text()).toContain('021-111');
    expect(wrapper.text()).toContain('120');
    expect(wrapper.text()).toContain('15');
  });

  it('creates a new school through the Add modal with all the new profile fields', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    await wrapper.find('[data-testid="field-name"]').setValue('Second School');
    await wrapper.find('[data-testid="field-code"]').setValue('SS2');
    await wrapper.find('[data-testid="field-status"]').setValue('INACTIVE');
    await wrapper.find('[data-testid="field-address"]').setValue('2 Second Rd');
    await wrapper.find('[data-testid="field-phone"]').setValue('021-222');
    await wrapper.find('[data-testid="field-alternate-phone"]').setValue('021-223');
    await wrapper.find('[data-testid="field-email"]').setValue('second@schoolos.edu.pk');
    await wrapper.find('[data-testid="field-website"]').setValue('https://second.edu.pk');
    await wrapper.find('[data-testid="field-principal-name"]').setValue('Mr. Bilal');
    await wrapper.find('[data-testid="field-principal-phone"]').setValue('021-224');
    await wrapper.find('[data-testid="field-principal-email"]').setValue('bilal@second.edu.pk');
    await wrapper.find('[data-testid="field-registration-number"]').setValue('REG-002');
    await wrapper.find('[data-testid="field-established-date"]').setValue('2005-06-01');
    await wrapper.find('[data-testid="field-school-type"]').setValue('Primary');
    await wrapper.find('[data-testid="field-education-board"]').setValue('Matric');
    await wrapper.find('[data-testid="field-timezone"]').setValue('Asia/Karachi');
    await wrapper.find('[data-testid="field-currency"]').setValue('PKR');

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith('token-1', {
      name: 'Second School',
      code: 'SS2',
      registrationNumber: 'REG-002',
      website: 'https://second.edu.pk',
      logoFileId: undefined,
      principalName: 'Mr. Bilal',
      principalPhone: '021-224',
      principalEmail: 'bilal@second.edu.pk',
      establishedDate: '2005-06-01',
      schoolType: 'Primary',
      educationBoard: 'Matric',
      status: 'INACTIVE',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      alternatePhone: '021-223',
      address: '2 Second Rd',
      phone: '021-222',
      email: 'second@schoolos.edu.pk',
    });
    expect(api.listSchools).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('uploads a logo file on selection and submits the returned file id as logoFileId', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'uploaded-file-9' });

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-name"]').setValue('Logo School');

    const file = new File(['logo-bytes'], 'logo.png', { type: 'image/png' });
    const input = wrapper.find('[data-testid="field-logo-input"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await flushPromises();

    expect(api.uploadFile).toHaveBeenCalledWith('token-1', file);

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ logoFileId: 'uploaded-file-9' }),
    );
  });

  it('opens the Edit modal pre-filled with the row data and submits every field to api.updateSchool', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');

    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('The SchoolOS School');
    expect((wrapper.find('[data-testid="field-code"]').element as HTMLInputElement).value).toBe('TSS');
    expect((wrapper.find('[data-testid="field-status"]').element as HTMLSelectElement).value).toBe('ACTIVE');
    expect((wrapper.find('[data-testid="field-address"]').element as HTMLInputElement).value).toBe('1 Main Rd');
    expect((wrapper.find('[data-testid="field-phone"]').element as HTMLInputElement).value).toBe('021-111');
    expect((wrapper.find('[data-testid="field-alternate-phone"]').element as HTMLInputElement).value).toBe('021-111-9999');
    expect((wrapper.find('[data-testid="field-email"]').element as HTMLInputElement).value).toBe('info@schoolos.edu.pk');
    expect((wrapper.find('[data-testid="field-website"]').element as HTMLInputElement).value).toBe('https://schoolos.edu.pk');
    expect((wrapper.find('[data-testid="field-principal-name"]').element as HTMLInputElement).value).toBe('Dr. Amina Khan');
    expect((wrapper.find('[data-testid="field-registration-number"]').element as HTMLInputElement).value).toBe('REG-001');
    expect((wrapper.find('[data-testid="field-established-date"]').element as HTMLInputElement).value).toBe('1998-04-01');
    expect((wrapper.find('[data-testid="field-school-type"]').element as HTMLInputElement).value).toBe('K-12');
    expect((wrapper.find('[data-testid="field-education-board"]').element as HTMLInputElement).value).toBe('Cambridge');
    expect((wrapper.find('[data-testid="field-timezone"]').element as HTMLInputElement).value).toBe('Asia/Karachi');
    expect((wrapper.find('[data-testid="field-currency"]').element as HTMLInputElement).value).toBe('PKR');

    await wrapper.find('[data-testid="field-name"]').setValue('Renamed School');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(api.updateSchool).toHaveBeenCalledWith('token-1', 's1', {
      name: 'Renamed School',
      code: 'TSS',
      registrationNumber: 'REG-001',
      website: 'https://schoolos.edu.pk',
      logoFileId: 'file-logo-1',
      principalName: 'Dr. Amina Khan',
      principalPhone: '021-555-0001',
      principalEmail: 'principal@schoolos.edu.pk',
      establishedDate: '1998-04-01',
      schoolType: 'K-12',
      educationBoard: 'Cambridge',
      status: 'ACTIVE',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      alternatePhone: '021-111-9999',
      address: '1 Main Rd',
      phone: '021-111',
      email: 'info@schoolos.edu.pk',
    });
  });

  it('pre-fills the Edit modal without crashing when optional fields are null', async () => {
    vi.mocked(api.listSchools).mockResolvedValue([
      {
        id: 's2',
        name: 'Bare School',
        code: null,
        registrationNumber: null,
        website: null,
        logoFileId: null,
        principalName: null,
        principalPhone: null,
        principalEmail: null,
        establishedDate: null,
        schoolType: null,
        educationBoard: null,
        status: 'ACTIVE',
        timezone: null,
        currency: null,
        alternatePhone: null,
        addressId: null,
        address: null,
        phone: null,
        email: null,
        campusCount: 0,
        studentCount: 0,
        staffCount: 0,
      },
    ]);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s2"]').trigger('click');

    expect((wrapper.find('[data-testid="field-name"]').element as HTMLInputElement).value).toBe('Bare School');
    expect((wrapper.find('[data-testid="field-code"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('[data-testid="field-address"]').element as HTMLInputElement).value).toBe('');
  });

  it('deletes a school after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSchool).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).toHaveBeenCalledWith('token-1', 's1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this school?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteSchool).mockRejectedValue(new Error('Cannot delete this School: other records still reference it.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this School');
  });

  it('shows the backend error banner when creating a school fails', async () => {
    vi.mocked(api.createSchool).mockRejectedValue(new Error('A school with this code already exists.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="field-name"]').setValue('Duplicate School');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('A school with this code already exists.');
  });

  it('shows the backend error banner when updating a school fails', async () => {
    vi.mocked(api.updateSchool).mockRejectedValue(new Error('Could not update this school.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="save-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Could not update this school.');
  });
});
