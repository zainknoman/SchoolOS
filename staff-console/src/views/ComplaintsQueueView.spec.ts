// staff-console/src/views/ComplaintsQueueView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ComplaintsQueueView from './ComplaintsQueueView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type ComplaintSummary } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminStudents: vi.fn(),
    complaintQueue: vi.fn(),
    getComplaint: vi.fn(),
    complaintAssignees: vi.fn(),
    updateComplaint: vi.fn(),
    addComplaintNote: vi.fn(),
    addComplaintAttachment: vi.fn(),
    createComplaint: vi.fn(),
    filePreviewUrl: vi.fn(() => '#'),
  },
}));

const complaint: ComplaintSummary = {
  id: 'cm1',
  studentId: 's1',
  studentName: 'Eshaal Sample',
  grNumber: 'GR-1001',
  raisedById: 'p1',
  raisedBy: { id: 'p1', role: 'PARENT', name: 'Sample Parent' },
  category: 'TRANSPORT',
  subject: 'Van late',
  description: 'Late every day',
  status: 'open',
  assignedTo: null,
  resolution: null,
  notes: [
    { id: 'n1', body: 'Driver warned', internal: true, author: { id: 't1', role: 'TEACHER', name: 'Teacher' }, createdAt: '2026-09-02T08:00:00.000Z' },
  ],
  attachments: [{ id: 'a1', fileId: 'f1', originalName: 'photo.pdf', createdAt: '2026-09-01T00:00:00.000Z' }],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('ComplaintsQueueView (BL-30)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.complaintQueue).mockResolvedValue([complaint]);
    vi.mocked(api.getComplaint).mockResolvedValue(complaint);
    vi.mocked(api.complaintAssignees).mockResolvedValue([{ id: 't1', role: 'TEACHER', name: 'Teacher One' }]);
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample', sectionName: '3A', className: 'Grade 3', campusName: 'Main', parentNames: [] },
    ]);
  });

  it('loads the queue and filters it', async () => {
    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    expect(api.complaintQueue).toHaveBeenCalledWith('token-1', { status: undefined, category: undefined, assigned: undefined });
    expect(wrapper.text()).toContain('Van late');
    expect(wrapper.text()).toContain('from a parent');

    await wrapper.find('[data-testid="filter-assigned"]').setValue('me');
    await flushPromises();
    expect(api.complaintQueue).toHaveBeenLastCalledWith('token-1', { status: undefined, category: undefined, assigned: 'me' });
  });

  it('opens a complaint, assigns an owner and marks internal notes', async () => {
    vi.mocked(api.updateComplaint).mockResolvedValue({ ...complaint, assignedTo: { id: 't1', role: 'TEACHER', name: 'Teacher One' } });
    const wrapper = mount(ComplaintsQueueView, { attachTo: document.body });
    await flushPromises();
    await wrapper.find('[data-testid="open-cm1"]').trigger('click');
    await flushPromises();

    const detail = document.querySelector('[data-testid="complaint-detail"]')!;
    expect(detail.textContent).toContain('Internal note');
    expect(detail.textContent).toContain('photo.pdf');

    const assignee = document.querySelector('[data-testid="edit-assignee"]') as HTMLSelectElement;
    assignee.value = 't1';
    assignee.dispatchEvent(new Event('change'));
    (document.querySelector('[data-testid="save-complaint"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.updateComplaint).toHaveBeenCalledWith('token-1', 'cm1', { status: 'open', assignedToId: 't1' });
    wrapper.unmount();
  });

  it('will not resolve without a resolution, then resolves with one', async () => {
    vi.mocked(api.updateComplaint).mockResolvedValue({ ...complaint, status: 'resolved', resolution: 'Fixed' });
    const wrapper = mount(ComplaintsQueueView, { attachTo: document.body });
    await flushPromises();
    await wrapper.find('[data-testid="open-cm1"]').trigger('click');
    await flushPromises();

    const status = document.querySelector('[data-testid="edit-status"]') as HTMLSelectElement;
    status.value = 'resolved';
    status.dispatchEvent(new Event('change'));
    (document.querySelector('[data-testid="save-complaint"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.updateComplaint).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="detail-error"]')!.textContent).toContain('resolution');

    const resolution = document.querySelector('[data-testid="edit-resolution"]') as HTMLTextAreaElement;
    resolution.value = 'Fixed';
    resolution.dispatchEvent(new Event('input'));
    (document.querySelector('[data-testid="save-complaint"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.updateComplaint).toHaveBeenCalledWith('token-1', 'cm1', { status: 'resolved', assignedToId: null, resolution: 'Fixed' });
    wrapper.unmount();
  });

  it('sends a reply visible to the parent when "internal" is unticked', async () => {
    vi.mocked(api.addComplaintNote).mockResolvedValue(complaint);
    const wrapper = mount(ComplaintsQueueView, { attachTo: document.body });
    await flushPromises();
    await wrapper.find('[data-testid="open-cm1"]').trigger('click');
    await flushPromises();

    const body = document.querySelector('[data-testid="note-body"]') as HTMLTextAreaElement;
    body.value = 'We are on it';
    body.dispatchEvent(new Event('input'));
    const internal = document.querySelector('[data-testid="note-internal"]') as HTMLInputElement;
    internal.checked = false;
    internal.dispatchEvent(new Event('change'));
    (document.querySelector('[data-testid="add-note"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.addComplaintNote).toHaveBeenCalledWith('token-1', 'cm1', { body: 'We are on it', internal: false });
    wrapper.unmount();
  });

  it('records a staff complaint with a category', async () => {
    vi.mocked(api.createComplaint).mockResolvedValue(undefined);
    const wrapper = mount(ComplaintsQueueView, { attachTo: document.body });
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await flushPromises();
    const set = (id: string, value: string, event = 'input') => {
      const el = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
      el.value = value;
      el.dispatchEvent(new Event(event));
    };
    set('add-student', 's1', 'change');
    set('add-subject', 'Uniform');
    set('add-description', 'Missing badge');
    (document.querySelector('[data-testid="add-submit"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.createComplaint).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      category: 'BEHAVIOUR',
      subject: 'Uniform',
      description: 'Missing badge',
    });
    wrapper.unmount();
  });
});
