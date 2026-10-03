import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import HelpView from './HelpView.vue';
import { useAuthStore } from '../stores/auth';
import { HELP_ENTRIES, HELP_GROUPS } from '../lib/help-content';

async function mountAs(role: string, extra: { isPrincipal?: boolean; grants?: string[] } = {}) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  auth.isPrincipal = extra.isPrincipal ?? false;
  auth.grants = extra.grants ?? [];
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:any(.*)*', component: { template: '<div />' } }],
  });
  await router.push('/help');
  const wrapper = mount(HelpView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('HelpView', () => {
  it('every entry has a known group, a name, a description and at least one step', () => {
    for (const e of HELP_ENTRIES) {
      expect(HELP_GROUPS).toContain(e.group);
      expect(e.name && e.description).toBeTruthy();
      expect(e.steps.length).toBeGreaterThan(0);
    }
    expect(new Set(HELP_ENTRIES.map((e) => e.id)).size).toBe(HELP_ENTRIES.length);
  });

  it('shows a school admin the admin screens with group, name, description and steps', async () => {
    const wrapper = await mountAs('SCHOOL_ADMIN');

    const syllabus = wrapper.find('[data-testid="help-entry-admin-syllabus"]');
    expect(syllabus.text()).toContain('Academics');
    expect(syllabus.text()).toContain('Syllabus');
    expect(syllabus.text()).toContain('How to use it');
    expect(syllabus.findAll('li').length).toBeGreaterThan(1);
    expect(wrapper.find('[data-testid="help-open-admin-syllabus"]').attributes('href')).toBe('/admin/syllabus');
    expect(wrapper.find('[data-testid="help-entry-my-day"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="help-entry-schools"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="help-entry-principal-overview"]').exists()).toBe(false);
  });

  it('shows a teacher the teaching screens, linked to teacher routes', async () => {
    const wrapper = await mountAs('TEACHER');

    expect(wrapper.find('[data-testid="help-entry-my-day"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="help-open-messages"]').attributes('href')).toBe('/teacher/messages');
    expect(wrapper.find('[data-testid="help-entry-admin-syllabus"]').exists()).toBe(false);
  });

  it('shows an accounts user granted modules only', async () => {
    const without = await mountAs('ACCOUNTS');
    expect(without.find('[data-testid="help-entry-fees"]').exists()).toBe(true);
    expect(without.find('[data-testid="help-entry-admissions"]').exists()).toBe(false);

    const withGrant = await mountAs('ACCOUNTS', { grants: ['ADMISSIONS'] });
    expect(withGrant.find('[data-testid="help-entry-admissions"]').exists()).toBe(true);
  });

  it('narrows the list by search text and by group', async () => {
    const wrapper = await mountAs('SUPER_ADMIN');

    await wrapper.find('[data-testid="help-search"] input, input[data-testid="help-search"]').setValue('voucher');
    expect(wrapper.find('[data-testid="help-entry-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="help-entry-schools"]').exists()).toBe(false);

    await wrapper.find('[data-testid="help-search"] input, input[data-testid="help-search"]').setValue('');
    await wrapper.find('select[data-testid="help-group"], [data-testid="help-group"] select').setValue('Org Structure');
    expect(wrapper.find('[data-testid="help-entry-schools"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="help-entry-fees"]').exists()).toBe(false);
  });
});
