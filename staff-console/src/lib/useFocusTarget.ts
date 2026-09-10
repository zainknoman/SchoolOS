import { onMounted, type Ref } from 'vue';
import { useRoute } from 'vue-router';

interface Focusable {
  focus(): void;
}

// The command palette's "Actions" deep-link into a specific input via a `?focus=<id>` query
// param — the same low-tech convention MessagesView.vue already uses for `?conversationId=`.
// Call this once per view with a map of focus-id -> template ref; on mount, if the current
// route's `focus` query matches a key, that element is focused. Does nothing on a normal,
// non-deep-linked page load, and does nothing if the id doesn't match (e.g. the ref hasn't
// rendered yet because a v-if guards it). Targets may be raw HTMLElements or anything that
// exposes a focus() method (e.g. a FormField instance via defineExpose).
export function useFocusTarget(targets: Record<string, Ref<Focusable | null>>): void {
  const route = useRoute();

  onMounted(() => {
    const focusId = route.query.focus;
    if (typeof focusId !== 'string') return;
    targets[focusId]?.value?.focus();
  });
}
