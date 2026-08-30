<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type ConversationSummary, type ConversationDetail } from '../lib/api';
import { formatDateTime } from '../lib/format';
import DirectionalText from '../components/DirectionalText.vue';

const auth = useAuthStore();
const route = useRoute();
const conversations = ref<ConversationSummary[]>([]);
const selected = ref<ConversationDetail | null>(null);
const selectedId = ref('');
const replyText = ref('');
const isSending = ref(false);
const errorMessage = ref<string | null>(null);
const search = ref('');

async function loadConversations() {
  if (!auth.accessToken) return;
  try {
    conversations.value = await api.listConversations(auth.accessToken, search.value || undefined);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load messages.';
  }
}
loadConversations();

async function openConversation(id: string) {
  if (!auth.accessToken) return;
  selectedId.value = id;
  errorMessage.value = null;
  try {
    selected.value = await api.getConversation(auth.accessToken, id);
    await api.markConversationRead(auth.accessToken, id);
    await loadConversations();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not open this conversation.';
  }
}

// A notification tap navigates here with ?conversationId=<id> so the bell opens the specific
// conversation it was about, instead of leaving the reader to hunt for it in the list.
const initialConversationId = route.query.conversationId;
if (typeof initialConversationId === 'string' && initialConversationId) {
  openConversation(initialConversationId);
}

async function onSendReply() {
  if (!auth.accessToken || !selectedId.value || !replyText.value.trim()) return;
  isSending.value = true;
  errorMessage.value = null;
  const accessToken = auth.accessToken;
  const conversationId = selectedId.value;
  const body = replyText.value.trim();
  try {
    await api.replyToConversation(accessToken, conversationId, body);
    replyText.value = '';
    selected.value = await api.getConversation(accessToken, conversationId);
    await loadConversations();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div class="messages">
    <h1>Messages</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="layout">
      <div class="conversation-pane">
        <input
          data-testid="conversation-search"
          class="conversation-search"
          type="search"
          v-model="search"
          placeholder="Search conversations…"
          @input="loadConversations"
        />
        <ul class="conversation-list">
          <li v-if="!conversations.length" class="empty">No messages yet.</li>
          <li
            v-for="c in conversations"
            :key="c.id"
            :data-testid="`conversation-${c.id}`"
            :class="{ active: c.id === selectedId, unread: c.unread }"
            @click="openConversation(c.id)"
          >
            {{ c.otherPartyName }}
          </li>
        </ul>
      </div>

      <div class="thread" v-if="selected">
        <div v-for="m in selected.messages" :key="m.id" class="message">
          <div class="message-meta">
            <span class="message-sender">{{ m.senderName }}</span>
            <span class="message-time">{{ formatDateTime(m.createdAt) }}</span>
          </div>
          <DirectionalText :text="m.body" />
        </div>
        <textarea
          data-testid="reply-text"
          v-model="replyText"
          rows="2"
          :disabled="isSending"
          placeholder="Type a reply…"
        ></textarea>
        <button data-testid="send-reply" :disabled="isSending || !replyText.trim()" @click="onSendReply">
          {{ isSending ? 'Sending…' : 'Send' }}
        </button>
      </div>
      <div class="thread empty" v-else>Select a conversation to view it.</div>
    </div>
  </div>
</template>

<style scoped>
.messages {
  max-width: 900px;
}
.layout {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
}
.conversation-pane {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.conversation-search {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.conversation-list li {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}
.conversation-list li.unread {
  font-weight: 700;
}
.conversation-list li.active {
  background: var(--color-surface-muted, #f2f4f7);
}
.thread {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.thread.empty {
  color: var(--color-muted);
}
.message {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.message-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
  margin-bottom: 0.2rem;
}
.message-sender {
  font-weight: 700;
}
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  color: var(--color-destructive);
}
.empty {
  color: var(--color-muted);
  padding: var(--space-3);
}
</style>
