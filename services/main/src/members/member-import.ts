import ExcelJS from 'exceljs';

// A worksheet's first row is always treated as headers, everything else as
// data — matches how a cooperative's own member list is almost always
// laid out in a real spreadsheet. Every cell is coerced to a trimmed
// string regardless of its native Excel type (text, rich text, a date
// someone typed for a join date, a number), since a name or email column
// is only ever meaningfully a string here.
export interface ParsedSheet {
  columns: string[];
  rows: string[][];
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((fragment) => fragment.text).join('');
    }
    if ('text' in value) {
      return String(value.text);
    }
    // A formula, hyperlink-without-display-text, or error cell — none of
    // these are ever a meaningful name or email, so this behaves the same
    // as an empty cell rather than stringifying to "[object Object]".
    return '';
  }
  return String(value).trim();
}

// Parses only the first sheet — a member list is a single flat table, not
// a workbook with multiple related sheets.
export async function parseMemberImportWorkbook(
  buffer: Buffer,
): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  // See export.service.spec.ts's loadWorkbook comment: exceljs's own
  // ambient `Buffer` type is distinct from @types/node's, and `as never`
  // is the one cast that routes around it regardless of which "Buffer" is
  // meant — a real Buffer is what's passed at runtime.
  await workbook.xlsx.load(buffer as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { columns: [], rows: [] };
  }

  const allRows: string[][] = [];
  worksheet.eachRow((row) => {
    // exceljs' row.values is 1-indexed with an empty slot at [0].
    const cells = (row.values as ExcelJS.CellValue[])
      .slice(1)
      .map(cellToString);
    allRows.push(cells);
  });

  const [columns, ...rows] = allRows;
  return { columns: columns ?? [], rows };
}

export interface MappedMemberRow {
  name: string;
  email: string | null;
}

// Combines the mapped name column(s) (joined with a space, for a "first
// name" + "last name" style sheet) and reads the optional email column.
// Returns null for a row with no usable name at all — the caller reports
// that as a skipped row rather than guessing a name.
export function applyMemberImportMapping(
  rows: string[][],
  mapping: { nameColumns: number[]; emailColumn?: number },
): Array<MappedMemberRow | null> {
  return rows.map((row) => {
    const name = mapping.nameColumns
      .map((index) => row[index]?.trim())
      .filter((part): part is string => !!part)
      .join(' ')
      .trim();
    if (!name) {
      return null;
    }
    const email =
      mapping.emailColumn !== undefined
        ? (row[mapping.emailColumn]?.trim() ?? '') || null
        : null;
    return { name, email };
  });
}
