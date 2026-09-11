import { describe, it, expect } from 'vitest';
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
});
