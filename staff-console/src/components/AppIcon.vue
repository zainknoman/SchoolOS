<script setup lang="ts">
// Outline-style SVG icons (Phosphor "regular" visual language), 20px, currentColor stroke.
// No emoji, no icon-library dependency — this project doesn't have one yet (MASTER.md).
// Exported (previously local-only) so CommandPalette.vue and AppShell.vue can import this exact
// union instead of redeclaring it — one source of truth for which icon names exist.
export type IconName =
  | 'home'
  | 'calendar'
  | 'notebook'
  | 'clock'
  | 'chat'
  | 'users'
  | 'user-circle'
  | 'chalkboard'
  | 'grid'
  | 'megaphone'
  | 'receipt'
  | 'logout'
  | 'bell'
  | 'warning'
  | 'search'
  | 'sun'
  | 'moon';

defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'home'">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </template>
    <template v-else-if="name === 'notebook'">
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 3v18M9 8h7M9 12h7M9 16h5" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
    <template v-else-if="name === 'chat'">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M16 14.2c2.4.4 4 2.6 4 5.8" />
    </template>
    <template v-else-if="name === 'user-circle'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M6.5 18.5c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4" />
    </template>
    <template v-else-if="name === 'chalkboard'">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.2" />
    </template>
    <template v-else-if="name === 'megaphone'">
      <path d="M3 10v4l4 1 8 4V5L7 9l-4 1Z" />
      <path d="M17 9a3 3 0 0 1 0 6" />
    </template>
    <template v-else-if="name === 'receipt'">
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 16l4-4-4-4M8 12h11" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3a3.2 3.2 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 10v4M12 16.5v.01" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
    </template>
  </svg>
</template>
