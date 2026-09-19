import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChangePasswordView from './ChangePasswordView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('../lib/api', () => ({ api: { changePassword: vi.fn() } }));

async function fill(wrapper: ReturnType<typeof mount>, current: string, next: string, confirm: string) {
  await wrapper.find('[data-testid="current-password"]').setValue(current);
  await wrapper.find('[data-testid="new-password"]').setValue(next);
  await wrapper.find('[data-testid="confirm-password"]').setValue(confirm);
  await wrapper.find('form').trigger('submit');
  await flushPromises();
}

describe('ChangePasswordView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    useAuthStore().accessToken = 'tok';
    push.mockReset();
    vi.mocked(api.changePassword).mockReset();
  });

  it('blocks submit when the new password is shorter than 8 characters or the confirmation differs', async () => {
    const wrapper = mount(ChangePasswordView);
    await fill(wrapper, 'Temp1234!x', 'short', 'short');
    expect(api.changePassword).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    await fill(wrapper, 'Temp1234!x', 'LongEnough1!', 'Different1!');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password, stores the fresh session and goes home', async () => {
    vi.mocked(api.changePassword).mockResolvedValue({
      accessToken: 'a2', refreshToken: 'r2', role: 'SCHOOL_ADMIN', isPrincipal: true, mustChangePassword: false, campusId: null,
    });
    const wrapper = mount(ChangePasswordView);
    await fill(wrapper, 'Temp1234!x', 'BrandNew123!', 'BrandNew123!');

    expect(api.changePassword).toHaveBeenCalledWith('tok', { currentPassword: 'Temp1234!x', newPassword: 'BrandNew123!' });
    expect(useAuthStore().mustChangePassword).toBe(false);
    expect(useAuthStore().accessToken).toBe('a2');
    expect(push).toHaveBeenCalled();
  });

  it('shows the API error and does not navigate on failure', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new Error('Current password is incorrect'));
    const wrapper = mount(ChangePasswordView);
    await fill(wrapper, 'wrong', 'BrandNew123!', 'BrandNew123!');
    expect(wrapper.find('[role="alert"]').text()).toContain('Current password is incorrect');
    expect(push).not.toHaveBeenCalled();
  });
});
