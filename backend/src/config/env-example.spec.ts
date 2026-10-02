import * as fs from 'fs';
import * as path from 'path';

/**
 * KI-6: every environment variable the API reads must appear in `.env.example` (set, or commented
 * out with an explanation), so a deployment cannot miss one that is only discoverable in code.
 */
const SRC = path.join(__dirname, '..');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

function readVariables(): Set<string> {
  const names = new Set<string>();
  for (const file of files(SRC)) {
    // Comments may mention example names (e.g. `process.env.X`); only code counts.
    const code = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(
      /process\.env\.([A-Z][A-Z0-9_]+)|\b(?:get|getOrThrow)(?:<[^>]+>)?\(\s*'([A-Z][A-Z0-9_]+)'/g,
    )) {
      names.add(m[1] ?? m[2]);
    }
  }
  return names;
}

describe('.env.example (KI-6)', () => {
  const example = fs.readFileSync(path.join(SRC, '..', '.env.example'), 'utf8');
  const documented = new Set(
    [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]),
  );

  it('lists every environment variable the API reads', () => {
    const missing = [...readVariables()].filter((n) => !documented.has(n));
    expect(missing.sort()).toEqual([]);
  });
});
