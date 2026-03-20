import type { ParsedTableData } from "../types";

function shouldKeepRow(row: string[]): boolean {
  return row.length > 1 || row.some((cell) => cell.length > 0);
}

function normalizeHeaders(rawHeaders: string[]): string[] {
  return rawHeaders.map((header, index) => {
    const normalized = header.trim();
    return normalized.length > 0 ? normalized : `Column ${index + 1}`;
  });
}

export function parsePipeSeparatedText(input: string): ParsedTableData {
  const source = input.replace(/^\uFEFF/, "");
  const parsedRows: string[][] = [];

  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"') {
      const nextChar = source[index + 1];

      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && char === "|") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (shouldKeepRow(row)) {
        parsedRows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (shouldKeepRow(row)) {
      parsedRows.push(row);
    }
  }

  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = parsedRows[0];
  const maxColumns = parsedRows.reduce(
    (max, currentRow) => Math.max(max, currentRow.length),
    rawHeaders.length,
  );
  const headers = normalizeHeaders(rawHeaders);

  while (headers.length < maxColumns) {
    headers.push(`Column ${headers.length + 1}`);
  }

  const rows = parsedRows.slice(1).map((currentRow) => {
    const normalizedRow = [...currentRow];
    while (normalizedRow.length < maxColumns) {
      normalizedRow.push("");
    }
    return normalizedRow.slice(0, maxColumns);
  });

  return {
    headers,
    rows,
  };
}
