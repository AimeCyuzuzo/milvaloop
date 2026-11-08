import { applyMemberImportMapping } from './member-import';

describe('applyMemberImportMapping', () => {
  it('combines two name columns with a space', () => {
    const rows = [['Aime', 'Cyuzuzo', 'aime@example.com']];
    const result = applyMemberImportMapping(rows, {
      nameColumns: [0, 1],
      emailColumn: 2,
    });
    expect(result).toEqual([
      { name: 'Aime Cyuzuzo', email: 'aime@example.com' },
    ]);
  });

  it('reads a single name column with no email column', () => {
    const rows = [['Beata Uwase']];
    const result = applyMemberImportMapping(rows, { nameColumns: [0] });
    expect(result).toEqual([{ name: 'Beata Uwase', email: null }]);
  });

  it('returns null for a row with no usable name', () => {
    const rows = [['', '']];
    const result = applyMemberImportMapping(rows, { nameColumns: [0, 1] });
    expect(result).toEqual([null]);
  });

  it('treats a blank email cell as no email', () => {
    const rows = [['Chantal', '  ']];
    const result = applyMemberImportMapping(rows, {
      nameColumns: [0],
      emailColumn: 1,
    });
    expect(result).toEqual([{ name: 'Chantal', email: null }]);
  });
});
