<!-- staff-console/src/components/CredentialsPanel.vue -->
<!-- One-time display of a freshly provisioned login. The temporary password is held only in
     component props/memory — never persisted, logged or put in a URL. -->
<script setup lang="ts">
import type { ProvisionedLogin } from '../lib/api';
import Button from './Button.vue';
import { useToast } from '../lib/useToast';

const props = defineProps<{ login: ProvisionedLogin }>();
defineEmits<{ done: [] }>();
const toast = useToast();

async function copy() {
  try {
    await navigator.clipboard.writeText(`${props.login.identifier} / ${props.login.temporaryPassword}`);
    toast.success('Credentials copied.');
  } catch {
    toast.error('Could not copy. Select and copy the credentials manually.');
  }
}
</script>

<template>
  <section class="credentials-panel" role="status" data-testid="credentials-panel">
    <h2 class="title">Login created</h2>
    <dl class="creds">
      <div>
        <dt>Identifier</dt>
        <dd class="mono" data-testid="credentials-identifier">{{ login.identifier }}</dd>
      </div>
      <div v-if="login.temporaryPassword">
        <dt>Temporary password</dt>
        <dd class="mono" data-testid="credentials-password">{{ login.temporaryPassword }}</dd>
      </div>
    </dl>
    <template v-if="login.temporaryPassword">
      <p class="warn">These credentials are shown only once. The user must change the password at first login.</p>
      <Button variant="secondary" data-testid="copy-credentials" @click="copy">Copy credentials</Button>
    </template>
    <p v-else class="note">The password is the password you entered.</p>
    <Button data-testid="credentials-done" @click="$emit('done')">Done</Button>
  </section>
</template>

<style scoped>
.credentials-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.title {
  margin: 0;
}
.creds {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.creds dt {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.creds dd {
  margin: 0;
}
.warn {
  margin: 0;
  color: var(--color-destructive);
}
.note {
  margin: 0;
}
</style>
