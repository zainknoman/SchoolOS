<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ConversationSummary, type ConversationDetail } from '../lib/api';
import DirectionalText from '../components/DirectionalText.vue';

const auth = useAuthStore();
const conversations = ref<ConversationSummary[]>([]);
const selected = ref<ConversationDetail | null>(null);
const selectedId = ref('');
const replyText = ref('');
const isSending = ref(false);
const errorMessage = ref<string | null>(null);

async function loadConversations() {
  if (!auth.accessToken) return;
  try {
    conversations.value = await api.listConversations(auth.accessToken);
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

async function onSendReply() {
  if (!auth.accessToken || !selectedId.value || !replyText.value) return;
  isSending.value = true;
  errorMessage.value = null;
  const accessToken = auth.accessToken;
  const conversationId = selectedId.value;
  const body = replyText.value;
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

      <div class="thread" v-if="selected">
        <div v-for="m in selected.messages" :key="m.id" class="message">
          <DirectionalText :text="m.body" />
        </div>
        <textarea
          data-testid="reply-text"
          v-model="replyText"
          rows="2"
          :disabled="isSending"
          placeholder="Type a reply…"
        ></textarea>
        <button data-testid="send-reply" :disabled="isSending || !replyText" @click="onSendReply">
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
.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 240px;
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
