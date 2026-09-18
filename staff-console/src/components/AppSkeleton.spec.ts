import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppSkeleton from './AppSkeleton.vue';

describe('AppSkeleton', () => {
  it('renders with default width/height and is hidden from assistive tech', () => {
    const wrapper = mount(AppSkeleton);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('data-testid')).toBe('skeleton');
    expect(wrapper.attributes('style')).toContain('width: 100%');
    expect(wrapper.attributes('style')).toContain('height: 1rem');
  });

  it('accepts custom width/height', () => {
    const wrapper = mount(AppSkeleton, { props: { width: '3rem', height: '3rem' } });
    expect(wrapper.attributes('style')).toContain('width: 3rem');
    expect(wrapper.attributes('style')).toContain('height: 3rem');
  });

  it('applies a circle class when circle is true', () => {
    const wrapper = mount(AppSkeleton, { props: { circle: true } });
    expect(wrapper.classes()).toContain('circle');
  });
});
