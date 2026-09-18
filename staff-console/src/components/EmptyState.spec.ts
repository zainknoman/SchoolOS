import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from './EmptyState.vue';

describe('EmptyState', () => {
  it('renders the title and message, with a default icon', () => {
    const wrapper = mount(EmptyState, { props: { title: 'No students yet', message: 'Add your first student.' } });
    expect(wrapper.text()).toContain('No students yet');
    expect(wrapper.text()).toContain('Add your first student.');
    expect(wrapper.attributes('data-testid')).toBe('empty-state');
  });

  it('does not render a CTA button when ctaLabel is omitted', () => {
    const wrapper = mount(EmptyState, { props: { title: 'No students yet' } });
    expect(wrapper.find('[data-testid="empty-state-cta"]').exists()).toBe(false);
  });

  it('renders a CTA button and emits "cta" on click', async () => {
    const wrapper = mount(EmptyState, { props: { title: 'No students yet', ctaLabel: 'Add student' } });
    const cta = wrapper.find('[data-testid="empty-state-cta"]');
    expect(cta.exists()).toBe(true);
    expect(cta.text()).toBe('Add student');

    await cta.trigger('click');
    expect(wrapper.emitted('cta')).toHaveLength(1);
  });
});
