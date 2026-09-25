// Parsers used by scripts/docs/generate.mjs (BL-66). Zero dependencies, pure functions of file text,
// so they are unit-testable with fixtures (scripts/docs/lib.test.mjs) and reproducible from a clean
// checkout — no local paths, no throwaway scripts.

const HTTP = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);

/** Skips a balanced (...) / {...} / [...] group starting at text[i] (which must be the opener). */
export function skipBalanced(text, i) {
  const open = text[i];
  const close = { '(': ')', '{': '}', '[': ']' }[open];
  let depth = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) return text.length;
      i++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

function strArg(args) {
  const m = /^\s*['"`]([^'"`]*)['"`]/.exec(args ?? '');
  return m ? m[1] : '';
}

function rolesArg(args) {
  return [...(args ?? '').matchAll(/['"`]([A-Z_]+)['"`]/g)].map((m) => m[1]);
}

/**
 * Extracts route handlers from one controller file. Method-level @Roles/@Public override class-level
 * ones (the earlier throwaway scanner missed this — fixture in lib.test.mjs).
 */
export function parseController(text, file) {
  const classIdx = text.search(/export\s+class\s+\w+/);
  if (classIdx < 0) return [];
  const head = text.slice(0, classIdx);
  const headDecorators = scanDecorators(head, 0);
  const controller = headDecorators.find((d) => d.name === 'Controller');
  if (!controller) return [];
  const prefix = strArg(controller.args);
  const classRoles = headDecorators.find((d) => d.name === 'Roles');
  const classPublic = headDecorators.some((d) => d.name === 'Public');
  const classThrottle = headDecorators.some((d) => d.name === 'Throttle');
  // BL-32: @RequiresGrant('X') — ACCOUNTS reaches the route only with grant X.
  const classGrant = headDecorators.find((d) => d.name === 'RequiresGrant');

  const bodyStart = text.indexOf('{', classIdx);
  const body = text.slice(bodyStart + 1);
  const routes = [];
  let i = 0;
  let group = [];
  const n = body.length;
  while (i < n) {
    while (i < n && /\s/.test(body[i])) i++;
    if (i >= n) break;
    if (body.startsWith('//', i)) {
      while (i < n && body[i] !== '\n') i++;
      continue;
    }
    if (body.startsWith('/*', i)) {
      const e = body.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (body[i] === '}') break;
    if (body[i] === '@') {
      const m = /^@(\w+)/.exec(body.slice(i));
      i += m[0].length;
      let args = null;
      if (body[i] === '(') {
        const e = skipBalanced(body, i);
        args = body.slice(i + 1, e - 1);
        i = e;
      }
      group.push({ name: m[1], args });
      continue;
    }
    // a member: modifiers, name, params, return type, body — or a property/field
    const start = i;
    while (i < n && body[i] !== '(' && body[i] !== ';' && body[i] !== '=' && body[i] !== '{' && body[i] !== '\n') i++;
    let isMethod = false;
    if (body[i] === '(') {
      isMethod = true;
      i = skipBalanced(body, i);
      while (i < n && body[i] !== '{' && body[i] !== ';') {
        if (body[i] === '<' || body[i] === '(') {
          i = body[i] === '(' ? skipBalanced(body, i) : i + 1;
        } else i++;
      }
      if (body[i] === '{') i = skipBalanced(body, i);
      else i++;
    } else if (body[i] === '{') {
      i = skipBalanced(body, i);
    } else {
      while (i < n && body[i] !== ';') {
        if (body[i] === '{' || body[i] === '(' || body[i] === '[') i = skipBalanced(body, i);
        else i++;
      }
      i++;
    }
    const http = group.find((d) => HTTP.has(d.name));
    if (isMethod && http) {
      const sub = strArg(http.args);
      const path = '/' + [prefix, sub].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '').replace(/^api\/v1\/?/, '');
      const methodRoles = group.find((d) => d.name === 'Roles');
      const isPublic = group.some((d) => d.name === 'Public') || (classPublic && !methodRoles);
      let roles;
      if (isPublic) roles = 'public';
      else if (methodRoles) roles = rolesArg(methodRoles.args);
      else if (classRoles) roles = rolesArg(classRoles.args);
      else roles = 'any';
      routes.push({
        method: http.name.toUpperCase(),
        path: path === '/' ? '/' : path,
        roles,
        throttle: group.some((d) => d.name === 'Throttle') || classThrottle,
        grant: strArg((group.find((d) => d.name === 'RequiresGrant') ?? classGrant)?.args) || null,
        file,
      });
    }
    group = [];
    if (i === start) i++;
  }
  return routes;
}

function scanDecorators(text, from) {
  const out = [];
  let i = from;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at < 0) break;
    const m = /^@(\w+)/.exec(text.slice(at));
    if (!m) {
      i = at + 1;
      continue;
    }
    i = at + m[0].length;
    let args = null;
    if (text[i] === '(') {
      const e = skipBalanced(text, i);
      args = text.slice(i + 1, e - 1);
      i = e;
    }
    out.push({ name: m[1], args });
  }
  return out;
}

/** Parses schema.prisma into models (ordered fields + block attributes) and enums. */
export function parsePrisma(text) {
  const enums = [];
  const models = [];
  const re = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(text))) {
    const [, kind, name, body] = m;
    if (kind === 'enum') {
      enums.push({
        name,
        values: body
          .split('\n')
          .map((l) => l.replace(/\/\/.*$/, '').trim())
          .filter((l) => l && !l.startsWith('@@')),
      });
    } else {
      const fields = [];
      const blockAttrs = [];
      for (const raw of body.split('\n')) {
        const line = raw.replace(/\/\/.*$/, '').trim();
        if (!line) continue;
        if (line.startsWith('@@')) {
          blockAttrs.push(line);
          continue;
        }
        const fm = /^(\w+)\s+([A-Za-z_]\w*)(\?|\[\])?\s*(.*)$/.exec(line);
        if (!fm) continue;
        fields.push({ name: fm[1], type: fm[2], mod: fm[3] ?? '', attrs: fm[4].trim() });
      }
      models.push({ name, fields, blockAttrs });
    }
  }
  return { models, enums };
}

/** Relation edges (owning side only): child → parent with onDelete and optionality. */
export function relationEdges(model, modelNames) {
  const edges = [];
  for (const f of model.fields) {
    if (!modelNames.has(f.type)) continue;
    const rel = /@relation\(([\s\S]*)\)/.exec(f.attrs);
    if (!rel || !/fields:\s*\[/.test(rel[1])) continue;
    const od = /onDelete:\s*(\w+)/.exec(rel[1]);
    edges.push({
      from: model.name,
      to: f.type,
      onDelete: od ? od[1] : 'default',
      optional: f.mod === '?',
    });
  }
  return edges;
}

/** Counts statements in a migration.sql (used for the generated MIGRATIONS inventory). */
export function summariseMigration(sql) {
  const count = (re) => (sql.match(re) || []).length;
  return {
    lines: sql.split('\n').length,
    createTable: count(/^CREATE TABLE/gim),
    alterTable: count(/^ALTER TABLE/gim),
    createIndex: count(/^CREATE (UNIQUE )?INDEX/gim),
    createType: count(/^CREATE TYPE/gim),
    drops: count(/^\s*DROP (TABLE|COLUMN)|DROP COLUMN/gim),
    dml: count(/^\s*(INSERT|UPDATE|DELETE)\b/gim),
  };
}

/** Counts test blocks in a spec file. */
export function countTests(text) {
  // `pending(` = BL-18 failing-first tests (backend/test/pending, an alias of it.failing)
  return (text.match(/^\s*(it|test|pending)(\.each\([^)]*\)|\.failing)?\(/gm) || []).length;
}
