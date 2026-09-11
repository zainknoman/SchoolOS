<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../lib/api';

const identifier = ref('');
const isSubmitting = ref(false);
// Always shows this generic message once submitted, regardless of whether the identifier
// matched a real account — the backend response is identical either way, and the UI must not
// invent a way to distinguish the two.
const submitted = ref(false);
const message = ref('');

async function onSubmit() {
  if (!identifier.value.trim()) return;
  isSubmitting.value = true;
  try {
    const res = await api.forgotPassword(identifier.value.trim());
    message.value = res.message;
  } catch {
    message.value = 'If an account exists for that identifier, a password reset link has been sent.';
  } finally {
    isSubmitting.value = false;
    submitted.value = true;
  }
}
</script>

<template>
  <div class="login-page">
    <form v-if="!submitted" class="login-card" @submit.prevent="onSubmit">
      <h1 class="brand">Forgot password</h1>
      <p class="subtitle">Enter your email or GR number and we'll send a reset link.</p>

      <label class="field">
        <span>Email or GR number</span>
        <input data-testid="identifier-input" type="text" v-model="identifier" autocomplete="username" required />
      </label>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Sending…' : 'Send reset link' }}
      </button>

      <RouterLink data-testid="back-to-login" class="forgot-link" :to="{ name: 'login' }">Back to login</RouterLink>
    </form>

    <div v-else class="login-card">
      <p data-testid="forgot-password-message">{{ message }}</p>
      <RouterLink data-testid="back-to-login" class="forgot-link" :to="{ name: 'login' }">Back to login</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  padding: var(--space-4);
}
.login-card {
  width: min(380px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-5);
}
.brand {
  font-size: var(--font-size-xl);
  margin: 0;
}
.subtitle {
  margin: 0 0 var(--space-1);
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
}
input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  margin-top: var(--space-1);
  padding: 0.7rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.forgot-link {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}
</style>
