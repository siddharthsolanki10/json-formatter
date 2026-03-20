export interface ParsedTableData {
  headers: string[];
  rows: string[][];
}

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  columnIndex: number | null;
  direction: SortDirection;
}

export type NoteTarget =
  | { type: "row"; rowIndex: number }
  | { type: "cell"; rowIndex: number; colIndex: number };

export type NotesMap = Record<string, string>;

export interface DuplicateMetadata {
  duplicateCellKeys: Set<string>;
  duplicateRows: Set<number>;
  vinColumnIndex: number | null;
  invoiceColumnIndex: number | null;
}

export interface TableSelection {
  rowIndex: number | null;
  colIndex: number | null;
}
