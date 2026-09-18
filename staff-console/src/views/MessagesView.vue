<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type ConversationSummary, type ConversationDetail } from '../lib/api';
import { formatDateTime, initialsFromName } from '../lib/format';
import DirectionalText from '../components/DirectionalText.vue';
import Icon from '../components/AppIcon.vue';

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

const selectedName = computed(
  () => conversations.value.find((c) => c.id === selectedId.value)?.otherPartyName ?? '',
);

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
    <div class="page-header">
      <span class="page-header-icon"><Icon name="chat" :size="16" /></span>
      <h1>Messages</h1>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="layout">
      <div class="conversation-pane">
        <div class="conversation-search-wrap">
          <Icon name="search" :size="14" />
          <input
            data-testid="conversation-search"
            class="conversation-search"
            type="search"
            v-model="search"
            placeholder="Search conversations…"
            @input="loadConversations"
          />
        </div>
        <ul class="conversation-list">
          <li v-if="!conversations.length" class="empty">No messages yet.</li>
          <li
            v-for="c in conversations"
            :key="c.id"
            :data-testid="`conversation-${c.id}`"
            class="conv-item"
            :class="{ active: c.id === selectedId, unread: c.unread }"
            @click="openConversation(c.id)"
          >
            <span class="conv-avatar">
              {{ initialsFromName(c.otherPartyName) }}
              <span v-if="c.unread" class="conv-unread-dot"></span>
            </span>
            <div class="conv-meta">
              <span class="conv-name">{{ c.otherPartyName }}</span>
              <span class="conv-time mono">{{ formatDateTime(c.lastMessageAt) }}</span>
            </div>
          </li>
        </ul>
      </div>

      <div class="thread" v-if="selected">
        <div class="thread-header">
          <span class="thread-avatar">{{ initialsFromName(selectedName) }}</span>
          <span class="thread-name">{{ selectedName }}</span>
        </div>
        <div class="thread-messages">
          <div v-for="m in selected.messages" :key="m.id" class="message">
            <div class="message-meta">
              <span class="message-sender">{{ m.senderName }}</span>
              <span class="message-time mono">{{ formatDateTime(m.createdAt) }}</span>
            </div>
            <DirectionalText :text="m.body" class="message-body" />
          </div>
        </div>
        <div class="reply-bar">
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
      </div>
      <div class="thread empty" v-else>Select a conversation to view it.</div>
    </div>
  </div>
</template>

<style scoped>
.messages {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: calc(100vh - var(--topbar-height) - var(--space-6));
}
.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.page-header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.page-header h1 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.layout {
  flex-grow: 1;
  min-height: 0;
  display: flex;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.conversation-pane {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
}
.conversation-search-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-3);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-muted);
}
.conversation-search {
  flex-grow: 1;
  border: none;
  outline: none;
  font: inherit;
  background: transparent;
  color: var(--color-text);
}
.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}
.conv-item.active {
  background: var(--color-status-info-tint);
  border-left: 3px solid var(--color-accent);
  padding-left: calc(var(--space-3) - 3px);
}
.conv-item.unread .conv-name {
  font-weight: 800;
}
.conv-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-muted-bg);
  color: var(--color-primary);
  font-size: var(--font-size-2xs);
  font-weight: 700;
}
.conv-unread-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-surface);
}
.conv-meta {
  min-width: 0;
  flex-grow: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.conv-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-time {
  flex-shrink: 0;
  font-size: var(--font-size-2xs);
  color: var(--color-muted);
}

.thread {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.thread.empty {
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
}
.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.thread-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-2xs);
  font-weight: 700;
}
.thread-name {
  font-weight: 700;
}
.thread-messages {
  flex-grow: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.message {
  max-width: 70%;
  background: var(--color-background);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-3);
}
.message-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  margin-bottom: 0.2rem;
}
.message-sender {
  font-weight: 700;
}
.message-body {
  font-size: var(--font-size-sm);
  line-height: 1.5;
}
.reply-bar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
}
textarea {
  flex-grow: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  background: var(--color-surface);
  color: var(--color-text);
  resize: vertical;
}
button {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
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
