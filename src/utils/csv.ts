function escapeCsvValue(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const headerRow = headers.map(escapeCsvValue).join(",");
  const rowLines = rows.map((row) =>
    row.map((value) => escapeCsvValue(value)).join(","),
  );
  return [headerRow, ...rowLines].join("\n");
}
