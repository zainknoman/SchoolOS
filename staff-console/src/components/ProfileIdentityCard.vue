<!-- staff-console/src/components/ProfileIdentityCard.vue -->
<!-- The shared identity header for detail-page profiles (Student, Staff): a photo, name/status,
     and a quick-facts row derived from data already on the profile. Collapses to a compact
     single-line strip while the profile is being edited, matching the edit form's own "Editing"
     state instead of showing stats that don't apply while mid-edit. Domain-specific formatting
     (e.g. "Grade 9 · Section B", "Roll No. 14", "Teacher") is the caller's job — this component
     only lays out whatever tags/labels it's given. -->
<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';
import Button from './Button.vue';
import StatusPill from './StatusPill.vue';

withDefaults(
  defineProps<{
    name: string;
    initials: string;
    photoUrl: string | null;
    photoLabel: string;
    isSavingPhoto: boolean;
    /** Shown above the name so the org context is visible without scrolling or switching tabs. */
    schoolName?: string | null;
    /** e.g. "MAIN - Main Campus" (campus code, then name). */
    campusLabel?: string | null;
    /** A short identifying chip next to the name, e.g. a GR number. Omit if none applies. */
    idChip?: string | null;
    /** e.g. "Grade 9 · Section B" for a student, "Teacher" for a staff member. */
    subtitleTag?: string | null;
    /** e.g. "Roll No. 14" — a second, dot-separated tag after subtitleTag. */
    secondaryTag?: string | null;
    statusLabel: string;
    statusTone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
    ageLabel: string | null;
    tenureLabel: string | null;
    contactsLabel: string;
    documentsLabel: string;
    compact?: boolean;
  }>(),
  { compact: false, schoolName: null, campusLabel: null, idChip: null, subtitleTag: null, secondaryTag: null },
);

const emit = defineEmits<{ 'edit-profile': []; 'photo-file-change': [Event] }>();

const photoInputRef = ref<HTMLInputElement | null>(null);

function triggerPhotoInput() {
  photoInputRef.value?.click();
}

function onFileChange(event: Event) {
  emit('photo-file-change', event);
}
</script>

<template>
  <div class="identity-card" :class="{ compact }">
    <div class="identity-avatar-wrap" :class="{ compact }">
      <button
        type="button"
        class="identity-avatar"
        data-testid="profile-photo-trigger"
        :disabled="isSavingPhoto"
        @click="triggerPhotoInput"
      >
        <img v-if="photoUrl" :src="photoUrl" alt="" class="identity-avatar-img" />
        <template v-else>{{ initials }}</template>
      </button>
      <span v-if="!compact" class="identity-avatar-badge" aria-hidden="true">
        <AppIcon name="camera" :size="14" />
      </span>
      <label class="sr-only" for="profile-photo-input">{{ photoLabel }}</label>
      <input
        id="profile-photo-input"
        ref="photoInputRef"
        type="file"
        accept="image/*"
        class="sr-only"
        data-testid="profile-photo-input"
        @change="onFileChange"
      />
    </div>

    <div class="identity-main">
      <div v-if="schoolName || campusLabel" class="identity-org" data-testid="profile-org">
        <span v-if="schoolName" class="identity-school">{{ schoolName }}</span>
        <span v-if="schoolName && campusLabel" class="identity-dot" aria-hidden="true">·</span>
        <span v-if="campusLabel" class="identity-campus">{{ campusLabel }}</span>
      </div>
      <template v-if="compact">
        <div class="identity-name-row">
          <span class="identity-name-compact">{{ name }}</span>
          <span v-if="idChip || subtitleTag" class="identity-meta-compact mono">
            {{ [idChip, subtitleTag].filter(Boolean).join(' · ') }}
          </span>
        </div>
      </template>
      <template v-else>
        <div class="identity-name-row">
          <h1>{{ name }}</h1>
          <StatusPill :tone="statusTone" :label="statusLabel" />
        </div>
        <div class="identity-tags-row">
          <span v-if="idChip" class="identity-gr mono">{{ idChip }}</span>
          <template v-if="subtitleTag">
            <span class="identity-muted">{{ subtitleTag }}</span>
          </template>
          <template v-if="secondaryTag">
            <span class="identity-dot" aria-hidden="true">·</span>
            <span class="identity-muted">{{ secondaryTag }}</span>
          </template>
        </div>
        <div class="identity-stats-row">
          <span v-if="ageLabel" class="identity-stat">
            <AppIcon name="calendar" :size="15" />
            <span class="mono">{{ ageLabel }}</span>
          </span>
          <span v-if="tenureLabel" class="identity-stat">
            <AppIcon name="home" :size="15" />
            <span class="mono">{{ tenureLabel }}</span>
          </span>
          <span class="identity-stat">
            <AppIcon name="users" :size="15" />
            <span class="mono">{{ contactsLabel }}</span>
          </span>
          <span class="identity-stat">
            <AppIcon name="file-text" :size="15" />
            <span class="mono">{{ documentsLabel }}</span>
          </span>
        </div>
      </template>
    </div>

    <span v-if="compact" class="identity-editing-pill">Editing</span>
    <Button v-else data-testid="edit-profile-header" @click="emit('edit-profile')">
      <AppIcon name="edit" :size="14" />
      Edit profile
    </Button>
  </div>
</template>

<style scoped>
.identity-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.identity-card.compact {
  align-items: center;
  padding: var(--space-3) var(--space-5);
}

.identity-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.identity-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xl);
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  box-shadow: 0 0 0 3px var(--color-surface), 0 0 0 5px var(--color-accent);
}
.identity-avatar-wrap.compact .identity-avatar {
  width: 3.75rem;
  height: 3.75rem;
  font-size: var(--font-size-lg);
  box-shadow: 0 0 0 3px var(--color-surface), 0 0 0 4px var(--color-accent);
}
.identity-avatar:disabled {
  cursor: default;
  opacity: 0.7;
}
.identity-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.identity-avatar-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.identity-main {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.identity-org {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--font-size-sm);
}
.identity-school {
  font-weight: 700;
  color: var(--color-primary);
}
.identity-campus {
  color: var(--color-muted);
}
.identity-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.identity-name-row h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
}
.identity-name-compact {
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--color-primary);
}
.identity-meta-compact {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.identity-tags-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--font-size-sm);
}
.identity-gr {
  background: var(--color-muted-bg);
  color: var(--color-text);
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: var(--radius-full);
}
.identity-muted,
.identity-dot {
  color: var(--color-muted);
}
.identity-stats-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-top: 0.15rem;
  color: var(--color-muted);
}
.identity-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--font-size-sm);
}
.identity-editing-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.65rem;
  border-radius: var(--radius-full);
  background: var(--color-status-info-tint);
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 700;
}
.mono {
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}
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

@media (max-width: 768px) {
  .identity-card {
    flex-wrap: wrap;
  }
  .identity-stats-row {
    gap: var(--space-2) var(--space-3);
  }
}
@media (max-width: 480px) {
  .identity-card:not(.compact) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .identity-card:not(.compact) .identity-name-row,
  .identity-card:not(.compact) .identity-tags-row,
  .identity-card:not(.compact) .identity-stats-row {
    justify-content: center;
  }
  .identity-card:not(.compact) [data-testid='edit-profile-header'] {
    width: 100%;
    justify-content: center;
  }
}
</style>
