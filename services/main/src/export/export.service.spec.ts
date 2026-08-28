import ExcelJS from 'exceljs';

import { buildExportFilename, ExportService } from './export.service';

// exceljs ships its own ambient `Buffer` declaration (`interface Buffer
// extends ArrayBuffer`) that .load() is typed against, distinct from the
// real Node `Buffer` from @types/node this file otherwise uses — a bug in
// exceljs's own types, not a real type mismatch, and one `as unknown as
// Buffer` can't route around since both sides print as "Buffer". `as
// never` is the one cast TypeScript allows unconditionally regardless of
// which "Buffer" is meant; a real Buffer is what's passed at runtime.
async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook;
}

describe('ExportService', () => {
  const service = new ExportService();

  it('builds a real workbook that a spreadsheet reader can parse back', async () => {
    const buffer = await service.buildWorkbook([
      {
        name: 'Overview',
        columns: [
          { header: 'Member', key: 'member' },
          { header: 'Amount', key: 'amount' },
        ],
        rows: [
          { member: 'a@example.com', amount: 1000 },
          { member: 'b@example.com', amount: 2000 },
        ],
      },
    ]);

    const workbook = await loadWorkbook(buffer);

    const worksheet = workbook.getWorksheet('Overview');
    expect(worksheet).toBeDefined();
    expect(worksheet?.getRow(1).getCell(1).value).toBe('Member');
    expect(worksheet?.getRow(1).getCell(2).value).toBe('Amount');
    expect(worksheet?.getRow(2).getCell(1).value).toBe('a@example.com');
    expect(worksheet?.getRow(2).getCell(2).value).toBe(1000);
    expect(worksheet?.getRow(3).getCell(1).value).toBe('b@example.com');
    expect(worksheet?.getRow(3).getCell(2).value).toBe(2000);
  });

  it('writes one worksheet per sheet passed in, in order', async () => {
    const buffer = await service.buildWorkbook([
      {
        name: 'By period',
        columns: [{ header: 'Period', key: 'period' }],
        rows: [],
      },
      {
        name: 'By member',
        columns: [{ header: 'Email', key: 'email' }],
        rows: [],
      },
    ]);

    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'By period',
      'By member',
    ]);
  });
});

describe('buildExportFilename', () => {
  it('joins parts with dashes and appends .xlsx', () => {
    expect(buildExportFilename(['acme-coop', 'contributions', '2026-08'])).toBe(
      'acme-coop-contributions-2026-08.xlsx',
    );
  });

  it('lowercases and strips characters unsafe in a filename', () => {
    expect(buildExportFilename(['Acme Coop', 'Contributions Ledger'])).toBe(
      'acme-coop-contributions-ledger.xlsx',
    );
  });

  it('drops empty parts rather than leaving a stray dash', () => {
    expect(buildExportFilename(['acme-coop', '', 'contributions'])).toBe(
      'acme-coop-contributions.xlsx',
    );
  });
});
