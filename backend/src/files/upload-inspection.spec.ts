import { inspectUpload } from './upload-inspection';

const file = (bytes: Buffer | string, name: string) => {
  const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
  return { buffer, originalname: name, size: buffer.length };
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);
const ZIP_OOXML = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('....[Content_Types].xml....'),
]);
const ZIP_PLAIN = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('....evil.exe....'),
]);
const HEIC = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypheic'),
  Buffer.alloc(8),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
]);

describe('inspectUpload (BL-52)', () => {
  it.each([
    [file('%PDF-1.7 ...', 'report.pdf'), 'application/pdf'],
    [file(PNG, 'logo.png'), 'image/png'],
    [file(JPEG, 'photo.JPG'), 'image/jpeg'],
    [file(JPEG, 'photo.jpeg'), 'image/jpeg'],
    [file('GIF89a....', 'a.gif'), 'image/gif'],
    [file(WEBP, 'a.webp'), 'image/webp'],
    [file(HEIC, 'IMG_0001.HEIC'), 'image/heic'],
    [
      file(ZIP_OOXML, 'sheet.xlsx'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      file(ZIP_OOXML, 'letter.docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [file(OLE, 'old.doc'), 'application/msword'],
    [file('Name,Class\nAli,3A\n', 'list.csv'), 'text/csv'],
    [file('Read chapter 2 — صفحہ ۱۲', 'worksheet.txt'), 'text/plain'],
  ])('accepts %# and stores the detected type', (f, mime) => {
    expect(inspectUpload(f)).toEqual({ ok: true, mimeType: mime });
  });

  it.each([
    ['an empty file', file(Buffer.alloc(0), 'a.pdf'), /empty/],
    [
      'HTML named .pdf',
      file('<html><script>alert(1)</script>', 'report.pdf'),
      /not allowed/,
    ],
    ['a PNG named .pdf', file(PNG, 'report.pdf'), /does not match/],
    ['a PDF named .png', file('%PDF-1.4', 'logo.png'), /does not match/],
    [
      'a Windows executable',
      file('MZ\x90\x00\x03', 'setup.txt'),
      /not allowed/,
    ],
    ['a plain ZIP named .docx', file(ZIP_PLAIN, 'letter.docx'), /not allowed/],
    ['an OOXML zip named .zip', file(ZIP_OOXML, 'bundle.zip'), /not allowed/],
    [
      'binary data named .txt',
      file(Buffer.from([0x41, 0x00, 0x42]), 'notes.txt'),
      /not allowed/,
    ],
    [
      'invalid UTF-8 named .csv',
      file(Buffer.from([0xc3, 0x28]), 'list.csv'),
      /not allowed/,
    ],
    [
      'an SVG (script-capable)',
      file('<svg xmlns="http://www.w3.org/2000/svg"/>', 'logo.svg'),
      /not allowed/,
    ],
    [
      'a file without an extension',
      file('%PDF-1.4', 'report'),
      /does not match/,
    ],
  ])('refuses %s', (_label, f, reason) => {
    expect(inspectUpload(f)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});
