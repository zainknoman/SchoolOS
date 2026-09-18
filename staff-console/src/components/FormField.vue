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
    /** Small muted helper line — under the label for most types, under the checkbox text itself. */
    hint?: string;
    /** Renders the input in the app's monospace face, for IDs/dates/phone numbers. */
    mono?: boolean;
  }>(),
  { grow: false },
);
defineEmits<{ 'update:modelValue': [value: string | boolean] }>();
defineOptions({ inheritAttrs: false });

const inputRef = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
defineExpose({ focus: () => inputRef.value?.focus() });
</script>

<template>
  <label v-if="type === 'checkbox'" class="checkbox-row" :class="{ bordered: !!hint }">
    <input
      ref="inputRef"
      type="checkbox"
      v-bind="$attrs"
      :checked="modelValue as boolean"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span v-if="hint" class="checkbox-text">
      <span class="checkbox-title">{{ label }}</span>
      <span class="checkbox-hint">{{ hint }}</span>
    </span>
    <template v-else>{{ label }}</template>
  </label>
  <div v-else class="form-field" :class="{ grow }">
    <label class="sr-only">{{ label }}</label>
    <select
      v-if="type === 'select'"
      ref="inputRef"
      v-bind="$attrs"
      :class="{ mono }"
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
      :class="{ mono }"
      :value="modelValue as string"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      ref="inputRef"
      :type="type"
      v-bind="$attrs"
      :class="{ mono }"
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
.checkbox-row.bordered {
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.checkbox-row.bordered input {
  margin-top: 0.2rem;
}
.checkbox-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.checkbox-title {
  font-weight: 600;
}
.checkbox-hint {
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}
.form-field .mono {
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}
.field-error {
  color: var(--color-destructive);
  font-size: var(--font-size-xs);
  margin-top: 0.2rem;
}
</style>
