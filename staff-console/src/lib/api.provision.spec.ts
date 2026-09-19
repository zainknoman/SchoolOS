import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

const school = { name: 'S' };
const campus = { schoolId: 's1', name: 'C' };

describe('createSchool / createCampus response parsing', () => {
  it('returns the provisionedLogin from the body', async () => {
    const body = { provisionedLogin: { identifier: 'a@x.test', temporaryPassword: 'pw' } };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 201 })));
    expect(await api.createSchool('t', school)).toEqual(body);
    expect(await api.createCampus('t', campus)).toEqual(body);
  });

  it('returns {} (does not throw) for an empty 204 body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(null, { status: 204 })));
    expect(await api.createSchool('t', school)).toEqual({});
    expect(await api.createCampus('t', campus)).toEqual({});
  });

  it('returns {} for an unparseable body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('not json', { status: 201 })));
    expect(await api.createSchool('t', school)).toEqual({});
  });
});
