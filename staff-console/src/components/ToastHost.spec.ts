import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ToastHost from './ToastHost.vue';
import { useToast, useToastQueue } from '../lib/useToast';

describe('ToastHost', () => {
  beforeEach(() => {
    useToastQueue().toasts.value = [];
  });

  it('renders nothing when no toast is queued', () => {
    const wrapper = mount(ToastHost);
    expect(wrapper.findAll('.toast')).toHaveLength(0);
  });

  it('shows a pushed success toast with the right tone class', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body });
    const { success } = useToast();
    success('Student added.');
    await wrapper.vm.$nextTick();

    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('success');
    expect(toast.text()).toContain('Student added.');
    wrapper.unmount();
  });

  it('dismisses a toast when its dismiss button is clicked', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body });
    const { error } = useToast();
    error('Could not save.');
    await wrapper.vm.$nextTick();

    const dismissBtn = wrapper.find('[data-testid^="toast-dismiss-"]');
    expect(dismissBtn.exists()).toBe(true);
    await dismissBtn.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.toast')).toHaveLength(0);
    wrapper.unmount();
  });

  it('stacks multiple toasts in order pushed', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body });
    const { success, info } = useToast();
    success('First');
    info('Second');
    await wrapper.vm.$nextTick();

    const toasts = wrapper.findAll('.toast');
    expect(toasts).toHaveLength(2);
    expect(toasts[0]!.text()).toContain('First');
    expect(toasts[1]!.text()).toContain('Second');
    wrapper.unmount();
  });
});
