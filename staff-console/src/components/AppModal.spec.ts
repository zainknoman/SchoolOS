import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import AppModal from './AppModal.vue';

describe('AppModal', () => {
  it('renders nothing when closed', () => {
    const wrapper = mount(AppModal, { props: { modelValue: false, title: 'Add School' } });
    expect(wrapper.find('[data-testid="modal-overlay"]').exists()).toBe(false);
  });

  it('renders the title and slot content when open', () => {
    const wrapper = mount(AppModal, {
      props: { modelValue: true, title: 'Add School' },
      slots: { default: '<p>form goes here</p>' },
    });
    expect(wrapper.text()).toContain('Add School');
    expect(wrapper.text()).toContain('form goes here');
  });

  it('emits update:modelValue false when the close button is clicked', async () => {
    const wrapper = mount(AppModal, { props: { modelValue: true, title: 'Add School' } });
    await wrapper.find('[data-testid="modal-close"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('emits update:modelValue false when clicking outside the dialog', async () => {
    const wrapper = mount(AppModal, { props: { modelValue: true, title: 'Add School' } });
    await wrapper.find('[data-testid="modal-overlay"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('emits update:modelValue false on Escape', async () => {
    const wrapper = mount(AppModal, { props: { modelValue: true, title: 'Add School' } });
    await wrapper.find('[data-testid="modal-overlay"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('does not close when clicking inside the dialog', async () => {
    const wrapper = mount(AppModal, {
      props: { modelValue: true, title: 'Add School' },
      slots: { default: '<button data-testid="inner-btn">inner</button>' },
    });
    await wrapper.find('[data-testid="inner-btn"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  // BL-55: keyboard focus management (WCAG 2.4.3).
  it('moves focus to the first field on open, traps Tab and returns focus on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const wrapper = mount(AppModal, {
      props: { modelValue: false, title: 'Add School' },
      slots: { default: '<input data-testid="first" aria-label="Name" /><button data-testid="last">Save</button>' },
      attachTo: document.body,
    });
    await wrapper.setProps({ modelValue: true });
    await nextTick();
    const first = wrapper.find('[data-testid="first"]').element as HTMLElement;
    const last = wrapper.find('[data-testid="last"]').element as HTMLElement;
    const close = wrapper.find('[data-testid="modal-close"]').element as HTMLElement;
    expect(document.activeElement).toBe(first);

    last.focus();
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    await wrapper.setProps({ modelValue: false });
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    trigger.remove();
  });
});
