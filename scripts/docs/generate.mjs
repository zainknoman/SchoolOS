#!/usr/bin/env node
// BL-66 — reproducible documentation generators.
//   node scripts/docs/generate.mjs           regenerate the generated docs in place
//   node scripts/docs/generate.mjs --check   exit 1 if any generated doc drifted (used by CI)
// Inputs are read only from the repository (controllers, schema.prisma, migrations, spec files).
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseController, parsePrisma, relationEdges, summariseMigration, countTests } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const check = process.argv.includes('--check');

const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const walk = (dir, pred, out = []) => {
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    if (name === 'node_modules' || name === 'dist' || name === 'build' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, pred, out);
    else if (pred(rel)) out.push(rel);
  }
  return out;
};

// ------------------------------------------------------------------ endpoints
function renderEndpoints() {
  const files = walk('backend/src', (f) => f.endsWith('.controller.ts'));
  const routes = files.flatMap((f) => parseController(rd(f), f.replace('backend/src/', '')));
  const groupOf = (path) => {
    if (path === '/') return '(root)';
    const seg = path.split('/').filter(Boolean);
    return seg[0] === 'admin' && seg[1] ? `admin/${seg[1]}` : seg[0];
  };
  const groups = new Map();
  for (const r of routes) {
    const g = groupOf(r.path);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '(root)' ? -1 : b === '(root)' ? 1 : a < b ? -1 : a > b ? 1 : 0));
  const roleCell = (r) => (r.roles === 'public' ? '**public**' : r.roles === 'any' ? 'any authenticated (service-scoped)' : r.roles.join(', '));
  let out = [
    '# Endpoint Reference',
    '',
    '> **Status:** CURRENT · **Generated** by `scripts/docs/generate.mjs` (BL-66) from every `backend/src/**/*.controller.ts` — **do not edit by hand**; regenerate with `node scripts/docs/generate.mjs` (CI runs `--check`) · **Sources:** `@Controller` + `@Get/@Post/@Put/@Patch/@Delete` + `@Roles/@Public/@Throttle`; method-level `@Roles`/`@Public` override class-level ones · **Owner:** Engineering Lead',
    '> All paths are prefixed with `/api/v1`. **Roles** = the `@Roles(...)` decorator (`RolesGuard` does an exact `includes(user.role)` check — SUPER_ADMIN has **no implicit override**). "any authenticated (service-scoped)" = no decorator: every logged-in role passes the guard and the **service** decides by scope (see [AUTHORIZATION](AUTHORIZATION.md)). `T` = route-level throttle decorator (auth routes, 5/min); all routes also fall under the global 100/min limit.',
    `> Total: **${routes.length}** route handlers in ${files.length} controllers.`,
    '',
  ].join('\n');
  for (const k of keys) {
    const note =
      k === '(root)'
        ? '`GET /` returns the static string "Hello World!" (`app.service.ts`). It is public but **is not a health check** (it does not touch the database).\n\n'
        : '';
    out += `\n## ${k}\n\n${note}| Method | Path | Roles | T | Controller |\n|---|---|---|---|---|\n`;
    for (const r of groups.get(k)) out += `| ${r.method} | \`${r.path}\` | ${roleCell(r)} | ${r.throttle ? 'T' : ''} | \`${r.file}\` |\n`;
  }
  return out;
}

// ------------------------------------------------------------------ schema docs
function loadSchema() {
  const schema = parsePrisma(rd('backend/prisma/schema.prisma'));
  const domains = JSON.parse(rd('scripts/docs/domains.json')).domains;
  const byName = new Map(schema.models.map((m) => [m.name, m]));
  const listed = new Set(domains.flatMap((d) => d.models));
  const missing = schema.models.filter((m) => !listed.has(m.name)).map((m) => m.name);
  const stale = [...listed].filter((n) => !byName.has(n));
  if (missing.length || stale.length) {
    console.error(`scripts/docs/domains.json out of date. Missing models: ${missing.join(', ') || '-'}; unknown models: ${stale.join(', ') || '-'}`);
    process.exit(1);
  }
  return { schema, domains, byName };
}

function renderDictionary() {
  const { schema, domains, byName } = loadSchema();
  const names = new Set(byName.keys());
  const enums = new Set(schema.enums.map((e) => e.name));
  let out = [
    '# Data Dictionary',
    '',
    `> **Status:** CURRENT · **Generated** by \`scripts/docs/generate.mjs\` (BL-66) from \`backend/prisma/schema.prisma\`: **${schema.models.length} models, ${schema.enums.length} enums** — do not edit by hand · **Owner:** Engineering Lead`,
    '> Columns: field · type (`?` nullable, `[]` list) · attributes as written in the schema (relations show `fields`, `references`, `onDelete`). Fields whose type is another model are relation fields (no column).',
    '',
    '## Enums',
    '',
    schema.enums.map((e) => `- **${e.name}**: ${e.values.join(', ')}`).join('\n'),
    '',
  ].join('\n');
  for (const d of domains) {
    out += `\n## ${d.name}\n`;
    for (const mn of d.models) {
      const m = byName.get(mn);
      out += `\n### ${m.name}\n\n| Field | Type | Attributes |\n|---|---|---|\n`;
      for (const f of m.fields) {
        const t = `${f.type}${f.mod}` + (names.has(f.type) ? ' (relation)' : enums.has(f.type) ? ' (enum)' : '');
        out += `| ${f.name} | ${t} | ${f.attrs.replace(/\|/g, '\\|')} |\n`;
      }
      if (m.blockAttrs.length) out += `\nBlock attributes: ${m.blockAttrs.map((a) => `\`${a}\``).join(' · ')}\n`;
    }
  }
  return out;
}

function renderErd() {
  const { schema, domains, byName } = loadSchema();
  const names = new Set(byName.keys());
  let out = [
    '# Entity Relationships',
    '',
    '> **Status:** CURRENT · **Generated** by `scripts/docs/generate.mjs` (BL-66) from `schema.prisma` (edges: child → parent for every owning-side `@relation`) — do not edit by hand · **Owner:** Engineering Lead',
    '> Edge label = `onDelete` (`default` = Prisma default); `optional` = nullable foreign key. Cross-domain parents appear as plain nodes.',
    '',
  ].join('\n');
  for (const d of domains) {
    out += `\n## ${d.name}\n\n\`\`\`mermaid\nflowchart LR\n`;
    const inDomain = new Set(d.models);
    for (const m of schema.models.filter((x) => inDomain.has(x.name))) {
      for (const e of relationEdges(m, names)) out += `  ${e.from} -->|${e.onDelete}${e.optional ? ', optional' : ''}| ${e.to}\n`;
    }
    out += '```\n';
  }
  return out;
}

// ------------------------------------------------------------------ marker blocks
function renderMigrationsBlock() {
  const dirs = readdirSync(join(ROOT, 'backend/prisma/migrations')).filter((n) => /^\d{14}_/.test(n)).sort();
  let rows = '| # | Migration | Lines | CREATE TABLE | ALTER TABLE | CREATE INDEX | CREATE TYPE | DROP TABLE/COLUMN | INSERT/UPDATE/DELETE |\n|---|---|---|---|---|---|---|---|---|\n';
  let drops = 0;
  let dml = 0;
  dirs.forEach((d, i) => {
    const s = summariseMigration(rd(`backend/prisma/migrations/${d}/migration.sql`));
    drops += s.drops;
    dml += s.dml;
    rows += `| ${i + 1} | \`${d}\` | ${s.lines} | ${s.createTable} | ${s.alterTable} | ${s.createIndex} | ${s.createType} | ${s.drops} | ${s.dml} |\n`;
  });
  return `Generated inventory of \`backend/prisma/migrations\`: **${dirs.length} migrations**, ${drops} DROP TABLE/COLUMN statements, ${dml} data-changing statements (INSERT/UPDATE/DELETE).\n\n${rows}`;
}

function renderModelIndexBlock() {
  const { schema, domains } = loadSchema();
  return `Generated model index (${schema.models.length} models, ${schema.enums.length} enums):\n\n${domains.map((d) => `- **${d.name}** (${d.models.length}): ${d.models.join(', ')}`).join('\n')}\n`;
}

function renderTestInventoryBlock() {
  const unit = walk('backend/src', (f) => f.endsWith('.spec.ts'));
  const e2e = walk('backend/test', (f) => f.endsWith('.e2e-spec.ts'));
  const consoleSpecs = walk('staff-console/src', (f) => /\.spec\.ts$/.test(f));
  const flutter = existsSync(join(ROOT, 'parent-app/test')) ? walk('parent-app/test', (f) => f.endsWith('_test.dart')) : [];
  const sum = (files) => files.reduce((a, f) => a + countTests(rd(f)), 0);
  const e2eRows = e2e.map((f) => `| \`${f.replace('backend/test/', '')}\` | ${countTests(rd(f))} |`).join('\n');
  return [
    'Generated suite inventory (file and `it/test` block counts by grep — **not** executed results; executed counts are in [TESTING-STRATEGY](TESTING-STRATEGY.md)):',
    '',
    '| Suite | Files | Test blocks |',
    '|---|---|---|',
    `| Backend unit (\`backend/src/**/*.spec.ts\`) | ${unit.length} | ${sum(unit)} |`,
    `| Backend e2e (\`backend/test/*.e2e-spec.ts\`) | ${e2e.length} | ${sum(e2e)} |`,
    `| Staff console (\`staff-console/src/**/*.spec.ts\`) | ${consoleSpecs.length} | ${sum(consoleSpecs)} |`,
    `| Parent app (\`parent-app/test/**/*_test.dart\`) | ${flutter.length} | — |`,
    '',
    '| Backend e2e spec | Test blocks |',
    '|---|---|',
    e2eRows,
    '',
  ].join('\n');
}

function withBlock(doc, name, content, heading) {
  const begin = `<!-- GENERATED:BEGIN ${name} -->`;
  const end = `<!-- GENERATED:END ${name} -->`;
  const block = `${begin}\n${content.trimEnd()}\n${end}`;
  if (doc.includes(begin)) {
    const a = doc.indexOf(begin);
    const b = doc.indexOf(end) + end.length;
    return doc.slice(0, a) + block + doc.slice(b);
  }
  return `${doc.trimEnd()}\n\n${heading}\n\n${block}\n`;
}

// ------------------------------------------------------------------ run
const outputs = [
  { path: 'docs/api/ENDPOINTS.md', whole: renderEndpoints() },
  { path: 'docs/database/DATA-DICTIONARY.md', whole: renderDictionary() },
  { path: 'docs/database/ERD.md', whole: renderErd() },
  { path: 'docs/database/MIGRATIONS.md', block: ['migrations', renderMigrationsBlock(), '## Generated migration inventory (BL-66)'] },
  { path: 'docs/database/DATA-MODEL.md', block: ['model-index', renderModelIndexBlock(), '## Generated model index (BL-66)'] },
  { path: 'docs/testing/TEST-MATRIX.md', block: ['test-inventory', renderTestInventoryBlock(), '## Generated test inventory (BL-66)'] },
];

let drift = 0;
for (const o of outputs) {
  const abs = join(ROOT, o.path);
  const current = existsSync(abs) ? readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : '';
  const next = o.whole !== undefined ? o.whole : withBlock(current, ...o.block);
  if (next !== current) {
    drift++;
    if (check) console.error(`DRIFT: ${o.path} is out of date — run: node scripts/docs/generate.mjs`);
    else writeFileSync(abs, next);
  }
}
if (check) {
  if (drift) process.exit(1);
  console.log('docs:check OK — generated docs are up to date');
} else console.log(`docs:generate done — ${drift} file(s) updated of ${outputs.length}`);
