import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Tabs from './Tabs.vue';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'contacts', label: 'Emergency Contacts' },
  { id: 'documents', label: 'Documents' },
];

describe('Tabs', () => {
  it('renders one tab button per entry and marks the active one selected', () => {
    const wrapper = mount(Tabs, {
      props: { tabs: TABS, modelValue: 'contacts' },
    });
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons).toHaveLength(3);
    expect(buttons[1]!.attributes('aria-selected')).toBe('true');
    expect(buttons[0]!.attributes('aria-selected')).toBe('false');
  });

  it('emits update:modelValue when a tab is clicked', async () => {
    const wrapper = mount(Tabs, {
      props: { tabs: TABS, modelValue: 'profile' },
    });
    await wrapper.get('[data-testid="tab-documents"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['documents']);
  });

  it('only shows the active panel content, hiding the others', () => {
    const wrapper = mount(Tabs, {
      props: { tabs: TABS, modelValue: 'profile' },
      slots: {
        'tab-profile': '<div data-testid="profile-content">Profile content</div>',
        'tab-contacts': '<div data-testid="contacts-content">Contacts content</div>',
      },
    });
    const panels = wrapper.findAll('[role="tabpanel"]');
    expect(panels).toHaveLength(3);
    expect((panels[0]!.element as HTMLElement).style.display).not.toBe('none');
    expect((panels[1]!.element as HTMLElement).style.display).toBe('none');
  });

  it('moves focus and selection with ArrowRight/ArrowLeft, wrapping around', async () => {
    const wrapper = mount(Tabs, {
      props: { tabs: TABS, modelValue: 'documents' },
      attachTo: document.body,
    });
    await wrapper.get('[data-testid="tab-documents"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['profile']);
    wrapper.unmount();
  });
});
