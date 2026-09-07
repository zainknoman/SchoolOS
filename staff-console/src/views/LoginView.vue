<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const identifier = ref('');
const password = ref('');
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);

const auth = useAuthStore();
const router = useRouter();

function homeRouteForRole(role: string | null) {
  if (role === 'TEACHER') return { name: 'teacher-home' };
  return { name: 'admin-home' };
}

async function onSubmit() {
  errorMessage.value = null;
  isSubmitting.value = true;
  try {
    await auth.login(identifier.value, password.value);
    await router.push(homeRouteForRole(auth.role));
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="brand">School OS Staff Console</h1>
      <p class="subtitle">Sign in with your school account</p>

      <label class="field">
        <span>Email or GR number</span>
        <input
          name="identifier"
          type="text"
          v-model="identifier"
          autocomplete="username"
          required
        />
      </label>

      <label class="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          v-model="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
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
  color: var(--color-text);
}
input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-base);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
input:focus-visible {
  outline: none;
  border-color: var(--color-ring);
  box-shadow: 0 0 0 3px rgb(3 105 161 / 0.15);
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
  transition: background var(--transition-fast);
}
button:hover:not(:disabled) {
  background: var(--color-accent-hover);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
