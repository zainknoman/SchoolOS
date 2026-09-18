import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ErrorRetry from './ErrorRetry.vue';

describe('ErrorRetry', () => {
  it('renders the message with role="alert"', () => {
    const wrapper = mount(ErrorRetry, { props: { message: 'Could not load students.' } });
    expect(wrapper.attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('Could not load students.');
  });

  it('emits "retry" when the retry button is clicked', async () => {
    const wrapper = mount(ErrorRetry, { props: { message: 'Could not load students.' } });
    await wrapper.find('[data-testid="error-retry-button"]').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});
