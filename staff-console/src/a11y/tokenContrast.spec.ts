/// <reference types="node" />
// BL-55: WCAG 2.1 AA colour contrast for the design-token pairs the console actually uses, in
// both themes. jsdom cannot compute rendered colours, so axe's `color-contrast` rule is off in
// the component specs and this spec covers the tokens instead.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(new URL(import.meta.url))), '../assets/base.css'), 'utf-8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found in base.css`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const light = block(':root');
const themes = { light, dark: { ...light, ...block(":root[data-theme='dark']") } };

function hex(tokens: Record<string, string>, name: string): string {
  let value = tokens[name];
  while (value?.startsWith('var(')) value = tokens[value.slice(4, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a plain hex colour: ${value}`);
  return value;
}

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [foreground, background, minimum ratio]. 4.5 = normal text (1.4.3); 3 = UI component
// boundaries and focus indicators (1.4.11).
const PAIRS: [string, string, number][] = [
  ['--color-text', '--color-background', 4.5],
  ['--color-text', '--color-surface', 4.5],
  ['--color-primary', '--color-surface', 4.5],
  ['--color-muted', '--color-surface', 4.5],
  ['--color-muted', '--color-background', 4.5],
  ['--color-muted', '--color-muted-bg', 4.5],
  ['--color-accent', '--color-surface', 4.5],
  ['--color-accent', '--color-background', 4.5],
  ['--color-on-primary', '--color-accent', 4.5],
  ['--color-on-primary', '--color-accent-hover', 4.5],
  ['--color-on-primary', '--color-primary', 4.5],
  ['--color-destructive', '--color-surface', 4.5],
  ['--color-present', '--color-surface', 4.5],
  ['--color-late', '--color-surface', 4.5],
  ['--color-status-success', '--color-status-success-tint', 4.5],
  ['--color-status-warning', '--color-status-warning-tint', 4.5],
  ['--color-status-critical', '--color-status-critical-tint', 4.5],
  ['--color-status-info', '--color-status-info-tint', 4.5],
  ['--color-status-neutral', '--color-status-neutral-tint', 4.5],
  ['--color-ring', '--color-surface', 3],
  ['--color-ring', '--color-background', 3],
  ['--color-control-border', '--color-surface', 3],
  ['--color-control-border', '--color-background', 3],
];

describe('design-token contrast (WCAG 2.1 AA)', () => {
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${theme}: ${fg} on ${bg} >= ${min}:1`, () => {
        expect(contrast(hex(tokens, fg), hex(tokens, bg))).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
