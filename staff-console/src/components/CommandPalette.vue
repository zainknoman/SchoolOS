<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Icon, { type IconName } from './AppIcon.vue';

const { t } = useI18n();

interface GoToItem {
  testid: string;
  label: string;
  icon: IconName;
  to: string;
}
interface ActionItem {
  testid: string;
  label: string;
  icon: IconName;
  to: string;
  query?: Record<string, string>;
}
type PaletteItem =
  | ({ group: 'Go to' } & GoToItem)
  | ({ group: 'Actions' } & ActionItem);

const props = defineProps<{
  open: boolean;
  goToItems: GoToItem[];
  actionItems: ActionItem[];
}>();
const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const allItems = computed<PaletteItem[]>(() => [
  ...props.goToItems.map((i) => ({ group: 'Go to' as const, ...i })),
  ...props.actionItems.map((i) => ({ group: 'Actions' as const, ...i })),
]);

const filteredItems = computed<PaletteItem[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return allItems.value;
  return allItems.value.filter((i) => i.label.toLowerCase().includes(q));
});

watch(query, () => {
  selectedIndex.value = 0;
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      query.value = '';
      selectedIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    } else {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
);

function focusableItems(): HTMLElement[] {
  const root = panelRef.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('.cmdk-item'));
}

function activate(item: PaletteItem) {
  if (item.group === 'Actions' && item.query) {
    router.push({ path: item.to, query: item.query });
  } else {
    router.push(item.to);
  }
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (event.key === 'Tab') {
    // Cycles focus between the input and the last item instead of letting Tab escape the
    // dialog to the page behind it.
    const items = focusableItems();
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === inputRef.value) {
        event.preventDefault();
        (items[items.length - 1] ?? inputRef.value)?.focus();
      }
    } else {
      if (active === items[items.length - 1] || (items.length === 0 && active === inputRef.value)) {
        event.preventDefault();
        inputRef.value?.focus();
      }
    }
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (filteredItems.value.length === 0) return;
    selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length;
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (filteredItems.value.length === 0) return;
    selectedIndex.value = (selectedIndex.value - 1 + filteredItems.value.length) % filteredItems.value.length;
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const item = filteredItems.value[selectedIndex.value];
    if (item) activate(item);
  }
}
</script>

<template>
  <div
    v-if="open"
    class="cmdk-overlay"
    data-testid="cmdk-overlay"
    @click.self="emit('close')"
  >
    <div
      ref="panelRef"
      class="cmdk"
      role="dialog"
      aria-modal="true"
      :aria-label="t('shell.commandPalette')"
      @keydown="onKeydown"
    >
      <div class="cmdk-input-row">
        <Icon name="search" :size="16" />
        <input
          ref="inputRef"
          data-testid="cmdk-input"
          v-model="query"
          type="text"
          :placeholder="t('shell.search')"
          autocomplete="off"
          role="combobox"
          aria-expanded="true"
          :aria-activedescendant="
            filteredItems[selectedIndex] ? `cmdk-option-${filteredItems[selectedIndex]!.testid}` : undefined
          "
        />
        <kbd>Esc</kbd>
      </div>
      <div class="cmdk-list" data-testid="cmdk-list" role="listbox">
        <template v-if="filteredItems.length">
          <template v-for="(item, index) in filteredItems" :key="item.testid">
            <div
              v-if="index === 0 || filteredItems[index - 1]?.group !== item.group"
              class="cmdk-group-label"
            >
              {{ item.group }}
            </div>
            <button
              :id="`cmdk-option-${item.testid}`"
              type="button"
              role="option"
              :aria-selected="index === selectedIndex"
              class="cmdk-item"
              :class="{ selected: index === selectedIndex }"
              :data-testid="item.testid"
              @click="activate(item)"
              @mouseenter="selectedIndex = index"
            >
              <Icon :name="item.icon" :size="16" />
              <span>{{ item.label }}</span>
              <span class="cmdk-go">{{ item.group === 'Actions' ? 'Open' : 'Jump ↵' }}</span>
            </button>
          </template>
        </template>
        <div v-else class="cmdk-empty" data-testid="cmdk-empty">No results</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cmdk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 100;
}
.cmdk {
  width: min(560px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.cmdk-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-muted);
  flex-shrink: 0;
}
.cmdk-input-row input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-lg);
}
.cmdk-input-row kbd {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.cmdk-list {
  overflow-y: auto;
  padding: var(--space-1);
}
.cmdk-group-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  font-weight: 700;
  padding: var(--space-2) var(--space-3) var(--space-1);
}
.cmdk-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}
.cmdk-item.selected,
.cmdk-item:hover {
  background: var(--color-muted-bg);
}
.cmdk-go {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}
.cmdk-empty {
  padding: var(--space-4);
  color: var(--color-muted);
  text-align: center;
  font-size: var(--font-size-sm);
}
</style>
