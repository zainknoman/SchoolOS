import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
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

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/messages', name: 'messages', component: MessagesView }],
  });
}

async function mountAtMessages(query: Record<string, string> = {}) {
  const router = makeRouter();
  await router.push({ path: '/messages', query });
  await router.isReady();
  return mount(MessagesView, { global: { plugins: [router] } });
}

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
        {
          id: 'm1',
          senderId: 'parent-1',
          senderName: 'Parent A',
          body: 'Can Eshaal get extra homework?',
          createdAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    });
    vi.mocked(api.replyToConversation).mockResolvedValue(undefined);

    const wrapper = await mountAtMessages();
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

  it("shows each message's sender name and a formatted time", async () => {
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
        {
          id: 'm1',
          senderId: 'parent-1',
          senderName: 'Parent A',
          body: 'Can Eshaal get extra homework?',
          createdAt: '2026-08-29T12:00:00.000Z',
        },
      ],
    });

    const wrapper = await mountAtMessages();
    await flushPromises();

    await wrapper.find('[data-testid="conversation-conv-1"]').trigger('click');
    await flushPromises();

    const message = wrapper.find('.message');
    expect(message.text()).toContain('Parent A');
    expect(message.text()).toMatch(/\d{1,2}:\d{2}/);
  });

  it('opens the conversation named by ?conversationId= on mount, for a notification deep link', async () => {
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
        {
          id: 'm1',
          senderId: 'parent-1',
          senderName: 'Parent A',
          body: 'Can Eshaal get extra homework?',
          createdAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    });

    const wrapper = await mountAtMessages({ conversationId: 'conv-1' });
    await flushPromises();

    expect(api.getConversation).toHaveBeenCalledWith('token-1', 'conv-1');
    expect(wrapper.text()).toContain('Can Eshaal get extra homework?');
  });

  it('re-fetches conversations with the typed query when searching', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([]);

    const wrapper = await mountAtMessages();
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

    const wrapper = await mountAtMessages();
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
