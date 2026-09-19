import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CredentialsPanel from './CredentialsPanel.vue';

afterEach(() => vi.unstubAllGlobals());

describe('CredentialsPanel', () => {
  it('shows identifier, temporary password, copy button and the one-time warning', () => {
    const w = mount(CredentialsPanel, { props: { login: { identifier: 'a@b.test', temporaryPassword: 'abc123' } } });
    expect(w.text()).toContain('a@b.test');
    expect(w.text()).toContain('abc123');
    expect(w.text()).toContain('shown only once');
    expect(w.find('[data-testid="copy-credentials"]').exists()).toBe(true);
  });

  it('copies "identifier / password" to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const w = mount(CredentialsPanel, { props: { login: { identifier: 'a@b.test', temporaryPassword: 'abc123' } } });
    await w.find('[data-testid="copy-credentials"]').trigger('click');
    expect(writeText).toHaveBeenCalledWith('a@b.test / abc123');
  });

  it('does not throw when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const w = mount(CredentialsPanel, { props: { login: { identifier: 'a@b.test', temporaryPassword: 'abc123' } } });
    await w.find('[data-testid="copy-credentials"]').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('abc123');
  });

  it('with a null temporary password shows the identifier and says the password is the one entered', () => {
    const w = mount(CredentialsPanel, { props: { login: { identifier: 'a@b.test', temporaryPassword: null } } });
    expect(w.text()).toContain('a@b.test');
    expect(w.text()).toContain('the password you entered');
    expect(w.find('[data-testid="copy-credentials"]').exists()).toBe(false);
  });

  it('emits done when Done is clicked', async () => {
    const w = mount(CredentialsPanel, { props: { login: { identifier: 'a@b.test', temporaryPassword: null } } });
    await w.find('[data-testid="credentials-done"]').trigger('click');
    expect(w.emitted('done')).toHaveLength(1);
  });
});
