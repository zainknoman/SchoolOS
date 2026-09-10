import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from './Button.vue';

describe('Button', () => {
  it('renders slot content and defaults to the primary variant', () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } });
    expect(wrapper.text()).toBe('Save');
    expect(wrapper.classes()).toContain('primary');
    expect(wrapper.classes()).not.toContain('secondary');
    expect(wrapper.attributes('type')).toBe('button');
  });

  it('applies the secondary variant class', () => {
    const wrapper = mount(Button, { props: { variant: 'secondary' }, slots: { default: 'Delete' } });
    expect(wrapper.classes()).toContain('secondary');
    expect(wrapper.classes()).not.toContain('primary');
  });

  it('forwards the disabled prop to the native button', () => {
    const wrapper = mount(Button, { props: { disabled: true }, slots: { default: 'Add' } });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });

  it('is not disabled by default', () => {
    const wrapper = mount(Button, { slots: { default: 'Add' } });
    expect(wrapper.attributes('disabled')).toBeUndefined();
  });

  it('forwards passthrough attributes like data-testid onto the root button', () => {
    const wrapper = mount(Button, {
      attrs: { 'data-testid': 'add-submit' },
      slots: { default: 'Add' },
    });
    expect(wrapper.attributes('data-testid')).toBe('add-submit');
  });

  it('forwards click events via native attribute passthrough', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Button, {
      attrs: { onClick },
      slots: { default: 'Add' },
    });
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
