import { Injectable } from '@angular/core';
import type { Workbook, Worksheet, Row, Cell } from 'exceljs';
import { CloudSyncService, DATA_KEYS } from './cloud-sync.service';
import { LanguageService } from '../i18n/language.service';

// Styled Excel exports. ExcelJS is loaded only when exporting, so it doesn't slow app start.
// The report sheets are in the app's current language. The data sheets keep the exact English layout the
// importer reads (sheet names, header row 1, column names, stored values); the report sheets are ignored on import.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const COLOR = {
  primary: 'FF1976D2',
  primaryDark: 'FF0D47A1',
  green: 'FF2E7D32',
  red: 'FFC62828',
  headerText: 'FFFFFFFF',
  stripe: 'FFF3F7FC',
  border: 'FFD0D7E2',
  muted: 'FF6B7280',
  totalFill: 'FFE3F2FD',
  unpaidFill: 'FFFDECEA',
  greenFill: 'FFE8F5E9',
  redFill: 'FFFDECEA',
};
const MONEY = '"₹"#,##0;[Red]-"₹"#,##0';
const FONT = 'Calibri';

// Column names per data sheet, used for headers even when a sheet has no rows yet.
const DATA_COLUMNS: Record<string, string[]> = {
  people: ['name', 'nameKn', 'unit', 'email'],
  maintenanceData: ['year', 'person', 'month', 'amount'],
  utilityData: ['year', 'type', 'month', 'amount'],
  miscellaneous: ['name', 'cost', 'date'],
  guards: ['name', 'nameKn'],
  salaryData: ['year', 'guard', 'month', 'amount'],
  commonItems: ['desc', 'descKn', 'cost', 'month', 'year'],
  adminProfile: ['email'],
};
const MONEY_COLUMNS = ['amount', 'cost'];

type Nested = Record<string, Record<string, Record<string, number>>>;
export type MonthRow = { month: string; maintenance: number; utilities: number; security: number; common: number };
/** One rows × months table (maintenance by resident, utilities by type, salaries by guard). */
export type YearGrid = {
  sheetName: string;
  title: string;
  label: string;
  data: Record<string, Record<string, number>>;
  // name: the key in `data`; shown: the name as printed, in the report's language
  names: { name: string; sub?: string; shown: string }[];
  markUnpaid: boolean;
};
/** Everything shown in a yearly report; shared by the Excel and PDF exports so they always agree. */
export type YearReport = {
  year: number;
  months: MonthRow[];
  collected: number;
  used: number;
  savings: number;
  grids: YearGrid[];
};

@Injectable({ providedIn: 'root' })
export class ExcelReportService {
  constructor(private cloudSync: CloudSyncService, private i18n: LanguageService) {}

  /** Full export: report sheets for `year` plus every data sheet (re-importable). */
  async exportAll(year: number): Promise<void> {
    const wb = await this.newWorkbook();
    const report = this.yearReport(year);
    this.addSummarySheet(wb, report);
    for (const g of report.grids) this.addGridSheet(wb, g.sheetName, g.title, g.label, g.data, g.names, g.markUnpaid);
    for (const key of DATA_KEYS) this.addDataSheet(wb, key);
    await this.download(wb, `ACMT-Data-${this.today()}.xlsx`);
  }

  /** Totals and per-month tables for one year, read from the saved app data, in the app's current language. */
  yearReport(year: number): YearReport {
    const t = (text: string) => this.i18n.t(text, { year });
    const months = this.monthlyTotals(year);
    const collected = months.reduce((s, m) => s + m.maintenance, 0);
    const used = months.reduce((s, m) => s + m.utilities + m.security + m.common, 0);
    // Miscellaneous expenses count as utilities on the dashboard, so show them as a row too.
    const utilities = { ...(this.read<Nested>('utilityData', {})[year] ?? {}), Miscellaneous: this.miscByMonth(year) };
    // Kannada spellings saved for people and guards
    const kannadaNames = (key: string) =>
      new Map(this.read<{ name: string; nameKn?: string }[]>(key, []).map(p => [p.name, p.nameKn]));
    const peopleKn = kannadaNames('people');
    const guardsKn = kannadaNames('guards');
    return {
      year,
      months,
      collected,
      used,
      savings: collected - used,
      grids: [
        {
          sheetName: t('Maintenance {year}'), title: t('Maintenance Collection · {year}'), label: t('Resident'),
          data: this.read<Nested>('maintenanceData', {})[year] ?? {},
          names: this.maintenanceRows().map(n => ({ ...n, shown: this.i18n.name(n.name, peopleKn.get(n.name)) })),
          markUnpaid: true,
        },
        {
          sheetName: t('Utilities {year}'), title: t('Utility Bills · {year}'), label: t('Utility'), data: utilities,
          names: [...this.namesWithDefaults(['Electricity', 'Water', 'BBMP'], 'utilityData', year), 'Miscellaneous']
            .map(name => ({ name, shown: this.i18n.t(name) })),
          markUnpaid: false,
        },
        {
          sheetName: t('Security {year}'), title: t('Security Salaries · {year}'), label: t('Guard'),
          data: this.read<Nested>('salaryData', {})[year] ?? {},
          names: this.namesWithDefaults(this.read<{ name: string }[]>('guards', []).map(g => g.name), 'salaryData', year)
            .map(name => ({ name, shown: this.i18n.name(name, guardsKn.get(name)) })),
          markUnpaid: false,
        },
        this.commonGrid(year),
      ],
    };
  }

  // Common maintenance items for the year, one row per description (items store months 0-11).
  private commonGrid(year: number): YearGrid {
    const data: Record<string, Record<string, number>> = {};
    const kannada: Record<string, string | undefined> = {};
    for (const item of this.read<any[]>('commonItems', [])) {
      if (Number(item?.year) !== year) continue;
      const month = Number(item?.month);
      if (!(month >= 0 && month < 12)) continue;
      const name = String(item?.desc ?? '').trim() || 'Other';
      const mm = String(month + 1).padStart(2, '0');
      data[name] ??= {};
      data[name][mm] = (data[name][mm] || 0) + (Number(item?.cost) || 0);
      kannada[name] ??= item?.descKn;
    }
    return {
      sheetName: this.i18n.t('Common Maint. {year}', { year }),
      title: this.i18n.t('Common Maintenance · {year}', { year }),
      label: this.i18n.t('Item'),
      data,
      names: Object.keys(data).map(name => ({
        name,
        shown: name === 'Other' ? this.i18n.t(name) : this.i18n.text(name, kannada[name]),
      })),
      markUnpaid: false,
    };
  }

  /** Financial summary only. */
  async exportFinancials(year: number): Promise<void> {
    const wb = await this.newWorkbook();
    this.addSummarySheet(wb, this.yearReport(year));
    await this.download(wb, `ACMT-Financials-${year}.xlsx`);
  }

  // ---------- Summary sheet ----------

  private addSummarySheet(wb: Workbook, report: YearReport) {
    const { year, months, collected, used, savings } = report;
    const t = (text: string) => this.i18n.t(text);
    const ws = wb.addWorksheet(t('Summary'), {
      properties: { tabColor: { argb: COLOR.green } },
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [
      { width: 16 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 16 }, { width: 15 }, { width: 15 },
    ];
    this.addBanner(ws, t('Aditya Classic Association'), this.i18n.t('Financial Summary · {year}', { year }), 7);

    // Headline cards: Collected / Used / Savings
    const cards: [string, number, string, string][] = [
      [t('Collected'), collected, COLOR.green, COLOR.greenFill],
      [t('Used'), used, COLOR.red, COLOR.redFill],
      [t('Savings'), savings, savings >= 0 ? COLOR.green : COLOR.red, savings >= 0 ? COLOR.greenFill : COLOR.redFill],
    ];
    const cardCols = [[1, 2], [3, 4], [5, 7]];
    cards.forEach(([label, value, color, fill], i) => {
      const [c1, c2] = cardCols[i];
      ws.mergeCells(5, c1, 5, c2);
      ws.mergeCells(6, c1, 6, c2);
      const l = ws.getCell(5, c1);
      l.value = label.toUpperCase();
      l.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.muted } };
      const v = ws.getCell(6, c1);
      v.value = value;
      v.numFmt = MONEY;
      v.font = { name: FONT, size: 20, bold: true, color: { argb: color } };
      for (const r of [5, 6]) {
        for (let c = c1; c <= c2; c++) {
          const cell = ws.getCell(r, c);
          cell.fill = this.solid(fill);
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          // White side borders keep a visible gap between neighbouring cards
          const gap = { style: 'thick' as const, color: { argb: 'FFFFFFFF' } };
          cell.border = {
            top: r === 5 ? { style: 'medium', color: { argb: color } } : undefined,
            bottom: r === 6 ? { style: 'thin', color: { argb: COLOR.border } } : undefined,
            left: c === c1 ? gap : undefined,
            right: c === c2 ? gap : undefined,
          };
        }
      }
    });
    ws.getRow(5).height = 20;
    ws.getRow(6).height = 34;

    // Month-by-month table
    const top = 8;
    this.sectionTitle(ws, top, t('Month-by-month breakdown'), 7);
    const headers = ['Month', 'Maintenance', 'Utilities', 'Security', 'Common Maint.', 'Total Spent', 'Balance'].map(t);
    this.headerRow(ws.getRow(top + 1), headers);
    months.forEach((m, i) => {
      const spent = m.utilities + m.security + m.common;
      const row = ws.getRow(top + 2 + i);
      row.values = [t(m.month), m.maintenance, m.utilities, m.security, m.common, spent, m.maintenance - spent];
      this.bodyRow(row, 7, i, [2, 3, 4, 5, 6, 7]);
      row.getCell(7).font = {
        name: FONT, bold: true,
        color: { argb: m.maintenance - spent >= 0 ? COLOR.green : COLOR.red },
      };
    });
    const totalRow = ws.getRow(top + 14);
    const first = top + 2, last = top + 13;
    const colTotals = [
      months.reduce((s, m) => s + m.maintenance, 0),
      months.reduce((s, m) => s + m.utilities, 0),
      months.reduce((s, m) => s + m.security, 0),
      months.reduce((s, m) => s + m.common, 0),
      used,
      savings,
    ];
    totalRow.values = [t('Total'), ...['B', 'C', 'D', 'E', 'F', 'G'].map((c, i) => ({
      formula: `SUM(${c}${first}:${c}${last})`, result: colTotals[i],
    }))];
    this.totalRow(totalRow, 7, [2, 3, 4, 5, 6, 7]);

    const note = ws.getCell(top + 16, 1);
    note.value = t('Collected = maintenance payments.  Used = utilities (incl. miscellaneous) + security salaries + common maintenance.  Savings = Collected - Used.');
    note.font = { name: FONT, italic: true, size: 9, color: { argb: COLOR.muted } };
    ws.mergeCells(top + 16, 1, top + 16, 7);
  }

  // ---------- Year grid sheets (rows × months) ----------

  private addGridSheet(
    wb: Workbook, sheetName: string, title: string, label: string,
    data: Record<string, Record<string, number>>, names: YearGrid['names'], markUnpaid = false,
  ) {
    const t = (text: string) => this.i18n.t(text);
    const hasSub = names.some(n => n.sub);
    const lead = hasSub ? 2 : 1; // label (+ unit) columns before the months
    const totalCols = lead + 12 + 1;
    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: COLOR.green } },
      views: [{ state: 'frozen', xSplit: lead, ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [
      { width: 24 },
      ...(hasSub ? [{ width: 12 }] : []),
      ...MONTHS.map(() => ({ width: 11 })),
      { width: 14 },
    ];
    this.addBanner(ws, t('Aditya Classic Association'), title, totalCols);
    this.headerRow(ws.getRow(4), [label, ...(hasSub ? [t('House No.')] : []), ...MONTHS.map(m => t(m.slice(0, 3))), t('Total')]);

    const moneyCols = Array.from({ length: 13 }, (_, i) => lead + 1 + i);
    const colTotals = new Array(13).fill(0);
    names.forEach((n, i) => {
      const r = 5 + i;
      const row = ws.getRow(r);
      const months = MONTHS.map((_, m) => data[n.name]?.[String(m + 1).padStart(2, '0')] ?? null);
      const rowTotal = months.reduce((s: number, v) => s + (v || 0), 0);
      months.forEach((v, m) => (colTotals[m] += v || 0));
      colTotals[12] += rowTotal;
      const firstCol = this.colLetter(lead + 1), lastCol = this.colLetter(lead + 12);
      row.values = [
        n.shown, ...(hasSub ? [n.sub ?? ''] : []), ...months,
        { formula: `SUM(${firstCol}${r}:${lastCol}${r})`, result: rowTotal },
      ];
      this.bodyRow(row, totalCols, i, moneyCols);
      row.getCell(totalCols).font = { name: FONT, bold: true };
      if (markUnpaid) {
        months.forEach((v, m) => {
          if (v) return;
          const cell = row.getCell(lead + 1 + m);
          cell.fill = this.solid(COLOR.unpaidFill);
        });
      }
    });

    if (names.length === 0) {
      const cell = ws.getCell(5, 1);
      cell.value = t('No entries for this year');
      cell.font = { name: FONT, italic: true, color: { argb: COLOR.muted } };
      return;
    }
    const lastRow = 4 + names.length;
    const totalRow = ws.getRow(lastRow + 1);
    totalRow.values = [
      t('Total'), ...(hasSub ? [''] : []),
      ...moneyCols.map((c, i) => ({
        formula: `SUM(${this.colLetter(c)}5:${this.colLetter(c)}${lastRow})`, result: colTotals[i],
      })),
    ];
    this.totalRow(totalRow, totalCols, moneyCols);

    if (markUnpaid) {
      const swatch = ws.getCell(lastRow + 3, 1);
      swatch.value = t('Not paid');
      swatch.fill = this.solid(COLOR.unpaidFill);
      swatch.alignment = { horizontal: 'center' };
      swatch.font = { name: FONT, size: 9, color: { argb: COLOR.red } };
      swatch.border = this.border();
      const legend = ws.getCell(lastRow + 3, 2);
      legend.value = `  ${t('Shaded cells: no payment recorded for that month')}`;
      legend.font = { name: FONT, italic: true, size: 9, color: { argb: COLOR.muted } };
    }
  }

  // ---------- Data sheets (re-importable) ----------

  private addDataSheet(wb: Workbook, key: string) {
    const rows = this.cloudSync.sheetRows(key);
    const columns = [...(DATA_COLUMNS[key] ?? [])];
    rows.forEach(r => Object.keys(r).forEach(k => { if (!columns.includes(k)) columns.push(k); }));

    const ws = wb.addWorksheet(key, {
      properties: { tabColor: { argb: COLOR.primary } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = columns.map(c => ({
      key: c,
      width: Math.min(40, Math.max(12, c.length + 4, ...rows.map(r => String(r[c] ?? '').length + 3))),
    }));
    this.headerRow(ws.getRow(1), columns);
    const moneyCols = columns.map((c, i) => (MONEY_COLUMNS.includes(c) ? i + 1 : 0)).filter(Boolean);
    rows.forEach((r, i) => {
      const row = ws.getRow(2 + i);
      row.values = columns.map(c => r[c] ?? null);
      this.bodyRow(row, columns.length, i, moneyCols);
    });
    if (columns.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: columns.length } };
    }
  }

  // ---------- Data helpers ----------

  private monthlyTotals(year: number): MonthRow[] {
    const maintenance = this.read<Nested>('maintenanceData', {})[year] ?? {};
    const utilities = this.read<Nested>('utilityData', {})[year] ?? {};
    const salaries = this.read<Nested>('salaryData', {})[year] ?? {};
    const misc = this.read<any[]>('miscellaneous', []);
    const common = this.read<any[]>('commonItems', []);
    const sumMonth = (data: Record<string, Record<string, number>>, mm: string) =>
      Object.values(data).reduce((s, months) => s + (months?.[mm] || 0), 0);

    return MONTHS.map((month, m) => {
      const mm = String(m + 1).padStart(2, '0');
      const miscTotal = misc
        .filter(item => {
          if (!item?.date) return false;
          const d = new Date(item.date);
          return d.getMonth() === m && d.getFullYear() === year;
        })
        .reduce((s, item) => s + (item.cost || 0), 0);
      const commonTotal = common
        .filter(item => Number(item?.month) === m && Number(item?.year) === year)
        .reduce((s, item) => s + (Number(item.cost) || 0), 0);
      return {
        month,
        maintenance: sumMonth(maintenance, mm),
        utilities: sumMonth(utilities, mm) + miscTotal,
        security: sumMonth(salaries, mm),
        common: commonTotal,
      };
    });
  }

  // Miscellaneous costs for the year, keyed by month ('01'..'12').
  private miscByMonth(year: number): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const item of this.read<any[]>('miscellaneous', [])) {
      if (!item?.date) continue;
      const d = new Date(item.date);
      if (d.getFullYear() !== year) continue;
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      totals[mm] = (totals[mm] || 0) + (item.cost || 0);
    }
    return totals;
  }

  // People in list order, plus anyone with payments who is no longer in the list.
  private maintenanceRows(): { name: string; sub?: string }[] {
    const people = this.read<{ name: string; unit: string }[]>('people', []);
    const rows = people.map(p => ({ name: p.name, sub: p.unit }));
    const data = this.read<Nested>('maintenanceData', {});
    for (const yearData of Object.values(data)) {
      for (const name of Object.keys(yearData || {})) {
        if (!rows.some(r => r.name === name)) rows.push({ name, sub: '' });
      }
    }
    return rows;
  }

  private namesWithDefaults(names: string[], key: string, year: number): string[] {
    const all = [...names];
    for (const name of Object.keys(this.read<Nested>(key, {})[year] ?? {})) {
      if (!all.includes(name)) all.push(name);
    }
    return all;
  }

  private read<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  }

  // ---------- Styling helpers ----------

  private async newWorkbook(): Promise<Workbook> {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    wb.creator = 'Aditya Classic Association';
    wb.created = new Date();
    return wb;
  }

  private addBanner(ws: Worksheet, title: string, subtitle: string, cols: number) {
    ws.mergeCells(1, 1, 1, cols);
    ws.mergeCells(2, 1, 2, cols);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = { name: FONT, size: 18, bold: true, color: { argb: COLOR.headerText } };
    t.fill = this.solid(COLOR.primaryDark);
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    const s = ws.getCell(2, 1);
    s.value = `${subtitle}   ·   ${this.i18n.t('Exported {date}', { date: this.i18n.shortDate(new Date()) })}`;
    s.font = { name: FONT, size: 11, color: { argb: COLOR.headerText } };
    s.fill = this.solid(COLOR.primary);
    s.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;
    ws.getRow(2).height = 20;
  }

  private sectionTitle(ws: Worksheet, row: number, text: string, cols: number) {
    ws.mergeCells(row, 1, row, cols);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { name: FONT, size: 13, bold: true, color: { argb: COLOR.primaryDark } };
    c.border = { bottom: { style: 'medium', color: { argb: COLOR.primary } } };
    ws.getRow(row).height = 22;
  }

  private headerRow(row: Row, headers: string[]) {
    row.values = headers;
    row.height = 22;
    row.eachCell(cell => {
      cell.font = { name: FONT, bold: true, color: { argb: COLOR.headerText } };
      cell.fill = this.solid(COLOR.primary);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.border();
    });
  }

  private bodyRow(row: Row, cols: number, index: number, moneyCols: number[]) {
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      this.baseCell(cell);
      if (index % 2 === 1) cell.fill = this.solid(COLOR.stripe);
      if (moneyCols.includes(c)) {
        cell.numFmt = MONEY;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
  }

  private totalRow(row: Row, cols: number, moneyCols: number[]) {
    row.height = 22;
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      this.baseCell(cell);
      cell.font = { name: FONT, bold: true, color: { argb: COLOR.primaryDark } };
      cell.fill = this.solid(COLOR.totalFill);
      cell.border = { ...this.border(), top: { style: 'medium', color: { argb: COLOR.primary } } };
      if (moneyCols.includes(c)) {
        cell.numFmt = MONEY;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
  }

  private baseCell(cell: Cell) {
    cell.font = { name: FONT, size: 11 };
    cell.border = this.border();
    cell.alignment = { vertical: 'middle' };
  }

  private border() {
    const side = { style: 'thin' as const, color: { argb: COLOR.border } };
    return { top: side, left: side, bottom: side, right: side };
  }

  private solid(argb: string) {
    return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
  }

  private colLetter(n: number): string {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async download(wb: Workbook, fileName: string) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
}
