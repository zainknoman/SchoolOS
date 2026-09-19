import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProvisionLoginFields from './ProvisionLoginFields.vue';

const base = { enabled: false, identifier: '', password: '' };

describe('ProvisionLoginFields', () => {
  it('shows only the checkbox while disabled', () => {
    const w = mount(ProvisionLoginFields, { props: { modelValue: base, label: 'Create a login for this principal' } });
    expect(w.find('input[type="checkbox"]').exists()).toBe(true);
    expect(w.text()).toContain('Create a login for this principal');
    expect(w.find('[data-testid="login-identifier"]').exists()).toBe(false);
    expect(w.find('[data-testid="login-password"]').exists()).toBe(false);
  });

  it('emits update:modelValue when ticked', async () => {
    const w = mount(ProvisionLoginFields, { props: { modelValue: base, label: 'Login' } });
    await w.find('input[type="checkbox"]').setValue(true);
    expect(w.emitted('update:modelValue')![0]![0]).toEqual({ ...base, enabled: true });
  });

  it('reveals identifier and password inputs when enabled and emits on change', async () => {
    const w = mount(ProvisionLoginFields, { props: { modelValue: { ...base, enabled: true }, label: 'Login' } });
    const id = w.find('[data-testid="login-identifier"]');
    const pw = w.find('[data-testid="login-password"]');
    expect(id.exists()).toBe(true);
    expect(pw.attributes('placeholder')).toBe('Leave blank to generate one');
    expect(pw.attributes('type')).toBe('password');
    expect(pw.attributes('autocomplete')).toBe('new-password');
    await id.setValue('a@x.test');
    expect(w.emitted('update:modelValue')![0]![0]).toEqual({ enabled: true, identifier: 'a@x.test', password: '' });
    await pw.setValue('secret12');
    expect(w.emitted('update:modelValue')![1]![0]).toEqual({ enabled: true, identifier: '', password: 'secret12' });
  });
});
