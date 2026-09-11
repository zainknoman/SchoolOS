<script setup lang="ts">
import { computed } from 'vue';

interface SparklineSeries {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

const props = defineProps<{
  labels: string[];
  series: SparklineSeries[];
}>();

const accessibleLabel = computed(() =>
  props.series
    .map((s) => `${s.label}: ${s.values.join(', ')}`)
    .join('. '),
);

const lines = computed(() =>
  props.series.map((s) => {
    const step = s.values.length > 1 ? 100 / (s.values.length - 1) : 0;
    const points = s.values.map((v, i) => ({ x: i * step, y: 100 - v }));
    return {
      ...s,
      pointsAttr: points.map((p) => `${p.x},${p.y}`).join(' '),
      points,
    };
  }),
);
</script>

<template>
  <div class="sparkline">
    <div class="sparkline-chart">
      <div class="sparkline-y-axis">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <svg
        class="sparkline-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        :aria-label="accessibleLabel"
      >
        <polyline
          v-for="line in lines"
          :key="line.label"
          fill="none"
          :style="{ stroke: line.color }"
          stroke-width="1.5"
          :stroke-dasharray="line.dashed ? '2,2' : undefined"
          :points="line.pointsAttr"
        />
        <template v-for="line in lines" :key="`dots-${line.label}`">
          <circle
            v-for="(p, i) in line.points"
            :key="`${line.label}-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="2"
            :style="{ fill: line.color }"
          />
        </template>
      </svg>
    </div>
    <div class="sparkline-x-axis">
      <span v-for="label in labels" :key="label" class="sparkline-x-label">{{ label }}</span>
    </div>
    <div class="sparkline-legend">
      <span v-for="line in lines" :key="line.label" class="legend-item">
        <span class="legend-swatch" :style="{ background: line.color }" />
        {{ line.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.sparkline {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sparkline-chart {
  display: flex;
  gap: var(--space-2);
  height: 200px;
}
.sparkline-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  padding-right: var(--space-2);
  border-right: 1px solid var(--color-border);
}
.sparkline-svg {
  flex: 1;
  width: 100%;
  height: 100%;
}
.sparkline-x-axis {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  padding-left: 3rem;
}
.sparkline-legend {
  display: flex;
  gap: var(--space-4);
  padding-left: 3rem;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.legend-swatch {
  width: 0.75rem;
  height: 0.15rem;
  display: inline-block;
}
</style>
