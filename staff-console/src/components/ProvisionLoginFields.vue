<!-- staff-console/src/components/ProvisionLoginFields.vue -->
<!-- Optional "create a login" block for the school / campus create screens. -->
<script setup lang="ts">
import FormField from './FormField.vue';

export interface ProvisionLoginState {
  enabled: boolean;
  identifier: string;
  password: string;
}

const props = defineProps<{ modelValue: ProvisionLoginState; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: ProvisionLoginState] }>();

function update(patch: Partial<ProvisionLoginState>) {
  emit('update:modelValue', { ...props.modelValue, ...patch });
}
</script>

<template>
  <div class="provision-login">
    <FormField
      :model-value="modelValue.enabled"
      :label="label"
      type="checkbox"
      data-testid="login-enabled"
      @update:model-value="update({ enabled: $event as boolean })"
    />
    <div v-if="modelValue.enabled" class="field-grid">
      <FormField
        :model-value="modelValue.identifier"
        label="Login identifier"
        type="text"
        hint="Email the principal will sign in with"
        placeholder="name@example.com"
        data-testid="login-identifier"
        @update:model-value="update({ identifier: $event as string })"
      />
      <FormField
        :model-value="modelValue.password"
        label="Password (optional)"
        type="password"
        placeholder="Leave blank to generate one"
        autocomplete="new-password"
        data-testid="login-password"
        @update:model-value="update({ password: $event as string })"
      />
    </div>
  </div>
</template>

<style scoped>
.provision-login {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
