import type { DuplicateMetadata } from "../types";

function normalizeHeaderForLookup(header: string): string {
  return header.replaceAll(/[^A-Z0-9]/g, "");
}

function findColumnIndex(headers: string[], aliases: string[]): number | null {
  const aliasSet = new Set(aliases.map((alias) => alias.toUpperCase()));

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index].toUpperCase();
    const normalizedHeader = normalizeHeaderForLookup(header);

    if (aliasSet.has(header) || aliasSet.has(normalizedHeader)) {
      return index;
    }
  }

  return null;
}

function collectDuplicateValues(
  rows: string[][],
  columnIndex: number,
): Set<string> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = row[columnIndex]?.trim() ?? "";
    if (value.length === 0) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicates = new Set<string>();
  for (const [value, count] of counts.entries()) {
    if (count > 1) {
      duplicates.add(value);
    }
  }

  return duplicates;
}

export function buildDuplicateMetadata(
  headers: string[],
  rows: string[][],
): DuplicateMetadata {
  const vinColumnIndex = findColumnIndex(headers, ["VIN"]);
  const invoiceColumnIndex = findColumnIndex(headers, [
    "RO_INVOICE_NUMBER",
    "INVOICE",
    "INVOICENUMBER",
  ]);

  const duplicateCellKeys = new Set<string>();
  const duplicateRows = new Set<number>();

  const targetColumns: number[] = [];
  if (vinColumnIndex !== null) {
    targetColumns.push(vinColumnIndex);
  }
  if (invoiceColumnIndex !== null) {
    targetColumns.push(invoiceColumnIndex);
  }

  for (const columnIndex of targetColumns) {
    const duplicateValues = collectDuplicateValues(rows, columnIndex);

    if (duplicateValues.size === 0) {
      continue;
    }

    rows.forEach((row, rowIndex) => {
      const value = row[columnIndex]?.trim() ?? "";
      if (!duplicateValues.has(value)) {
        return;
      }

      duplicateCellKeys.add(`${rowIndex}:${columnIndex}`);
      duplicateRows.add(rowIndex);
    });
  }

  return {
    duplicateCellKeys,
    duplicateRows,
    vinColumnIndex,
    invoiceColumnIndex,
  };
}
