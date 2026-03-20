import type { NotesMap } from "../types";

const NOTES_STORAGE_KEY = "txt-grid-notes";
const THEME_STORAGE_KEY = "txt-grid-theme";
const INPUT_DRAFT_STORAGE_KEY = "tablecraft-input-draft";
const SEARCH_DRAFT_STORAGE_KEY = "tablecraft-search-draft";

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

export function loadInputDraft(): string {
  return window.localStorage.getItem(INPUT_DRAFT_STORAGE_KEY) ?? "";
}

export function saveInputDraft(value: string): void {
  window.localStorage.setItem(INPUT_DRAFT_STORAGE_KEY, value);
}

export function clearInputDraft(): void {
  window.localStorage.removeItem(INPUT_DRAFT_STORAGE_KEY);
}

export function loadSearchDraft(): string {
  return window.localStorage.getItem(SEARCH_DRAFT_STORAGE_KEY) ?? "";
}

export function saveSearchDraft(value: string): void {
  window.localStorage.setItem(SEARCH_DRAFT_STORAGE_KEY, value);
}

export function clearSearchDraft(): void {
  window.localStorage.removeItem(SEARCH_DRAFT_STORAGE_KEY);
}
