import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { SCOPED_RECORD_KEY } from './record-scope.guard';
import {
  NO_SCHOOL_DATA,
  SCOPE_CHECK_KEY,
  SELF,
  SHARED_IDENTITY,
} from './scope-check.decorator';

/**
 * KG-16: every route that takes caller input must state how it is confined to the caller's
 * school/campus — `@ScopedRecord` (enforced by RecordScopeGuard) for the URL parameter it names,
 * or `@ScopeCheck(...)` naming the function that checks. Public routes and SUPER_ADMIN-only routes
 * are exempt. This does not prove the named check is correct (the e2e suites do that); it stops a
 * route from shipping with no check at all, which is how hiring, admissions and the timetable did.
 */
const SRC = path.join(__dirname, '..');
const INPUT = new Set<number>([
  RouteParamtypes.BODY,
  RouteParamtypes.QUERY,
  RouteParamtypes.PARAM,
  RouteParamtypes.FILE,
  RouteParamtypes.FILES,
]);

function files(dir: string, suffix: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p, suffix);
    return e.name.endsWith(suffix) && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

const source = files(SRC, '.ts')
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');
const defined = (name: string) =>
  new RegExp(
    `(function\\s+${name}\\b|\\n\\s+(?:private\\s+|public\\s+|protected\\s+)?(?:async\\s+)?${name}\\s*[(<])`,
  ).test(source);

interface Route {
  route: string;
  roles: string[] | undefined;
  isPublic: boolean;
  hasInput: boolean;
  scopedParam: string | undefined;
  checks: string[] | undefined;
}

function routes(): Route[] {
  const out: Route[] = [];
  for (const file of files(SRC, '.controller.ts')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const cls of Object.values(mod)) {
      if (typeof cls !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, cls) as
        string | undefined;
      if (base === undefined) continue;
      const proto = (cls as { prototype: Record<string, unknown> }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, handler) as
          number | undefined;
        if (verb === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const meta = <T>(key: string) =>
          (Reflect.getMetadata(key, handler) ??
            Reflect.getMetadata(key, cls)) as T | undefined;
        // Nest keys a handler's argument metadata as '<paramtype>:<index>' on (class, method).
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, cls, name) ??
          {}) as Record<string, unknown>;
        const types = Object.keys(args).map((k) => Number(k.split(':')[0]));
        out.push({
          route: `${path.relative(SRC, file).replace(/\\/g, '/')} ${name} → ${base}/${sub}`,
          roles: meta<string[]>(ROLES_KEY),
          isPublic: meta<boolean>(IS_PUBLIC_KEY) === true,
          hasInput: types.some((t) => INPUT.has(t)),
          scopedParam: meta<{ param: string }>(SCOPED_RECORD_KEY)?.param,
          checks: meta<string[]>(SCOPE_CHECK_KEY),
        });
      }
    }
  }
  return out;
}

describe('route scope declarations (KG-16)', () => {
  const all = routes();
  const relevant = all.filter(
    (r) =>
      r.hasInput &&
      !r.isPublic &&
      !(r.roles?.length === 1 && r.roles[0] === 'SUPER_ADMIN'),
  );

  it('finds the controllers', () => {
    expect(all.length).toBeGreaterThan(200);
    expect(relevant.length).toBeGreaterThan(100);
  });

  it('every non-public route with caller input declares its scope check', () => {
    const missing = relevant
      .filter((r) => {
        const guarded =
          r.scopedParam !== undefined && r.route.includes(`:${r.scopedParam}`);
        return !guarded && !r.checks?.length;
      })
      .map((r) => r.route);
    expect(missing).toEqual([]);
  });

  it('every declared check names a function that exists', () => {
    const unknown = all.flatMap((r) =>
      (r.checks ?? [])
        .filter((c) => ![SELF, NO_SCHOOL_DATA, SHARED_IDENTITY].includes(c))
        .filter((c) => !defined(c.split('.').pop()!))
        .map((c) => `${r.route}: ${c}`),
    );
    expect(unknown).toEqual([]);
  });
});
