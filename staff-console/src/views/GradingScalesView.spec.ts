import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import GradingScalesView from './GradingScalesView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type GradingScale } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listGradingScales: vi.fn(),
    listSchools: vi.fn(),
    createGradingScale: vi.fn(),
    updateGradingScale: vi.fn(),
    deleteGradingScale: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));

const scale = (over: Partial<GradingScale> = {}): GradingScale => ({
  id: 'g1',
  schoolId: 'a',
  name: 'Standard',
  isDefault: true,
  bands: [
    { minPercent: 80, letter: 'A', remark: 'Very good', gradePoint: 4 },
    { minPercent: 0, letter: 'F', remark: null, gradePoint: null },
  ],
  updatedAt: '',
  ...over,
});

function setRole(role: string) {
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  auth.role = role as never;
}

describe('GradingScalesView (BL-27)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.listGradingScales).mockReset().mockResolvedValue([]);
    vi.mocked(api.listSchools).mockReset().mockResolvedValue([{ id: 'a', name: 'School A' } as never]);
    vi.mocked(api.createGradingScale).mockReset().mockResolvedValue(scale());
    vi.mocked(api.updateGradingScale).mockReset().mockResolvedValue(scale());
    vi.mocked(api.deleteGradingScale).mockReset().mockResolvedValue(undefined);
  });

  it('starts a new scale from a sensible default and saves it as the first (default) scale', async () => {
    setRole('SCHOOL_ADMIN');
    const wrapper = mount(GradingScalesView);
    await flushPromises();
    expect(wrapper.text()).toContain('No grading scale yet');
    await wrapper.find('[data-testid="scale-new"]').trigger('click');
    await wrapper.find('[data-testid="scale-name"]').setValue('Standard');
    await wrapper.find('[data-testid="scale-save"]').trigger('click');
    await flushPromises();
    const call = vi.mocked(api.createGradingScale).mock.calls[0];
    expect(call?.[1]).toMatchObject({ name: 'Standard', isDefault: true });
    expect(call?.[1].bands.at(-1)).toEqual({ minPercent: 0, letter: 'F', remark: 'Needs improvement', gradePoint: 0 });
    expect(call?.[1]).not.toHaveProperty('schoolId');
  });

  it('refuses to send a band without a letter', async () => {
    setRole('SCHOOL_ADMIN');
    const wrapper = mount(GradingScalesView);
    await flushPromises();
    await wrapper.find('[data-testid="scale-new"]').trigger('click');
    await wrapper.find('[data-testid="scale-name"]').setValue('X');
    await wrapper.find('[data-testid="band-add"]').trigger('click');
    await wrapper.find('[data-testid="scale-save"]').trigger('click');
    await flushPromises();
    expect(api.createGradingScale).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('every band a minimum % and a letter');
  });

  it('lists scales with their bands, edits one and makes another the default', async () => {
    setRole('SCHOOL_ADMIN');
    vi.mocked(api.listGradingScales).mockResolvedValue([scale(), scale({ id: 'g2', name: 'Lenient', isDefault: false })]);
    const wrapper = mount(GradingScalesView);
    await flushPromises();
    expect(wrapper.find('[data-testid="scale-g1"]').text()).toContain('≥ 80%');
    expect(wrapper.findAll('[data-testid="scale-default-badge"]')).toHaveLength(1);

    await wrapper.find('[data-testid="scale-make-default-g2"]').trigger('click');
    await flushPromises();
    expect(api.updateGradingScale).toHaveBeenCalledWith('token-1', 'g2', { isDefault: true });

    await wrapper.find('[data-testid="scale-edit-g1"]').trigger('click');
    await wrapper.find('[data-testid="band-letter-0"]').setValue('A+');
    await wrapper.find('[data-testid="scale-save"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(api.updateGradingScale).mock.calls[1]?.[2]).toMatchObject({
      name: 'Standard',
      isDefault: true,
      bands: [
        { minPercent: 80, letter: 'A+', remark: 'Very good', gradePoint: 4 },
        { minPercent: 0, letter: 'F', remark: null, gradePoint: null },
      ],
    });
  });

  it('a super admin picks the school first and the new scale goes to it', async () => {
    setRole('SUPER_ADMIN');
    const wrapper = mount(GradingScalesView);
    await flushPromises();
    expect((wrapper.find('[data-testid="scale-new"]').element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.find('[data-testid="scale-school"]').setValue('a');
    await wrapper.find('[data-testid="scale-new"]').trigger('click');
    await wrapper.find('[data-testid="scale-name"]').setValue('Standard');
    await wrapper.find('[data-testid="scale-save"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(api.createGradingScale).mock.calls[0]?.[1]).toMatchObject({ schoolId: 'a' });
  });
});
