import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ReportCardSnapshot } from './generated-report-cards.service';

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** BL-06: renders a generated report card from its frozen snapshot (never from live data). */
@Injectable()
export class ReportCardPdfService {
  render(
    snap: ReportCardSnapshot,
    meta: { version: number; issuedAt: Date; superseded: boolean },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(snap.school, { align: 'center' });
      doc
        .fontSize(12)
        .text(`${snap.campus} — Report Card`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Student: ${snap.student.name} (${snap.student.grNumber})`);
      doc.text(
        `Class: ${snap.className} ${snap.section} · Session: ${snap.session} · Term: ${snap.term}`,
      );
      doc.moveDown();

      const cols = [50, 220, 310, 380, 440];
      const header = ['Subject', 'Marks', '%', 'Grade', 'Remark'];
      const row = (values: string[], bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        values.forEach((v, i) =>
          doc.text(v, cols[i], y, {
            width: (cols[i + 1] ?? 545) - cols[i] - 6,
          }),
        );
        doc.moveDown(0.4);
        doc.x = 50;
      };
      row(header, true);
      for (const s of snap.subjects) {
        row([
          s.subjectName,
          `${s.obtainedMarks} / ${s.maxMarks}`,
          pct(s.finalPercent),
          s.letter ?? '—',
          s.remark ?? '',
        ]);
      }
      doc.moveDown();
      row(
        [
          'Overall',
          '',
          pct(snap.overall.percent),
          snap.overall.letter ?? '—',
          snap.overall.remark ?? '',
        ],
        true,
      );
      doc.font('Helvetica');
      if (snap.overall.gpa !== null) {
        doc.text(`GPA: ${snap.overall.gpa}`);
      }
      if (snap.remark) {
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Remarks');
        doc.font('Helvetica').text(snap.remark);
      }
      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(
          `Grading scale: ${snap.scaleName} · Version ${meta.version}, issued ${meta.issuedAt.toISOString().slice(0, 10)}` +
            (meta.superseded ? ' · SUPERSEDED by a later version' : ''),
        );
      doc.end();
    });
  }
}
