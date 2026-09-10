import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ConfirmDialog from './ConfirmDialog.vue';
import { useConfirm, useConfirmQueue } from '../lib/useConfirm';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useConfirmQueue().queue.value = [];
  });

  it('renders nothing when no confirmation is pending', () => {
    const wrapper = mount(ConfirmDialog);
    expect(wrapper.find('[data-testid="confirm-overlay"]').exists()).toBe(false);
  });

  it('shows the title/message and resolves true when Accept is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Delete this school?');
    expect(wrapper.text()).toContain('This cannot be undone.');

    await wrapper.find('[data-testid="confirm-accept"]').trigger('click');
    await expect(promise).resolves.toBe(true);
    wrapper.unmount();
  });

  it('resolves false when Cancel is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click');
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('resolves false on Escape', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-overlay"]').trigger('keydown', { key: 'Escape' });
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('resolves false on click outside the dialog box', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-overlay"]').trigger('click');
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('applies a danger class to the accept button when danger is true, and not when omitted', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const { resolveActive } = useConfirmQueue();

    confirm({ title: 'Delete this school?', message: 'm', danger: true });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="confirm-accept"]').classes()).toContain('danger');
    resolveActive(false);
    await wrapper.vm.$nextTick();

    confirm({ title: 'Publish this circular?', message: 'm' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="confirm-accept"]').classes()).not.toContain('danger');
    resolveActive(true);
    wrapper.unmount();
  });

  it('moves focus to Cancel on open and returns it to the previously-focused element on close', async () => {
    document.body.innerHTML = '<button id="trigger">Delete</button>';
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'm' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.find('[data-testid="confirm-cancel"]').element);

    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click');
    await promise;
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('queues a second pending confirm behind the first', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();

    const first = confirm({ title: 'First', message: 'm1' });
    confirm({ title: 'Second', message: 'm2' });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('First');
    expect(wrapper.text()).not.toContain('Second');

    await wrapper.find('[data-testid="confirm-accept"]').trigger('click');
    await first;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Second');
    wrapper.unmount();
  });
});
