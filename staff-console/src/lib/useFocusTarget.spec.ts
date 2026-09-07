import { describe, it, expect, vi } from 'vitest';
import { defineComponent, ref, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useFocusTarget } from './useFocusTarget';

async function mountAt(query: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/target', name: 'target', component: { template: '<div />' } }],
  });

  const TestComponent = defineComponent({
    setup() {
      const inputRef = ref<HTMLElement | null>(null);
      useFocusTarget({ 'gr-number': inputRef });
      return () => h('input', { ref: inputRef, 'data-testid': 'gr-input' });
    },
  });

  await router.push(`/target${query}`);
  await router.isReady();
  return mount(TestComponent, { global: { plugins: [router] }, attachTo: document.body });
}

describe('useFocusTarget', () => {
  it('focuses the matching ref when the route carries a matching ?focus= value', async () => {
    const wrapper = await mountAt('?focus=gr-number');
    const input = wrapper.find('[data-testid="gr-input"]').element as HTMLInputElement;

    expect(document.activeElement).toBe(input);
    wrapper.unmount();
  });

  it('does nothing when there is no ?focus= query', async () => {
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;
    const wrapper = await mountAt('');

    expect(focusSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does nothing when ?focus= does not match any provided key', async () => {
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;
    const wrapper = await mountAt('?focus=nonexistent-id');

    expect(focusSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
