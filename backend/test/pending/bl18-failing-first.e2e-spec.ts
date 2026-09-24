import request from 'supertest';
import { createTwoSchools, pending, TwoSchools } from './two-school-fixture';

/**
 * BL-18 scaffold: failing-first e2e tests for BL-23 (BL-01 graduated to test/school-sessions.e2e-spec.ts; BL-20 graduated to test/school-anchors.e2e-spec.ts; BL-64 graduated to test/account-access.e2e-spec.ts; BL-60 and the BL-29
 * approval case to test/attendance-actor.e2e-spec.ts).
 * Every test states the TARGET behaviour from docs/product/requirements/BACKLOG.md and is expected
 * to FAIL today for the reason in its comment (see two-school-fixture.ts for how `pending` works).
 * When an item is implemented, move its tests into the regular suite as plain `it`.
 */
describe('BL-18 failing-first scaffold (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());

  beforeAll(async () => {
    f = await createTwoSchools('bl18');
    for (const who of ['super', 'admin-a', 'admin-b', 'parent-a', 'parent-b']) {
      tokens[who] = await f.login(who);
    }
  });

  afterAll(async () => {
    await f.close();
  });

  describe('BL-23 guardian across schools', () => {
    // Today: GET /admin/parents/:id returns ALL of the parent's children, including other schools'.
    pending(
      "school B's admin sees only school B's children of a parent shared with school A",
      async () => {
        const res = await http()
          .get(`/api/v1/admin/parents/${f.ids.parentShared}`)
          .set('Authorization', `Bearer ${tokens['admin-b']}`)
          .expect(200);
        const childIds = (
          res.body.children as { studentId?: string; id?: string }[]
        ).map((c) => c.studentId ?? c.id);
        expect(childIds).toContain(f.ids.studentB);
        expect(childIds).not.toContain(f.ids.studentA);
      },
    );
  });
});
