// Run with: node --test scripts/docs/lib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseController, parsePrisma, relationEdges, summariseMigration, countTests } from './lib.mjs';

const controller = (body, head = '') => `
import { Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
${head}
@Controller('api/v1/widgets')
export class WidgetsController {
  constructor(private readonly svc: Svc) {}
${body}
}
`;

test('class-level @Roles applies to handlers without their own @Roles', () => {
  const src = controller(
    "  @Get()\n  list() { return []; }\n  @Get(':id')\n  one(@Param('id') id: string) { return id; }",
    "@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')",
  );
  const r = parseController(src, 'widgets/widgets.controller.ts');
  assert.deepEqual(r.map((x) => [x.method, x.path, x.roles]), [
    ['GET', '/widgets', ['SCHOOL_ADMIN', 'SUPER_ADMIN']],
    ['GET', '/widgets/:id', ['SCHOOL_ADMIN', 'SUPER_ADMIN']],
  ]);
});

test('REGRESSION: method-level @Roles overrides the class-level @Roles (earlier scanner missed this)', () => {
  const src = controller(
    "  @Roles('TEACHER')\n  @Post()\n  create() {}\n  @Get()\n  list() {}",
    "@Roles('SCHOOL_ADMIN')",
  );
  const r = parseController(src, 'w.controller.ts');
  assert.deepEqual(r.map((x) => x.roles), [['TEACHER'], ['SCHOOL_ADMIN']]);
});

test('BL-32: class- or method-level @RequiresGrant is recorded per route', () => {
  const src = controller("  @Get()\n  a() {}\n  @RequiresGrant('MESSAGES')\n  @Get('m')\n  b() {}", "@RequiresGrant('ADMISSIONS')");
  const r = parseController(src, 'w.controller.ts');
  assert.deepEqual(r.map((x) => x.grant), ['ADMISSIONS', 'MESSAGES']);
  assert.equal(parseController(controller('  @Get()\n  a() {}'), 'w.controller.ts')[0].grant, null);
});

test('no decorator means any authenticated user; @Public means public', () => {
  const src = controller("  @Get()\n  a() {}\n  @Public()\n  @Get('open')\n  b() {}");
  const r = parseController(src, 'w.controller.ts');
  assert.deepEqual(r.map((x) => x.roles), ['any', 'public']);
});

test('multi-line decorators, parameter decorators and bodies with braces do not confuse the scanner', () => {
  const src = controller(
    "  @Post('upload')\n  @UseInterceptors(\n    FileInterceptor('file', { limits: { fileSize: 10 } }),\n  )\n  async up(@UploadedFile() f: File, @Body() b: { a: string }) {\n    if (f) { return { ok: true }; }\n    const s = '}';\n  }\n  @Get('next')\n  next() {}",
  );
  const r = parseController(src, 'w.controller.ts');
  assert.deepEqual(r.map((x) => `${x.method} ${x.path}`), ['POST /widgets/upload', 'GET /widgets/next']);
});

test('@Throttle marks the route', () => {
  const src = controller("  @Throttle({ default: { limit: 5, ttl: 60000 } })\n  @Post('login')\n  login() {}");
  assert.equal(parseController(src, 'w.controller.ts')[0].throttle, true);
});

test('files without @Controller yield no routes', () => {
  assert.deepEqual(parseController('export class Foo { @Get() a() {} }', 'x.ts'), []);
});

const SCHEMA = `
enum Role {
  A
  B
}
model Parent {
  id String @id
  kids Kid[]
}
model Kid {
  id       String  @id
  parentId String?
  parent   Parent? @relation(fields: [parentId], references: [id], onDelete: SetNull)
  role     Role
  note     String? // trailing comment
  @@index([parentId])
}
`;

test('parsePrisma extracts models, enums, block attributes and strips comments', () => {
  const s = parsePrisma(SCHEMA);
  assert.deepEqual(s.enums, [{ name: 'Role', values: ['A', 'B'] }]);
  assert.equal(s.models.length, 2);
  const kid = s.models[1];
  assert.deepEqual(kid.blockAttrs, ['@@index([parentId])']);
  assert.equal(kid.fields.find((f) => f.name === 'note').attrs, '');
  assert.equal(kid.fields.find((f) => f.name === 'parent').mod, '?');
});

test('relationEdges reports owning-side relations with onDelete and optionality', () => {
  const s = parsePrisma(SCHEMA);
  const names = new Set(s.models.map((m) => m.name));
  assert.deepEqual(relationEdges(s.models[1], names), [{ from: 'Kid', to: 'Parent', onDelete: 'SetNull', optional: true }]);
  assert.deepEqual(relationEdges(s.models[0], names), []);
});

test('summariseMigration counts DDL and flags destructive/data statements', () => {
  const sql = 'CREATE TABLE "a" ();\nALTER TABLE "a" ADD COLUMN x int;\nCREATE UNIQUE INDEX i ON a(x);\nUPDATE a SET x = 1;\nALTER TABLE "a" DROP COLUMN y;';
  const s = summariseMigration(sql);
  assert.equal(s.createTable, 1);
  assert.equal(s.alterTable, 2);
  assert.equal(s.createIndex, 1);
  assert.equal(s.dml, 1);
  assert.equal(s.drops, 1);
});

test('countTests counts pending and it.failing blocks (BL-18)', () => {
  assert.equal(countTests("  pending('a', async () => {});\n  it.failing('b', () => {});\n  const pendingX = 1;"), 2);
});

test('countTests counts it/test blocks', () => {
  assert.equal(countTests("describe('x', () => {\n  it('a', () => {});\n  test('b', () => {});\n  it.each([1])('c', () => {});\n});"), 3);
});
