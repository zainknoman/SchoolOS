import { extname } from 'path';

/**
 * Server-side upload inspection (BL-52, KG-14). The client-reported MIME type and the file name
 * are attacker-controlled, so the type is decided from the file's own bytes ("magic numbers")
 * against an ALLOW-list, and the extension must agree with what the bytes say. The stored
 * mimeType is the detected one. Anything not recognised is refused.
 */
export interface DetectedType {
  mimeType: string;
  /** Extensions (lower-case, with dot) a file of this type may carry. */
  extensions: readonly string[];
}

const PDF: DetectedType = { mimeType: 'application/pdf', extensions: ['.pdf'] };
const PNG: DetectedType = { mimeType: 'image/png', extensions: ['.png'] };
const JPEG: DetectedType = {
  mimeType: 'image/jpeg',
  extensions: ['.jpg', '.jpeg'],
};
const GIF: DetectedType = { mimeType: 'image/gif', extensions: ['.gif'] };
const WEBP: DetectedType = { mimeType: 'image/webp', extensions: ['.webp'] };
const HEIC: DetectedType = {
  mimeType: 'image/heic',
  extensions: ['.heic', '.heif'],
};
const OOXML: Record<string, string> = {
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const OLE: Record<string, string> = {
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
};
const TEXT: Record<string, string> = {
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** The type the bytes prove, given the file's extension (needed only to name OOXML/OLE/text). */
export function detectType(buf: Buffer, ext: string): DetectedType | null {
  if (startsWith(buf, ascii('%PDF-'))) return PDF;
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return PNG;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return JPEG;
  if (startsWith(buf, ascii('GIF87a')) || startsWith(buf, ascii('GIF89a')))
    return GIF;
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8))
    return WEBP;
  if (startsWith(buf, ascii('ftyp'), 4)) {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'mif1', 'msf1', 'heif'].includes(brand)) return HEIC;
    return null;
  }
  // ZIP container: only the Office Open XML formats, which always carry [Content_Types].xml.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const mime = OOXML[ext];
    return mime && buf.includes('[Content_Types].xml')
      ? { mimeType: mime, extensions: [ext] }
      : null;
  }
  // OLE2 compound file: legacy Office documents.
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const mime = OLE[ext];
    return mime ? { mimeType: mime, extensions: [ext] } : null;
  }
  // Plain text / CSV: no NUL bytes and valid UTF-8 — rules out every binary format above.
  const mime = TEXT[ext];
  if (mime && isUtf8Text(buf)) return { mimeType: mime, extensions: [ext] };
  return null;
}

function isUtf8Text(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export type InspectionResult =
  { ok: true; mimeType: string } | { ok: false; reason: string };

export function inspectUpload(file: {
  buffer?: Buffer;
  originalname: string;
  size: number;
}): InspectionResult {
  if (!file.buffer || file.size === 0 || file.buffer.length === 0) {
    return { ok: false, reason: 'The file is empty.' };
  }
  const ext = extname(file.originalname).toLowerCase();
  const detected = detectType(file.buffer, ext);
  if (!detected) {
    return {
      ok: false,
      reason:
        'This file type is not allowed. Upload a PDF, an image (PNG, JPEG, GIF, WebP, HEIC), an Office document or a plain-text/CSV file.',
    };
  }
  if (!detected.extensions.includes(ext)) {
    return {
      ok: false,
      reason: `The file's content (${detected.mimeType}) does not match its "${ext || 'missing'}" extension.`,
    };
  }
  return { ok: true, mimeType: detected.mimeType };
}
