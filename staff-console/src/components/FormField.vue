<script setup lang="ts">
import { ref } from 'vue';

interface FieldOption {
  value: string;
  label: string;
}

withDefaults(
  defineProps<{
    modelValue: string | boolean;
    label: string;
    type: 'text' | 'password' | 'date' | 'email' | 'select' | 'checkbox' | 'textarea';
    options?: FieldOption[];
    placeholder?: string;
    error?: string;
    grow?: boolean;
  }>(),
  { grow: false },
);
defineEmits<{ 'update:modelValue': [value: string | boolean] }>();
defineOptions({ inheritAttrs: false });

const inputRef = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
defineExpose({ focus: () => inputRef.value?.focus() });
</script>

<template>
  <label v-if="type === 'checkbox'" class="checkbox-row">
    <input
      ref="inputRef"
      type="checkbox"
      v-bind="$attrs"
      :checked="modelValue as boolean"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    {{ label }}
  </label>
  <div v-else class="form-field" :class="{ grow }">
    <label class="sr-only">{{ label }}</label>
    <select
      v-if="type === 'select'"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options ?? []" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <textarea
      v-else-if="type === 'textarea'"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue as string"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      ref="inputRef"
      :type="type"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.form-field.grow {
  flex: 1;
}
.form-field input,
.form-field select,
.form-field textarea {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.form-field textarea {
  min-height: 4.5rem;
  resize: vertical;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.field-error {
  color: var(--color-destructive);
  font-size: var(--font-size-xs);
  margin-top: 0.2rem;
}
</style>
