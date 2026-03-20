import "./style.css";
import {
  buildCellNoteKey,
  buildRowNoteKey,
  loadNotes,
  loadThemeMode,
  saveNotes,
  saveThemeMode,
  type ThemeMode,
} from "./services/storage";
import type {
  NoteTarget,
  ParsedTableData,
  SortDirection,
  SortState,
  TableSelection,
} from "./types";
import { debounce } from "./utils/debounce";
import { buildDuplicateMetadata } from "./utils/duplicates";
import { parsePipeSeparatedText } from "./utils/parser";
import { buildCsvContent } from "./utils/csv";
import { VirtualTable } from "./ui/virtualTable";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Application root not found.");
}

appElement.innerHTML = `
  <div class="app-shell">
    <div class="bg-orb orb-left"></div>
    <div class="bg-orb orb-right"></div>

    <header class="topbar card">
      <div>
        <h1>TXT Table Studio</h1>
        <p>Upload or paste pipe-delimited text and explore it with high-speed table tools.</p>
      </div>
      <div class="topbar-actions">
        <button id="themeToggleBtn" class="btn subtle" type="button">Theme</button>
        <button id="fullscreenToggleBtn" class="btn subtle" type="button">Fullscreen</button>
        <button id="exportCsvBtn" class="btn" type="button">Export CSV</button>
        <button id="copyRowBtn" class="btn" type="button">Copy Selected Row</button>
      </div>
    </header>

    <section class="controls-grid">
      <div class="card input-card">
        <div class="input-actions">
          <label class="file-picker btn subtle" for="fileInput">
            Upload TXT
            <input id="fileInput" type="file" accept=".txt,text/plain" />
          </label>
          <button id="parseBtn" class="btn primary" type="button">Create Table</button>
          <button id="clearBtn" class="btn subtle" type="button">Clear</button>
        </div>

        <textarea id="inputText" placeholder="Paste pipe-separated data here..."></textarea>

        <div class="meta-row">
          <div id="parseSummary" class="meta-pill">No dataset loaded.</div>
          <div id="rowsSummary" class="meta-pill">Rows: 0</div>
          <div id="duplicatesSummary" class="meta-pill">Duplicates: 0</div>
        </div>

        <div class="search-wrap">
          <input id="searchInput" type="search" placeholder="Search rows (debounced)..." />
          <span id="actionStatus" class="action-status" aria-live="polite"></span>
        </div>
      </div>

      <aside class="card row-details-card">
        <h2>Selected Row Details</h2>
        <div id="rowDetails" class="row-details-empty">Select any row or cell to inspect values.</div>
      </aside>
    </section>

    <section class="workspace-grid">
      <div class="card table-card">
        <div id="tableRoot" class="table-root"></div>
      </div>

      <aside class="card notes-card">
        <h2>Notes</h2>
        <p id="noteTargetLabel" class="note-target-label">Select a row or cell to attach notes.</p>
        <textarea id="noteInput" class="note-input" placeholder="Write a note for the selected row/cell..." disabled></textarea>
        <div class="note-actions">
          <button id="saveNoteBtn" class="btn primary" type="button" disabled>Save Note</button>
          <button id="deleteNoteBtn" class="btn subtle" type="button" disabled>Delete Note</button>
        </div>
        <p id="noteMeta" class="note-meta">No target selected.</p>
      </aside>
    </section>
  </div>

  <div id="loadingOverlay" class="loading-overlay hidden" aria-live="assertive">
    <div class="loading-card">
      <span class="loader"></span>
      <p>Parsing data...</p>
    </div>
  </div>
`;

const elements = {
  fileInput: document.querySelector<HTMLInputElement>("#fileInput")!,
  inputText: document.querySelector<HTMLTextAreaElement>("#inputText")!,
  parseBtn: document.querySelector<HTMLButtonElement>("#parseBtn")!,
  clearBtn: document.querySelector<HTMLButtonElement>("#clearBtn")!,
  searchInput: document.querySelector<HTMLInputElement>("#searchInput")!,
  exportCsvBtn: document.querySelector<HTMLButtonElement>("#exportCsvBtn")!,
  copyRowBtn: document.querySelector<HTMLButtonElement>("#copyRowBtn")!,
  themeToggleBtn: document.querySelector<HTMLButtonElement>("#themeToggleBtn")!,
  fullscreenToggleBtn: document.querySelector<HTMLButtonElement>(
    "#fullscreenToggleBtn",
  )!,
  parseSummary: document.querySelector<HTMLDivElement>("#parseSummary")!,
  rowsSummary: document.querySelector<HTMLDivElement>("#rowsSummary")!,
  duplicatesSummary:
    document.querySelector<HTMLDivElement>("#duplicatesSummary")!,
  actionStatus: document.querySelector<HTMLSpanElement>("#actionStatus")!,
  rowDetails: document.querySelector<HTMLDivElement>("#rowDetails")!,
  noteTargetLabel:
    document.querySelector<HTMLParagraphElement>("#noteTargetLabel")!,
  noteInput: document.querySelector<HTMLTextAreaElement>("#noteInput")!,
  saveNoteBtn: document.querySelector<HTMLButtonElement>("#saveNoteBtn")!,
  deleteNoteBtn: document.querySelector<HTMLButtonElement>("#deleteNoteBtn")!,
  noteMeta: document.querySelector<HTMLParagraphElement>("#noteMeta")!,
  loadingOverlay: document.querySelector<HTMLDivElement>("#loadingOverlay")!,
  tableRoot: document.querySelector<HTMLDivElement>("#tableRoot")!,
  tableCard: document.querySelector<HTMLDivElement>(".table-card")!,
};

const emptyParsedData: ParsedTableData = { headers: [], rows: [] };

const state = {
  parsedData: emptyParsedData,
  hasLoadedData: false,
  sortState: { columnIndex: null, direction: null } as SortState,
  searchQuery: "",
  displayRowIndices: [] as number[],
  notes: loadNotes(),
  selection: { rowIndex: null, colIndex: null } as TableSelection,
  noteTarget: null as NoteTarget | null,
  parseDurationMs: 0,
  duplicateMetadata: buildDuplicateMetadata([], []),
};

let statusTimer = 0;

const table = new VirtualTable(elements.tableRoot, {
  onSortRequest: (columnIndex) => {
    toggleSort(columnIndex);
    deriveAndRender();
  },
  onSelectRow: (rowIndex) => {
    state.selection = { rowIndex, colIndex: null };
    state.noteTarget = { type: "row", rowIndex };
    renderTableOnly();
    renderRowDetails();
    renderNotesPanel();
  },
  onSelectCell: (rowIndex, colIndex) => {
    state.selection = { rowIndex, colIndex };
    state.noteTarget = { type: "cell", rowIndex, colIndex };
    renderTableOnly();
    renderRowDetails();
    renderNotesPanel();
  },
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setLoading(isLoading: boolean): void {
  elements.loadingOverlay.classList.toggle("hidden", !isLoading);
}

function setStatus(message: string): void {
  elements.actionStatus.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    elements.actionStatus.textContent = "";
  }, 3000);
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  elements.themeToggleBtn.textContent =
    mode === "dark" ? "Light Mode" : "Dark Mode";
}

function updateFullscreenButton(): void {
  const isFullscreen = document.fullscreenElement === elements.tableCard;
  elements.fullscreenToggleBtn.textContent = isFullscreen
    ? "Exit Fullscreen"
    : "Fullscreen";
}

async function openTableFullscreen(): Promise<void> {
  if (!document.fullscreenEnabled) {
    return;
  }

  if (document.fullscreenElement === elements.tableCard) {
    return;
  }

  try {
    await elements.tableCard.requestFullscreen();
  } catch {
    setStatus("Table created. Fullscreen was blocked by the browser.");
  }
}

async function toggleTableFullscreen(): Promise<void> {
  if (!document.fullscreenEnabled) {
    setStatus("Fullscreen is not supported in this browser.");
    return;
  }

  if (document.fullscreenElement === elements.tableCard) {
    await document.exitFullscreen();
    return;
  }

  try {
    await elements.tableCard.requestFullscreen();
  } catch {
    setStatus("Fullscreen request was blocked by the browser.");
  }
}

function buildEmptyMessage(): string {
  if (!state.hasLoadedData) {
    return "Upload a .txt file or paste pipe-separated text to start.";
  }

  if (state.displayRowIndices.length === 0) {
    return "No rows match the current filter.";
  }

  return "";
}

function renderTableOnly(): void {
  table.update({
    headers: state.parsedData.headers,
    rows: state.parsedData.rows,
    displayRowIndices: state.displayRowIndices,
    sortState: state.sortState,
    notes: state.notes,
    selection: state.selection,
    duplicateCellKeys: state.duplicateMetadata.duplicateCellKeys,
    duplicateRows: state.duplicateMetadata.duplicateRows,
    emptyMessage: buildEmptyMessage(),
  });
}

function renderSummaries(): void {
  const totalRows = state.parsedData.rows.length;
  const visibleRows = state.displayRowIndices.length;

  if (!state.hasLoadedData) {
    elements.parseSummary.textContent = "No dataset loaded.";
  } else {
    elements.parseSummary.textContent = `Parsed ${state.parsedData.headers.length} columns in ${state.parseDurationMs.toFixed(1)} ms`;
  }

  elements.rowsSummary.textContent = `Rows: ${visibleRows.toLocaleString()} / ${totalRows.toLocaleString()}`;

  const duplicateRowsCount = state.duplicateMetadata.duplicateRows.size;
  if (duplicateRowsCount === 0) {
    elements.duplicatesSummary.textContent = "Duplicates: 0";
    return;
  }

  const focusColumns: string[] = [];
  if (state.duplicateMetadata.vinColumnIndex !== null) {
    focusColumns.push("VIN");
  }
  if (state.duplicateMetadata.invoiceColumnIndex !== null) {
    focusColumns.push("Invoice");
  }

  elements.duplicatesSummary.textContent = `Duplicates: ${duplicateRowsCount.toLocaleString()} rows (${focusColumns.join(" + ")})`;
}

function renderRowDetails(): void {
  const rowIndex = state.selection.rowIndex;
  if (rowIndex === null || !state.parsedData.rows[rowIndex]) {
    elements.rowDetails.className = "row-details-empty";
    elements.rowDetails.textContent =
      "Select any row or cell to inspect values.";
    return;
  }

  const row = state.parsedData.rows[rowIndex];
  const details = state.parsedData.headers
    .map((header, colIndex) => {
      const value = row[colIndex] ?? "";
      const renderedValue =
        value.length > 0
          ? escapeHtml(value)
          : '<span class="empty-inline">""</span>';

      return `
        <li>
          <strong>${escapeHtml(header)}</strong>
          <span>${renderedValue}</span>
        </li>
      `;
    })
    .join("");

  elements.rowDetails.className = "row-details-list-wrap";
  elements.rowDetails.innerHTML = `
    <div class="row-details-meta">Source row: ${rowIndex + 1}</div>
    <ul class="row-details-list">${details}</ul>
  `;
}

function getNoteKey(target: NoteTarget): string {
  if (target.type === "row") {
    return buildRowNoteKey(target.rowIndex);
  }

  return buildCellNoteKey(target.rowIndex, target.colIndex);
}

function renderNotesPanel(): void {
  if (!state.noteTarget) {
    elements.noteTargetLabel.textContent =
      "Select a row or cell to attach notes.";
    elements.noteInput.value = "";
    elements.noteInput.disabled = true;
    elements.saveNoteBtn.disabled = true;
    elements.deleteNoteBtn.disabled = true;
    elements.noteMeta.textContent = "No target selected.";
    return;
  }

  elements.noteInput.disabled = false;
  elements.saveNoteBtn.disabled = false;
  elements.deleteNoteBtn.disabled = false;

  if (state.noteTarget.type === "row") {
    elements.noteTargetLabel.textContent = `Row ${state.noteTarget.rowIndex + 1}`;
  } else {
    const header =
      state.parsedData.headers[state.noteTarget.colIndex] ??
      `Column ${state.noteTarget.colIndex + 1}`;
    elements.noteTargetLabel.textContent = `Row ${state.noteTarget.rowIndex + 1} - ${header}`;
  }

  const noteKey = getNoteKey(state.noteTarget);
  const currentNote = state.notes[noteKey] ?? "";

  elements.noteInput.value = currentNote;
  elements.noteMeta.textContent =
    currentNote.length > 0
      ? `Saved note length: ${currentNote.length}`
      : "No note saved for this target.";
}

function isNumeric(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Number(value));
}

function compareValues(
  leftValue: string,
  rightValue: string,
  direction: Exclude<SortDirection, null>,
): number {
  const leftIsNumeric = isNumeric(leftValue);
  const rightIsNumeric = isNumeric(rightValue);

  let comparison = 0;
  if (leftIsNumeric && rightIsNumeric) {
    comparison = Number(leftValue) - Number(rightValue);
  } else {
    comparison = leftValue.localeCompare(rightValue, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  return direction === "asc" ? comparison : -comparison;
}

function computeDisplayRows(): number[] {
  const rows = state.parsedData.rows;
  const baseIndices = rows.map((_, index) => index);
  const normalizedQuery = state.searchQuery.trim().toLowerCase();

  let filteredIndices = baseIndices;
  if (normalizedQuery.length > 0) {
    filteredIndices = baseIndices.filter((rowIndex) => {
      const row = rows[rowIndex];
      return row.some((cell) => cell.toLowerCase().includes(normalizedQuery));
    });
  }

  const { columnIndex, direction } = state.sortState;
  if (columnIndex === null || direction === null) {
    return filteredIndices;
  }

  return [...filteredIndices].sort((leftRowIndex, rightRowIndex) => {
    const leftValue = rows[leftRowIndex][columnIndex] ?? "";
    const rightValue = rows[rightRowIndex][columnIndex] ?? "";

    const byValue = compareValues(leftValue, rightValue, direction);
    if (byValue !== 0) {
      return byValue;
    }

    return leftRowIndex - rightRowIndex;
  });
}

function deriveAndRender(): void {
  state.displayRowIndices = computeDisplayRows();
  renderTableOnly();
  renderSummaries();
  renderRowDetails();
}

function toggleSort(columnIndex: number): void {
  if (state.sortState.columnIndex !== columnIndex) {
    state.sortState = { columnIndex, direction: "asc" };
    return;
  }

  if (state.sortState.direction === "asc") {
    state.sortState = { columnIndex, direction: "desc" };
    return;
  }

  if (state.sortState.direction === "desc") {
    state.sortState = { columnIndex: null, direction: null };
    return;
  }

  state.sortState = { columnIndex, direction: "asc" };
}

function saveCurrentNote(): void {
  if (!state.noteTarget) {
    return;
  }

  const noteKey = getNoteKey(state.noteTarget);
  const noteText = elements.noteInput.value.trim();

  if (noteText.length === 0) {
    delete state.notes[noteKey];
    setStatus("Note removed.");
  } else {
    state.notes[noteKey] = noteText;
    setStatus("Note saved.");
  }

  saveNotes(state.notes);
  renderNotesPanel();
  renderTableOnly();
}

function deleteCurrentNote(): void {
  if (!state.noteTarget) {
    return;
  }

  const noteKey = getNoteKey(state.noteTarget);
  if (!state.notes[noteKey]) {
    setStatus("No note to delete.");
    return;
  }

  delete state.notes[noteKey];
  saveNotes(state.notes);
  renderNotesPanel();
  renderTableOnly();
  setStatus("Note deleted.");
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise<void>((resolve, reject) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.focus();
    textArea.select();

    const copied = document.execCommand("copy");
    textArea.remove();

    if (copied) {
      resolve();
    } else {
      reject(new Error("Copy command failed."));
    }
  });
}

async function parseInput(openFullscreen = false): Promise<void> {
  const sourceText = elements.inputText.value;

  if (sourceText.trim().length === 0) {
    setStatus("Paste data or upload a TXT file first.");
    return;
  }

  if (openFullscreen) {
    await openTableFullscreen();
  }

  setLoading(true);
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });

  const startTime = performance.now();
  const parsed = parsePipeSeparatedText(sourceText);
  const parseDuration = performance.now() - startTime;

  state.parsedData = parsed;
  state.hasLoadedData = true;
  state.sortState = { columnIndex: null, direction: null };
  state.searchQuery = elements.searchInput.value;
  state.selection = { rowIndex: null, colIndex: null };
  state.noteTarget = null;
  state.parseDurationMs = parseDuration;
  state.duplicateMetadata = buildDuplicateMetadata(parsed.headers, parsed.rows);

  deriveAndRender();
  renderNotesPanel();

  setLoading(false);
  setStatus("Dataset parsed successfully.");
}

elements.fileInput.addEventListener("change", async () => {
  const file = elements.fileInput.files?.[0];

  if (!file) {
    return;
  }

  const fileText = await file.text();
  elements.inputText.value = fileText;
  setStatus(`Loaded ${file.name}`);
});

elements.parseBtn.addEventListener("click", () => {
  void parseInput(true);
});

elements.fullscreenToggleBtn.addEventListener("click", () => {
  void toggleTableFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
});

elements.clearBtn.addEventListener("click", () => {
  elements.inputText.value = "";
  elements.searchInput.value = "";
  elements.fileInput.value = "";

  state.parsedData = emptyParsedData;
  state.hasLoadedData = false;
  state.sortState = { columnIndex: null, direction: null };
  state.searchQuery = "";
  state.selection = { rowIndex: null, colIndex: null };
  state.noteTarget = null;
  state.parseDurationMs = 0;
  state.duplicateMetadata = buildDuplicateMetadata([], []);

  deriveAndRender();
  renderNotesPanel();
  setStatus("Workspace cleared.");
});

const debouncedSearch = debounce<[string]>((query) => {
  state.searchQuery = query;
  deriveAndRender();
}, 220);

elements.searchInput.addEventListener("input", () => {
  debouncedSearch(elements.searchInput.value);
});

elements.exportCsvBtn.addEventListener("click", () => {
  if (!state.hasLoadedData || state.parsedData.headers.length === 0) {
    setStatus("Nothing to export yet.");
    return;
  }

  const visibleRows = state.displayRowIndices.map(
    (rowIndex) => state.parsedData.rows[rowIndex],
  );
  const csvContent = buildCsvContent(state.parsedData.headers, visibleRows);

  const datePart = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadCsv(`table-export-${datePart}.csv`, csvContent);
  setStatus("CSV export generated.");
});

elements.copyRowBtn.addEventListener("click", async () => {
  const rowIndex = state.selection.rowIndex;

  if (rowIndex === null || !state.parsedData.rows[rowIndex]) {
    setStatus("Select a row to copy.");
    return;
  }

  const row = state.parsedData.rows[rowIndex];
  const asObject: Record<string, string> = {};

  state.parsedData.headers.forEach((header, columnIndex) => {
    asObject[header] = row[columnIndex] ?? "";
  });

  try {
    await copyText(JSON.stringify(asObject, null, 2));
    setStatus("Selected row copied to clipboard.");
  } catch {
    setStatus("Copy failed. Browser permissions may block clipboard access.");
  }
});

elements.themeToggleBtn.addEventListener("click", () => {
  const currentTheme =
    (document.documentElement.dataset.theme as ThemeMode | undefined) ??
    "light";
  const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  saveThemeMode(nextTheme);
});

elements.saveNoteBtn.addEventListener("click", () => {
  saveCurrentNote();
});

elements.deleteNoteBtn.addEventListener("click", () => {
  deleteCurrentNote();
});

elements.noteInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    saveCurrentNote();
  }
});

const initialTheme = loadThemeMode();
applyTheme(initialTheme);
updateFullscreenButton();
renderNotesPanel();
deriveAndRender();
