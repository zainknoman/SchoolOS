import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import CommandPalette from './CommandPalette.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/admin/students', name: 'students', component: { template: '<div>students</div>' } },
      { path: '/admin/fees', name: 'fees', component: { template: '<div>fees</div>' } },
    ],
  });
}

const goToItems = [
  { testid: 'cmdk-dashboard', label: 'Dashboard', icon: 'home' as const, to: '/' },
  { testid: 'cmdk-students', label: 'Students', icon: 'users' as const, to: '/admin/students' },
];
const actionItems = [
  {
    testid: 'cmdk-action-issue-vouchers',
    label: 'Issue fee vouchers',
    icon: 'receipt' as const,
    to: '/admin/fees',
    query: { focus: 'issue-section' },
  },
];

async function mountPalette(open = true, options: { attach?: boolean } = {}) {
  const router = makeRouter();
  await router.push('/');
  await router.isReady();
  const wrapper = mount(CommandPalette, {
    props: { open, goToItems, actionItems },
    global: { plugins: [router] },
    ...(options.attach ? { attachTo: document.body } : {}),
  });
  return { wrapper, router };
}

describe('CommandPalette', () => {
  it('renders nothing when closed', async () => {
    const { wrapper } = await mountPalette(false);
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);
  });

  it('lists every go-to and action item, grouped, when open', async () => {
    const { wrapper } = await mountPalette(true);

    expect(wrapper.find('[data-testid="cmdk-dashboard"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Go to');
    expect(wrapper.text()).toContain('Actions');
  });

  it('filters items by the typed query', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').setValue('student');

    expect(wrapper.find('[data-testid="cmdk-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-dashboard"]').exists()).toBe(false);
  });

  it('shows an empty state when nothing matches', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').setValue('nonexistent-screen-xyz');

    expect(wrapper.find('[data-testid="cmdk-empty"]').exists()).toBe(true);
  });

  it('navigates to a go-to item on click and emits close', async () => {
    const { wrapper, router } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-students"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/students');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('navigates an action item to its target path with its focus query', async () => {
    const { wrapper, router } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/fees');
    expect(router.currentRoute.value.query.focus).toBe('issue-section');
  });

  it('closes on Escape', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('moves the selection with ArrowDown/ArrowUp and activates on Enter', async () => {
    const { wrapper, router } = await mountPalette(true);
    const input = wrapper.find('[data-testid="cmdk-input"]');

    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/students');
  });

  it('traps Tab focus inside the dialog — wraps from the last item back to the input', async () => {
    const { wrapper } = await mountPalette(true, { attach: true });
    const input = wrapper.find('[data-testid="cmdk-input"]').element as HTMLInputElement;
    const items = wrapper.findAll('.cmdk-item');
    const lastItem = items[items.length - 1]!.element as HTMLElement;

    lastItem.focus();
    expect(document.activeElement).toBe(lastItem);

    await wrapper.find('.cmdk').trigger('keydown', { key: 'Tab' });

    expect(document.activeElement).toBe(input);
    wrapper.unmount();
  });

  it('traps Shift+Tab focus inside the dialog — wraps from the input back to the last item', async () => {
    const { wrapper } = await mountPalette(true, { attach: true });
    const input = wrapper.find('[data-testid="cmdk-input"]').element as HTMLInputElement;
    const items = wrapper.findAll('.cmdk-item');
    const lastItem = items[items.length - 1]!.element as HTMLElement;

    input.focus();
    expect(document.activeElement).toBe(input);

    await wrapper.find('.cmdk').trigger('keydown', { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastItem);
    wrapper.unmount();
  });

  it('resets the query when reopened', async () => {
    const router = makeRouter();
    await router.push('/');
    await router.isReady();
    const wrapper = mount(CommandPalette, {
      props: { open: true, goToItems, actionItems },
      global: { plugins: [router] },
    });

    await wrapper.find('[data-testid="cmdk-input"]').setValue('student');
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('[data-testid="cmdk-input"]').element as HTMLInputElement).value).toBe('');
  });
});
