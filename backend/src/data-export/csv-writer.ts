const BOM = String.fromCharCode(0xfeff);

export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * BL-41: one CSV cell. Quotes when needed (RFC 4180) and neutralises spreadsheet formulas — a
 * value starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`, so a name
 * such as `=HYPERLINK(...)` typed into the system is shown as text, never run, when an admin opens
 * the export in Excel (CSV injection). Plain numbers are left alone, so negative amounts stay numbers.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  else text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row + one line per row, CRLF line endings; starts with a BOM so Excel reads UTF-8. */
export function toCsv<T>(
  columns: readonly { header: string; value: (row: T) => CsvValue }[],
  rows: readonly T[],
): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
