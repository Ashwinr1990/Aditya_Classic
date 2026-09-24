import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { ExcelReportService, YearGrid, YearReport } from './excel-report.service';

// Printable PDF of the yearly report: summary page, then maintenance, utilities and security tables.
// jsPDF is loaded only when exporting. Its built-in fonts have no ₹ glyph, so amounts use "Rs.".

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type RGB = [number, number, number];
const C: Record<string, RGB> = {
  primary: [25, 118, 210],
  primaryDark: [13, 71, 161],
  green: [46, 125, 50],
  red: [198, 40, 40],
  greenFill: [232, 245, 233],
  redFill: [253, 236, 234],
  stripe: [243, 247, 252],
  totalFill: [227, 242, 253],
  border: [208, 215, 226],
  text: [33, 33, 33],
  muted: [107, 114, 128],
  white: [255, 255, 255],
};
const MARGIN = 12;

@Injectable({ providedIn: 'root' })
export class PdfReportService {
  private nf = new Intl.NumberFormat('en-IN');

  constructor(private reports: ExcelReportService) {}

  async exportYear(year: number): Promise<void> {
    const { doc } = await this.build(year);
    doc.save(this.fileName(year));
  }

  /** The report as base64 (for emailing), plus its summary figures. */
  async buildForEmail(year: number): Promise<{ base64: string; fileName: string; report: YearReport }> {
    const { doc, report } = await this.build(year);
    const base64 = doc.output('datauristring').split(',')[1];
    return { base64, fileName: this.fileName(year), report };
  }

  fileName(year: number): string {
    return `ACMT-Report-${year}.pdf`;
  }

  private async build(year: number): Promise<{ doc: jsPDF; report: YearReport }> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const report = this.reports.yearReport(year);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setProperties({ title: `Aditya Classic Association · ${year}`, creator: 'Aditya Classic Association' });

    this.summaryPage(doc, autoTable, report);
    for (const grid of report.grids) {
      doc.addPage();
      this.gridPage(doc, autoTable, grid);
    }
    this.footers(doc);
    return { doc, report };
  }

  // ---------- Pages ----------

  private summaryPage(doc: jsPDF, autoTable: AutoTable, r: YearReport) {
    let y = this.banner(doc, `Financial Summary · ${r.year}`);

    // Headline cards
    const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
    const gap = 6;
    const cardW = (width - gap * 2) / 3;
    const cards: [string, number, RGB, RGB][] = [
      ['COLLECTED', r.collected, C['green'], C['greenFill']],
      ['USED', r.used, C['red'], C['redFill']],
      ['SAVINGS', r.savings, r.savings >= 0 ? C['green'] : C['red'], r.savings >= 0 ? C['greenFill'] : C['redFill']],
    ];
    cards.forEach(([label, value, color, fill], i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.setFillColor(...fill);
      doc.roundedRect(x, y, cardW, 24, 2, 2, 'F');
      doc.setFillColor(...color);
      doc.rect(x, y, cardW, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C['muted']);
      doc.text(label, x + cardW / 2, y + 8, { align: 'center' });
      doc.setFontSize(18);
      doc.setTextColor(...color);
      doc.text(this.money(value), x + cardW / 2, y + 18, { align: 'center' });
    });
    y += 32;

    y = this.sectionTitle(doc, 'Month-by-month breakdown', y);
    const body = r.months.map(m => {
      const spent = m.utilities + m.security + m.common;
      return [m.month, m.maintenance, m.utilities, m.security, m.common, spent, m.maintenance - spent];
    });
    const sum = (i: number) => body.reduce((s, row) => s + (row[i] as number), 0);
    const foot = ['Total', sum(1), sum(2), sum(3), sum(4), sum(5), sum(6)];

    autoTable(doc, {
      ...this.tableStyle(),
      startY: y,
      head: [['Month', 'Maintenance', 'Utilities', 'Security', 'Common Maint.', 'Total Spent', 'Balance']],
      body: body.map(row => row.map((v, i) => (i === 0 ? v : this.money(v as number)))),
      foot: [foot.map((v, i) => (i === 0 ? v : this.money(v as number)))],
      columnStyles: this.moneyColumns(1, 6),
      didParseCell: data => {
        if (data.section === 'foot' && data.column.index === 0) data.cell.styles.halign = 'left';
        // Colour the balance column green/red
        if (data.column.index === 6 && data.section !== 'head') {
          const raw = data.section === 'foot' ? foot[6] : body[data.row.index][6];
          data.cell.styles.textColor = (raw as number) >= 0 ? C['green'] : C['red'];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const endY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C['muted']);
    doc.text(
      'Collected = maintenance payments.  Used = utilities (incl. miscellaneous) + security salaries + common maintenance.  Savings = Collected - Used.',
      MARGIN, endY,
    );
  }

  private gridPage(doc: jsPDF, autoTable: AutoTable, g: YearGrid) {
    const y = this.banner(doc, g.title);
    const hasSub = g.names.some(n => n.sub);
    const lead = hasSub ? 2 : 1;

    if (g.names.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(...C['muted']);
      doc.text('No entries for this year.', MARGIN, y + 6);
      return;
    }

    const values = g.names.map(n =>
      MONTHS_SHORT.map((_, m) => g.data[n.name]?.[String(m + 1).padStart(2, '0')] ?? null)
    );
    const body = g.names.map((n, i) => {
      const total = values[i].reduce((s: number, v) => s + (v || 0), 0);
      return [n.name, ...(hasSub ? [n.sub ?? ''] : []), ...values[i].map(v => (v ? this.money(v) : '')), this.money(total)];
    });
    const colTotals = MONTHS_SHORT.map((_, m) => values.reduce((s, row) => s + (row[m] || 0), 0));
    const foot = [
      'Total', ...(hasSub ? [''] : []),
      ...colTotals.map(v => this.money(v)),
      this.money(colTotals.reduce((s, v) => s + v, 0)),
    ];

    autoTable(doc, {
      ...this.tableStyle(8),
      startY: y,
      head: [[g.label, ...(hasSub ? ['House No.'] : []), ...MONTHS_SHORT, 'Total']],
      body,
      foot: [foot],
      columnStyles: {
        0: { cellWidth: hasSub ? 34 : 40 },
        ...(hasSub ? { 1: { cellWidth: 18 } } : {}),
        ...this.moneyColumns(lead, lead + 12),
        [lead + 12]: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: data => {
        if (data.section === 'foot' && data.column.index === 0) data.cell.styles.halign = 'left';
        if (!g.markUnpaid || data.section !== 'body') return;
        const m = data.column.index - lead;
        if (m >= 0 && m < 12 && !values[data.row.index][m]) {
          data.cell.styles.fillColor = C['redFill'];
        }
      },
    });

    if (g.markUnpaid) {
      const endY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFillColor(...C['redFill']);
      doc.rect(MARGIN, endY - 3.2, 8, 4.5, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...C['muted']);
      doc.text('Shaded cells: no payment recorded for that month', MARGIN + 11, endY);
    }
  }

  // ---------- Building blocks ----------

  /** Title banner at the top of a page; returns the y where content can start. */
  private banner(doc: jsPDF, subtitle: string): number {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...C['primaryDark']);
    doc.rect(0, 0, w, 18, 'F');
    doc.setFillColor(...C['primary']);
    doc.rect(0, 18, w, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...C['white']);
    doc.text('Aditya Classic Association', w / 2, 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const exported = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.text(`${subtitle}   ·   Exported ${exported}`, w / 2, 24, { align: 'center' });
    return 35;
  }

  private sectionTitle(doc: jsPDF, text: string, y: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C['primaryDark']);
    doc.text(text, MARGIN, y);
    doc.setDrawColor(...C['primary']);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y + 2, doc.internal.pageSize.getWidth() - MARGIN, y + 2);
    return y + 5;
  }

  private footers(doc: jsPDF) {
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C['muted']);
      doc.text('Aditya Classic Association', MARGIN, h - 6);
      doc.text(`Page ${i} of ${pages}`, w - MARGIN, h - 6, { align: 'right' });
    }
  }

  private tableStyle(fontSize = 9.5) {
    return {
      theme: 'grid' as const,
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize,
        cellPadding: 2,
        textColor: C['text'],
        lineColor: C['border'],
        lineWidth: 0.2,
        valign: 'middle' as const,
      },
      headStyles: { fillColor: C['primary'], textColor: C['white'], fontStyle: 'bold' as const, halign: 'center' as const },
      footStyles: { fillColor: C['totalFill'], textColor: C['primaryDark'], fontStyle: 'bold' as const, halign: 'right' as const },
      alternateRowStyles: { fillColor: C['stripe'] },
      showFoot: 'lastPage' as const,
    };
  }

  private moneyColumns(from: number, to: number) {
    const styles: Record<number, { halign: 'right' }> = {};
    for (let i = from; i <= to; i++) styles[i] = { halign: 'right' };
    return styles;
  }

  private money(v: number): string {
    return `${v < 0 ? '-' : ''}Rs. ${this.nf.format(Math.abs(v))}`;
  }
}

type AutoTable = typeof import('jspdf-autotable').default;
