// backend/src/bulk-import/csv.ts
import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export interface ParsedRow {
  line: number;
  row: Record<string, string>;
}

export function parseCsv(buffer: Buffer, maxRows: number): ParsedRow[] {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (records.length > maxRows) {
    throw new BadRequestException(`This file has ${records.length} rows, which exceeds the ${maxRows}-row limit per import.`);
  }
  // Line 1 is the header; data rows start at line 2, matching what a user sees in a spreadsheet.
  return records.map((row, i) => ({ line: i + 2, row }));
}
