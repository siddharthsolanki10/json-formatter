import type { NotesMap } from "../types";

const NOTES_STORAGE_KEY = "txt-grid-notes";
const THEME_STORAGE_KEY = "txt-grid-theme";

export type ThemeMode = "light" | "dark";

export function buildRowNoteKey(rowIndex: number): string {
  return `row:${rowIndex}`;
}

export function buildCellNoteKey(rowIndex: number, colIndex: number): string {
  return `cell:${rowIndex}:${colIndex}`;
}

export function loadNotes(): NotesMap {
  const rawValue = window.localStorage.getItem(NOTES_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: NotesMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function saveNotes(notes: NotesMap): void {
  window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export function loadThemeMode(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function saveThemeMode(theme: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
