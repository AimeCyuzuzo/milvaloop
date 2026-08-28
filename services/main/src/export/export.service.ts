import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

// A cell value restricted to what every export sheet actually needs to
// write — plain data, not exceljs' full CellValue union (rich text,
// formulas, hyperlinks) which no feature here has a reason to produce.
export type ExportCellValue = string | number | boolean | Date | null;

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportSheet {
  name: string;
  columns: ExportColumn[];
  rows: Array<Record<string, ExportCellValue>>;
}

// The one place that turns tabular data into a real .xlsx file — every
// feature that needs a spreadsheet export (contributions today, whatever
// comes after it) builds its own `ExportSheet[]` from data it already
// computed and hands it here, rather than each reimplementing workbook
// construction. Real OOXML via exceljs, not a hand-rolled CSV-with-an-
// .xlsx-extension — a cooperative's treasurer opening this in Excel or
// LibreOffice gets real column widths and a real sheet, not a text file
// wearing a spreadsheet's extension.
@Injectable()
export class ExportService {
  async buildWorkbook(sheets: ExportSheet[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name);
      worksheet.columns = sheet.columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width ?? Math.max(column.header.length + 2, 12),
      }));
      worksheet.getRow(1).font = { bold: true };
      for (const row of sheet.rows) {
        worksheet.addRow(row);
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

// A filename that names its own context (cooperative, report, date/period)
// rather than a generic "export.xlsx" — every export endpoint builds its
// parts (e.g. `[tenantSlug, 'contributions', 'analytics', asOfPeriod]`) and
// hands them here rather than assembling the string itself, so every
// feature's export is named the same consistent way. `tenantSlug` is
// already filesystem-safe (see packages/types/src/tenant.ts's slugify);
// this only needs to guard against a value that isn't, e.g. someone's
// email address in a filter.
export function buildExportFilename(parts: string[]): string {
  const safeParts = parts.map((part) =>
    part
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  );
  return `${safeParts.filter(Boolean).join('-')}.xlsx`;
}
