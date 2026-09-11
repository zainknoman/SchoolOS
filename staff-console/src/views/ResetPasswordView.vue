<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';

const route = useRoute();
const router = useRouter();

const token = ref((route.query.token as string) ?? '');
const newPassword = ref('');
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);
const done = ref(false);

async function onSubmit() {
  if (!token.value || newPassword.value.length < 8) return;
  errorMessage.value = null;
  isSubmitting.value = true;
  try {
    await api.resetPassword(token.value, newPassword.value);
    done.value = true;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'This reset link is invalid or has expired.';
  } finally {
    isSubmitting.value = false;
  }
}

function goToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="login-page">
    <form v-if="!done" class="login-card" @submit.prevent="onSubmit">
      <h1 class="brand">Reset password</h1>

      <label class="field">
        <span>New password</span>
        <input
          data-testid="new-password-input"
          type="password"
          v-model="newPassword"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </label>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Resetting…' : 'Reset password' }}
      </button>
    </form>

    <div v-else class="login-card">
      <p data-testid="reset-password-message">Your password has been reset. Please log in again.</p>
      <button type="button" @click="goToLogin">Go to login</button>
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
.error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
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
</style>
