import { buildCellNoteKey, buildRowNoteKey } from "../services/storage";
import type { NotesMap, SortState, TableSelection } from "../types";

interface VirtualTableCallbacks {
  onSortRequest: (columnIndex: number) => void;
  onSelectRow: (rowIndex: number) => void;
  onSelectCell: (rowIndex: number, colIndex: number) => void;
}

export interface TableViewModel {
  headers: string[];
  rows: string[][];
  displayRowIndices: number[];
  sortState: SortState;
  notes: NotesMap;
  selection: TableSelection;
  duplicateCellKeys: Set<string>;
  duplicateRows: Set<number>;
  emptyMessage: string;
}

const ROW_INDEX_COLUMN_WIDTH = 82;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class VirtualTable {
  private readonly root: HTMLElement;
  private readonly callbacks: VirtualTableCallbacks;
  private readonly scrollEl: HTMLDivElement;
  private readonly colGroupEl: HTMLTableColElement;
  private readonly headEl: HTMLTableSectionElement;
  private readonly bodyEl: HTMLTableSectionElement;
  private readonly emptyStateEl: HTMLDivElement;

  private model: TableViewModel = {
    headers: [],
    rows: [],
    displayRowIndices: [],
    sortState: { columnIndex: null, direction: null },
    notes: {},
    selection: { rowIndex: null, colIndex: null },
    duplicateCellKeys: new Set<string>(),
    duplicateRows: new Set<number>(),
    emptyMessage: "Upload or paste data to render the table.",
  };

  private columnWidths: number[] = [];
  private readonly rowHeight = 40;
  private readonly overscan = 10;
  private lastRangeKey = "";

  constructor(root: HTMLElement, callbacks: VirtualTableCallbacks) {
    this.root = root;
    this.callbacks = callbacks;

    this.root.innerHTML = `
      <div class="table-empty-state"></div>
      <div class="table-scroll" aria-live="polite">
        <table class="data-table">
          <colgroup></colgroup>
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    this.emptyStateEl =
      this.root.querySelector<HTMLDivElement>(".table-empty-state")!;
    this.scrollEl = this.root.querySelector<HTMLDivElement>(".table-scroll")!;
    this.colGroupEl = this.root.querySelector<HTMLTableColElement>("colgroup")!;
    this.headEl = this.root.querySelector<HTMLTableSectionElement>("thead")!;
    this.bodyEl = this.root.querySelector<HTMLTableSectionElement>("tbody")!;

    this.attachListeners();
    this.renderEmptyState();
  }

  update(model: TableViewModel): void {
    const hasHeaderChange =
      this.model.headers.length !== model.headers.length ||
      this.model.headers.some(
        (header, index) => header !== model.headers[index],
      );

    this.model = model;

    if (hasHeaderChange) {
      this.initializeColumnWidths();
      this.scrollEl.scrollTop = 0;
      this.lastRangeKey = "";
    }

    this.renderColGroup();
    this.renderHeader();
    this.renderEmptyState();
    this.renderBody(true);
  }

  private isScrollPending = false;

  private attachListeners(): void {
    this.scrollEl.addEventListener("scroll", this.handleScroll);
    this.headEl.addEventListener("click", this.handleHeaderClick);
    this.headEl.addEventListener("mousedown", this.handleResizeStart);
    this.bodyEl.addEventListener("click", this.handleCellClick);
  }

  private handleScroll = (): void => {
    if (!this.isScrollPending) {
      this.isScrollPending = true;
      requestAnimationFrame(() => {
        this.renderBody(false);
        this.isScrollPending = false;
      });
    }
  };

  private handleHeaderClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const sortButton = target.closest<HTMLButtonElement>("[data-sort-col]");

    if (!sortButton) {
      return;
    }

    const columnIndex = Number(sortButton.dataset.sortCol);
    if (Number.isNaN(columnIndex)) {
      return;
    }

    this.callbacks.onSortRequest(columnIndex);
  };

  private handleResizeStart = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const resizeHandle = target.closest<HTMLElement>("[data-resize-col]");

    if (!resizeHandle) {
      return;
    }

    event.preventDefault();

    const columnIndex = Number(resizeHandle.dataset.resizeCol);
    if (Number.isNaN(columnIndex)) {
      return;
    }

    const initialX = event.clientX;
    const initialWidth = this.columnWidths[columnIndex] ?? 180;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - initialX;
      this.columnWidths[columnIndex] = Math.max(110, initialWidth + deltaX);
      this.renderColGroup();
      this.renderBody(true);
    };

    const onMouseUp = () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  private handleCellClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLTableCellElement>("td[data-row-index]");

    if (!cell) {
      return;
    }

    const rowIndex = Number(cell.dataset.rowIndex);
    if (Number.isNaN(rowIndex)) {
      return;
    }

    if (cell.classList.contains("row-index-cell")) {
      this.callbacks.onSelectRow(rowIndex);
      return;
    }

    const colIndex = Number(cell.dataset.colIndex);
    if (Number.isNaN(colIndex)) {
      return;
    }

    this.callbacks.onSelectCell(rowIndex, colIndex);
  };

  private initializeColumnWidths(): void {
    this.columnWidths = this.model.headers.map((header) => {
      const base = Math.max(130, header.length * 11);
      return Math.min(340, base);
    });
  }

  private renderColGroup(): void {
    const dataColumns = this.columnWidths
      .map((width) => `<col style="width:${width}px" />`)
      .join("");

    this.colGroupEl.innerHTML = `<col style="width:${ROW_INDEX_COLUMN_WIDTH}px" />${dataColumns}`;
  }

  private renderHeader(): void {
    if (this.model.headers.length === 0) {
      this.headEl.innerHTML = "";
      return;
    }

    const headerCells = this.model.headers
      .map((header, columnIndex) => {
        const isSorted = this.model.sortState.columnIndex === columnIndex;
        const direction = isSorted ? this.model.sortState.direction : null;
        const indicator =
          direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";

        return `
          <th scope="col" data-header-index="${columnIndex}">
            <button class="header-sort-btn" data-sort-col="${columnIndex}" title="Sort column">
              <span class="header-label">${escapeHtml(header)}</span>
              <span class="sort-indicator" aria-hidden="true">${indicator}</span>
            </button>
            <span class="col-resizer" data-resize-col="${columnIndex}" role="separator" aria-label="Resize column"></span>
          </th>
        `;
      })
      .join("");

    this.headEl.innerHTML = `
      <tr>
        <th scope="col" class="row-number-header">#</th>
        ${headerCells}
      </tr>
    `;
  }

  private renderEmptyState(): void {
    const hasTableRows =
      this.model.headers.length > 0 && this.model.displayRowIndices.length > 0;

    if (hasTableRows) {
      this.emptyStateEl.classList.remove("visible");
      this.scrollEl.classList.remove("hidden");
      return;
    }

    this.emptyStateEl.classList.add("visible");
    this.emptyStateEl.textContent = this.model.emptyMessage;

    if (this.model.headers.length === 0) {
      this.scrollEl.classList.add("hidden");
    } else {
      this.scrollEl.classList.remove("hidden");
    }
  }

  private renderBody(forceRender: boolean): void {
    const totalRows = this.model.displayRowIndices.length;

    if (totalRows === 0 || this.model.headers.length === 0) {
      this.bodyEl.innerHTML = "";
      return;
    }

    const viewportHeight = this.scrollEl.clientHeight;
    const rowsInViewport =
      Math.ceil(viewportHeight / this.rowHeight) + this.overscan * 2;
    const startIndex = Math.max(
      0,
      Math.floor(this.scrollEl.scrollTop / this.rowHeight) - this.overscan,
    );
    const endIndex = Math.min(totalRows, startIndex + rowsInViewport);

    const rangeKey = `${startIndex}:${endIndex}:${totalRows}`;
    if (!forceRender && this.lastRangeKey === rangeKey) {
      return;
    }

    this.lastRangeKey = rangeKey;

    const topSpacerHeight = startIndex * this.rowHeight;
    const bottomSpacerHeight = (totalRows - endIndex) * this.rowHeight;
    const colSpan = this.model.headers.length + 1;

    const htmlRows: string[] = [];

    if (topSpacerHeight > 0) {
      htmlRows.push(`
        <tr class="spacer-row" aria-hidden="true">
          <td colspan="${colSpan}" style="height:${topSpacerHeight}px"></td>
        </tr>
      `);
    }

    for (
      let visualRowIndex = startIndex;
      visualRowIndex < endIndex;
      visualRowIndex += 1
    ) {
      const sourceRowIndex = this.model.displayRowIndices[visualRowIndex];
      const row = this.model.rows[sourceRowIndex] ?? [];
      htmlRows.push(this.renderDataRow(visualRowIndex, sourceRowIndex, row));
    }

    if (bottomSpacerHeight > 0) {
      htmlRows.push(`
        <tr class="spacer-row" aria-hidden="true">
          <td colspan="${colSpan}" style="height:${bottomSpacerHeight}px"></td>
        </tr>
      `);
    }

    this.bodyEl.innerHTML = htmlRows.join("");
  }

  private renderDataRow(
    visualRowIndex: number,
    sourceRowIndex: number,
    row: string[],
  ): string {
    const rowClasses: string[] = ["data-row"];

    if (this.model.selection.rowIndex === sourceRowIndex) {
      rowClasses.push("is-selected-row");
    }

    if (this.model.duplicateRows.has(sourceRowIndex)) {
      rowClasses.push("is-duplicate-row");
    }

    const rowNoteKey = buildRowNoteKey(sourceRowIndex);
    const hasRowNote = Boolean(this.model.notes[rowNoteKey]);

    const rowNumberCell = `
      <td
        class="row-index-cell ${hasRowNote ? "has-note" : ""}"
        data-row-index="${sourceRowIndex}"
        data-col-index="-1"
        title="Row ${sourceRowIndex + 1}"
      >
        <div class="cell-inner">
          <span>${visualRowIndex + 1}</span>
          ${hasRowNote ? '<span class="note-dot" aria-hidden="true"></span>' : ""}
        </div>
      </td>
    `;

    const dataCells = this.model.headers
      .map((_, colIndex) => {
        const cellValue = row[colIndex] ?? "";
        const cellKey = `${sourceRowIndex}:${colIndex}`;
        const noteKey = buildCellNoteKey(sourceRowIndex, colIndex);

        const classes: string[] = ["data-cell"];

        if (
          this.model.selection.rowIndex === sourceRowIndex &&
          this.model.selection.colIndex === colIndex
        ) {
          classes.push("is-selected-cell");
        }

        if (this.model.duplicateCellKeys.has(cellKey)) {
          classes.push("is-duplicate-cell");
        }

        if (this.model.notes[noteKey]) {
          classes.push("has-note");
        }

        const displayValue =
          cellValue.length === 0
            ? '<span class="empty-value">""</span>'
            : `<span>${escapeHtml(cellValue)}</span>`;

        return `
          <td
            class="${classes.join(" ")}"
            data-row-index="${sourceRowIndex}"
            data-col-index="${colIndex}"
            title="${escapeHtml(cellValue)}"
          >
            <div class="cell-inner">
              ${displayValue}
              ${this.model.notes[noteKey] ? '<span class="note-dot" aria-hidden="true"></span>' : ""}
            </div>
          </td>
        `;
      })
      .join("");

    return `<tr class="${rowClasses.join(" ")}">${rowNumberCell}${dataCells}</tr>`;
  }
}
