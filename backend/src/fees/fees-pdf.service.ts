import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface VoucherPdfInput {
  studentName: string;
  grNumber: string;
  month: string;
  dueDate: string;
  items: Array<{ label: string; amount: number }>;
  totalAmount: number;
}

export interface ReceiptPdfInput {
  receiptNumber: string;
  studentName: string;
  amount: number;
  method: string;
  paidAt: string;
}

function pkr(amountPaisa: number): string {
  return (amountPaisa / 100).toFixed(2);
}

@Injectable()
export class FeesPdfService {
  renderVoucherPdf(input: VoucherPdfInput): Promise<Buffer> {
    return this.render((doc) => {
      doc
        .fontSize(18)
        .text('The SchoolOS School — Fee Voucher', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Student: ${input.studentName} (${input.grNumber})`);
      doc.text(`Month: ${input.month}`);
      doc.text(`Due date: ${input.dueDate}`);
      doc.moveDown();
      for (const item of input.items) {
        doc.text(`${item.label}   PKR ${pkr(item.amount)}`);
      }
      doc.moveDown();
      doc
        .fontSize(13)
        .text(`Total due: PKR ${pkr(input.totalAmount)}`, { align: 'right' });
    });
  }

  renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
    return this.render((doc) => {
      doc
        .fontSize(18)
        .text('The SchoolOS School — Payment Receipt', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Receipt No: ${input.receiptNumber}`);
      doc.text(`Student: ${input.studentName}`);
      doc.text(`Paid via: ${input.method}`);
      doc.text(`Paid on: ${input.paidAt}`);
      doc.moveDown();
      doc
        .fontSize(13)
        .text(`Amount paid: PKR ${pkr(input.amount)}`, { align: 'right' });
    });
  }

  private render(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }
}
