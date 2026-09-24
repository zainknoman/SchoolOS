import { of, lastValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import {
  DEFAULT_PAGE_SIZE,
  PagedResult,
  PaginationInterceptor,
  UNPAGED_CAP,
  pageArgs,
  toPageRequest,
} from './pagination';

describe('pagination (BL-40)', () => {
  it('treats page/limit as opt-in paging and trims q', () => {
    expect(toPageRequest({})).toEqual({
      paged: false,
      page: 1,
      limit: UNPAGED_CAP,
      q: undefined,
    });
    expect(toPageRequest({ page: 3 })).toEqual({
      paged: true,
      page: 3,
      limit: DEFAULT_PAGE_SIZE,
      q: undefined,
    });
    expect(toPageRequest({ limit: 10, q: '  ali ' })).toEqual({
      paged: true,
      page: 1,
      limit: 10,
      q: 'ali',
    });
    expect(toPageRequest({ q: '   ' }).q).toBeUndefined();
  });

  it('maps a page to skip/take, and probes one extra row when unpaged', () => {
    expect(pageArgs(toPageRequest({ page: 3, limit: 20 }))).toEqual({
      skip: 40,
      take: 20,
    });
    expect(pageArgs(toPageRequest({}))).toEqual({ take: UNPAGED_CAP + 1 });
  });

  it('flags and trims an unpaged result that hit the cap', () => {
    const rows = Array.from({ length: UNPAGED_CAP + 1 }, (_, i) => i);
    const r = PagedResult.of(rows, UNPAGED_CAP + 50, toPageRequest({}));
    expect(r.items).toHaveLength(UNPAGED_CAP);
    expect(r.truncated).toBe(true);
    expect(PagedResult.of([1], 1, toPageRequest({})).truncated).toBe(false);
  });

  it('the interceptor returns the plain array and sets the headers', async () => {
    const headers: Record<string, string> = {};
    const ctx = {
      switchToHttp: () => ({
        getResponse: () => ({
          setHeader: (k: string, v: string) => (headers[k] = v),
        }),
      }),
    } as unknown as ExecutionContext;
    const paged = new PagedResult(
      ['a', 'b'],
      42,
      toPageRequest({ page: 2, limit: 2 }),
    );
    const body = await lastValueFrom(
      new PaginationInterceptor().intercept(ctx, {
        handle: () => of(paged),
      } as CallHandler),
    );
    expect(body).toEqual(['a', 'b']);
    expect(headers).toEqual({
      'X-Total-Count': '42',
      'X-Page': '2',
      'X-Limit': '2',
    });

    const plain = await lastValueFrom(
      new PaginationInterceptor().intercept(ctx, {
        handle: () => of({ x: 1 }),
      } as CallHandler),
    );
    expect(plain).toEqual({ x: 1 });
  });
});
