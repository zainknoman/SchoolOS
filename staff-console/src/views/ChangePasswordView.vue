<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);

function homeRouteForRole(role: string | null, isPrincipal: boolean): string {
  if (role === 'TEACHER') return '/teacher';
  if (role === 'SCHOOL_ADMIN' && isPrincipal) return '/principal';
  return '/admin';
}

async function onSubmit() {
  errorMessage.value = null;
  if (newPassword.value.length < 8) {
    errorMessage.value = t('changePassword.tooShort');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = t('changePassword.mismatch');
    return;
  }
  isSubmitting.value = true;
  try {
    const session = await api.changePassword(auth.accessToken as string, {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    auth.applySession(session);
    await router.push(homeRouteForRole(auth.role, auth.isPrincipal));
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}

function onLogout() {
  auth.logout();
  void router.push('/login');
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="brand">{{ t('changePassword.title') }}</h1>
      <p class="subtitle">{{ t('changePassword.subtitle') }}</p>

      <label class="field">
        <span>{{ t('changePassword.current') }}</span>
        <input
          data-testid="current-password"
          type="password"
          v-model="currentPassword"
          autocomplete="current-password"
          required
        />
      </label>

      <label class="field">
        <span>{{ t('changePassword.new') }}</span>
        <input
          data-testid="new-password"
          type="password"
          v-model="newPassword"
          autocomplete="new-password"
          required
        />
      </label>

      <label class="field">
        <span>{{ t('changePassword.confirm') }}</span>
        <input
          data-testid="confirm-password"
          type="password"
          v-model="confirmPassword"
          autocomplete="new-password"
          required
        />
      </label>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('changePassword.submitting') : t('changePassword.submit') }}
      </button>

      <button type="button" data-testid="logout" class="link" @click="onLogout">
        {{ t('changePassword.logout') }}
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
button.link {
  background: none;
  color: var(--color-accent);
  font-weight: 400;
  font-size: var(--font-size-sm);
}
.error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
