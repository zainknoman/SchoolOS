import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormField from './FormField.vue';

describe('FormField', () => {
  it('renders a text input and emits update:modelValue on input', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', placeholder: 'Full name' },
    });
    const input = wrapper.find('input');
    expect(input.attributes('type')).toBe('text');
    expect(input.attributes('placeholder')).toBe('Full name');
    await input.setValue('Ali Khan');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Ali Khan']);
  });

  it('renders a password input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Password', type: 'password' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('password');
  });

  it('renders a date input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Start', type: 'date' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('date');
  });

  it('renders an email input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Email', type: 'email' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('email');
  });

  it('renders a textarea and emits update:modelValue on input', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Notes', type: 'textarea', placeholder: 'Notes' },
    });
    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes('placeholder')).toBe('Notes');
    await textarea.setValue('Some notes');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Some notes']);
  });

  it('renders a select with a disabled placeholder option and the given options, emitting on change', async () => {
    const wrapper = mount(FormField, {
      props: {
        modelValue: '',
        label: 'Section',
        type: 'select',
        placeholder: 'Choose a section',
        options: [
          { value: 'sec-1', label: '3B (Main Campus)' },
          { value: 'sec-2', label: '4A (Main Campus)' },
        ],
      },
    });
    const select = wrapper.find('select');
    const opts = select.findAll('option');
    expect(opts).toHaveLength(3);
    expect(opts[0]!.attributes('disabled')).toBeDefined();
    expect(opts[0]!.text()).toBe('Choose a section');
    await select.setValue('sec-2');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['sec-2']);
  });

  it('renders a checkbox with the label shown after the control, using a boolean model', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: false, label: 'Active', type: 'checkbox' },
    });
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.find('label').text()).toBe('Active');
    await checkbox.setValue(true);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('renders a visible label linked to the control for non-checkbox types', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Date of birth', type: 'date' },
    });
    const label = wrapper.find('label');
    expect(label.text()).toBe('Date of birth');
    expect(label.classes()).not.toContain('sr-only');
    expect(label.attributes('for')).toBe(wrapper.find('input').attributes('id'));
  });

  it('visually hides the label when hideLabel is set', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Status', type: 'select', hideLabel: true },
    });
    expect(wrapper.find('label').classes()).toContain('sr-only');
  });

  it('forwards passthrough attributes like data-testid onto the inner control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
      attrs: { 'data-testid': 'add-name' },
    });
    expect(wrapper.find('input').attributes('data-testid')).toBe('add-name');
    expect(wrapper.attributes('data-testid')).toBeUndefined();
  });

  it('renders provided error text, and nothing when unset', () => {
    const withError = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', error: 'Required' },
    });
    expect(withError.text()).toContain('Required');

    const withoutError = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
    });
    expect(withoutError.find('.field-error').exists()).toBe(false);
  });

  it('applies the grow class only when the grow prop is set', () => {
    const grown = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', grow: true },
    });
    expect(grown.find('.form-field').classes()).toContain('grow');

    const notGrown = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
    });
    expect(notGrown.find('.form-field').classes()).not.toContain('grow');
  });

  it('exposes a focus() method that focuses the inner control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'GR number', type: 'text' },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.find('input').element);
    wrapper.unmount();
  });

  it('exposes a focus() method that focuses a textarea control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Notes', type: 'textarea' },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.find('textarea').element);
    wrapper.unmount();
  });
});
