import { parseCsvLine } from "../csv";

// Parse a CSV document into header-keyed row objects. Reuses the quote-aware
// line splitter from lib/csv. Blank lines are skipped; ragged rows are tolerated
// (missing trailing cells read as ""). nflverse/DynastyProcess use "NA" for
// nulls, which callers can treat as empty.
export function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const v = cells[c] ?? "";
      row[header[c]] = v === "NA" ? "" : v;
    }
    rows.push(row);
  }
  return rows;
}
