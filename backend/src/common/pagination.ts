import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

/**
 * Pagination for list endpoints (BL-40, KI-8). Backward-compatible by design: the response body
 * stays the plain array the clients already consume; totals travel in headers:
 *   X-Total-Count  rows matching the filters
 *   X-Page / X-Limit  the page served (only when the caller asked for a page)
 *   X-Truncated: true  an UNPAGED request hit the server cap — ask for pages instead
 * `page`/`limit` opt in to paging (limit capped at MAX_PAGE_SIZE); `q` is a case-insensitive
 * search whose fields each endpoint defines.
 */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;
/** Hard cap for callers that do not page (pickers that need "all"); pilot scale is ~1,600 rows. */
export const UNPAGED_CAP = 2000;

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export interface PageRequest {
  paged: boolean;
  page: number;
  limit: number;
  q?: string;
}

export function toPageRequest(query: PageQueryDto = {}): PageRequest {
  const paged = query.page !== undefined || query.limit !== undefined;
  const q = query.q?.trim() || undefined;
  return paged
    ? {
        paged,
        page: query.page ?? 1,
        limit: query.limit ?? DEFAULT_PAGE_SIZE,
        q,
      }
    : { paged, page: 1, limit: UNPAGED_CAP, q };
}

/** Prisma skip/take for a request. Unpaged requests take one extra row to detect truncation. */
export function pageArgs(req: PageRequest): { skip?: number; take: number } {
  return req.paged
    ? { skip: (req.page - 1) * req.limit, take: req.limit }
    : { take: UNPAGED_CAP + 1 };
}

export class PagedResult<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
    readonly request: PageRequest,
  ) {}

  /** Builds the result from rows fetched with pageArgs(): trims the probe row when unpaged. */
  static of<T>(rows: T[], total: number, req: PageRequest): PagedResult<T> {
    return new PagedResult(
      req.paged ? rows : rows.slice(0, UNPAGED_CAP),
      total,
      req,
    );
  }

  get truncated(): boolean {
    return !this.request.paged && this.total > UNPAGED_CAP;
  }
}

/** Global: turns a PagedResult into the plain array body plus pagination headers. */
@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (!(value instanceof PagedResult)) return value;
        const paged = value as PagedResult<unknown>;
        const res = context.switchToHttp().getResponse<Response>();
        res.setHeader('X-Total-Count', String(paged.total));
        if (paged.request.paged) {
          res.setHeader('X-Page', String(paged.request.page));
          res.setHeader('X-Limit', String(paged.request.limit));
        }
        if (paged.truncated) res.setHeader('X-Truncated', 'true');
        return paged.items;
      }),
    );
  }
}

/** Headers browsers may read cross-origin (CORS `exposedHeaders`). */
export const PAGINATION_HEADERS = [
  'X-Total-Count',
  'X-Page',
  'X-Limit',
  'X-Truncated',
  'X-Request-Id',
];
