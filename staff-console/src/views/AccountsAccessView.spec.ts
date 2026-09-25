import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AccountsAccessView from './AccountsAccessView.vue';
import { useAuthStore } from '../stores/auth';

const listAccountsStaff = vi.fn();
const setStaffGrants = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      listAccountsStaff: (...args: unknown[]) => listAccountsStaff(...args),
      setStaffGrants: (...args: unknown[]) => setStaffGrants(...args),
    },
  };
});

const user = { id: 'u1', identifier: 'fees@school', role: 'ACCOUNTS', disabled: false, lockedUntil: null, grants: [] };

describe('AccountsAccessView (BL-32)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token';
    auth.role = 'SCHOOL_ADMIN';
    listAccountsStaff.mockReset().mockResolvedValue([user]);
    setStaffGrants.mockReset();
  });

  it('lists accounts staff with one checkbox per module, all off by default', async () => {
    const wrapper = mount(AccountsAccessView);
    await flushPromises();
    for (const g of ['ADMISSIONS', 'COMPLAINTS', 'MESSAGES']) {
      const box = wrapper.find(`[data-testid="grant-u1-${g}"]`);
      expect(box.exists()).toBe(true);
      expect((box.element as HTMLInputElement).checked).toBe(false);
    }
  });

  it('ticking a module saves the new grant list and shows it', async () => {
    setStaffGrants.mockResolvedValue({ ...user, grants: ['MESSAGES'] });
    const wrapper = mount(AccountsAccessView);
    await flushPromises();
    await wrapper.find('[data-testid="grant-u1-MESSAGES"]').setValue(true);
    await flushPromises();
    expect(setStaffGrants).toHaveBeenCalledWith('token', 'u1', ['MESSAGES']);
    expect((wrapper.find('[data-testid="grant-u1-MESSAGES"]').element as HTMLInputElement).checked).toBe(true);
  });
});
