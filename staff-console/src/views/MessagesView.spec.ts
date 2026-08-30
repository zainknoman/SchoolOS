import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MessagesView from './MessagesView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    replyToConversation: vi.fn(),
    markConversationRead: vi.fn(),
  },
}));

describe('MessagesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listConversations).mockReset();
    vi.mocked(api.getConversation).mockReset();
    vi.mocked(api.replyToConversation).mockReset();
    vi.mocked(api.markConversationRead).mockReset().mockResolvedValue(undefined);
  });

  it('lists conversations, opens a thread, and sends a reply', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        otherPartyName: 'Parent A',
        lastMessageAt: '2026-08-29T00:00:00.000Z',
        unread: true,
      },
    ]);
    vi.mocked(api.getConversation).mockResolvedValue({
      id: 'conv-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [
        { id: 'm1', senderId: 'parent-1', body: 'Can Eshaal get extra homework?', createdAt: '2026-08-29T00:00:00.000Z' },
      ],
    });
    vi.mocked(api.replyToConversation).mockResolvedValue(undefined);

    const wrapper = mount(MessagesView);
    await flushPromises();

    expect(wrapper.text()).toContain('Parent A');

    await wrapper.find('[data-testid="conversation-conv-1"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Can Eshaal get extra homework?');

    await wrapper.find('[data-testid="reply-text"]').setValue('Sure, will send some.');
    await wrapper.find('[data-testid="send-reply"]').trigger('click');
    await flushPromises();

    expect(api.replyToConversation).toHaveBeenCalledWith('token-1', 'conv-1', 'Sure, will send some.');
  });

  it('re-fetches conversations with the typed query when searching', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([]);

    const wrapper = mount(MessagesView);
    await flushPromises();

    expect(api.listConversations).toHaveBeenCalledWith('token-1', undefined);

    await wrapper.find('[data-testid="conversation-search"]').setValue('Parent A');
    await flushPromises();

    expect(api.listConversations).toHaveBeenLastCalledWith('token-1', 'Parent A');
  });

  it('does not send a whitespace-only reply', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        otherPartyName: 'Parent A',
        lastMessageAt: '2026-08-29T00:00:00.000Z',
        unread: true,
      },
    ]);
    vi.mocked(api.getConversation).mockResolvedValue({
      id: 'conv-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [],
    });

    const wrapper = mount(MessagesView);
    await flushPromises();

    await wrapper.find('[data-testid="conversation-conv-1"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-testid="reply-text"]').setValue('   ');
    expect(wrapper.find('[data-testid="send-reply"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="send-reply"]').trigger('click');
    await flushPromises();

    expect(api.replyToConversation).not.toHaveBeenCalled();
  });
});
