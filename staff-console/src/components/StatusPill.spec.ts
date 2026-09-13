import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusPill from './StatusPill.vue';

describe('StatusPill', () => {
  it.each([
    ['success', 'tone-success'],
    ['warning', 'tone-warning'],
    ['critical', 'tone-critical'],
    ['info', 'tone-info'],
    ['neutral', 'tone-neutral'],
  ] as const)('renders the %s tone with class %s', (tone, expectedClass) => {
    const wrapper = mount(StatusPill, { props: { tone, label: 'Some Status' } });
    expect(wrapper.classes()).toContain(expectedClass);
    expect(wrapper.text()).toBe('Some Status');
    expect(wrapper.attributes('data-testid')).toBe('status-pill');
  });
});
