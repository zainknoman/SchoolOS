import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// jsdom's global URL (this project runs tests under `environment: 'jsdom'`) doesn't support the
// two-arg relative-resolution form of the URL constructor against a file: base — `new URL('.',
// import.meta.url)` throws "The URL must be of scheme file" even though the single-arg form and
// Node's own `url`/`path` modules work fine. Deriving the directory via path.dirname() sidesteps
// jsdom's URL implementation entirely.
const thisFile = fileURLToPath(new URL(import.meta.url));
const srcDir = dirname(thisFile);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (/\.(vue|ts)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('no window.confirm usage', () => {
  it('does not reference window.confirm anywhere in src/', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcDir)) {
      if (file === thisFile) continue;
      const content = readFileSync(file, 'utf-8');
      if (content.includes('window.confirm')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
