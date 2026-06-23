import {
  parseCurl,
  generateCurl,
  generatePostmanCollection,
  generateFetchCode,
} from "../utils/curlParser";

export class CurlCreator {
  private readonly root: HTMLElement;

  // Input elements
  private rawCurlInput!: HTMLTextAreaElement;
  private parseCurlBtn!: HTMLButtonElement;
  private loadMockCurlBtn!: HTMLButtonElement;
  private clearCurlFormBtn!: HTMLButtonElement;
  private curlUrlInput!: HTMLInputElement;
  private curlMethodSelect!: HTMLSelectElement;
  private headersContainer!: HTMLDivElement;
  private addHeaderBtn!: HTMLButtonElement;
  private curlBodyInput!: HTMLTextAreaElement;
  private formatCurlBodyBtn!: HTMLButtonElement;

  // Output elements
  private curlCreatorStatusEl!: HTMLDivElement;
  private outTabCurlBtn!: HTMLButtonElement;
  private outTabPostmanBtn!: HTMLButtonElement;
  private outTabFetchBtn!: HTMLButtonElement;
  private curlLivePreviewEl!: HTMLPreElement;
  private lineContinuationSelect!: HTMLSelectElement;
  private curlOptionsPanel!: HTMLDivElement;
  private curlCopyBtn!: HTMLButtonElement;
  private curlDownloadBtn!: HTMLButtonElement;

  // State
  private method = "GET";
  private url = "";
  private headers: Array<{ key: string; value: string }> = [];
  private body = "";
  private activeOutputTab: "curl" | "postman" | "fetch" = "curl";
  private continuationChar: "\\" | "`" = "\\";

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    this.cacheElements();
    this.attachListeners();
    this.renderHeadersList();
    this.updateOutputs();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="curl-creator-container">
        <!-- Input Form Section -->
        <div class="card api-form-card">
          <div class="api-form-header">
            <h2>cURL Input & Customization</h2>
            <div class="form-actions-top">
              <button id="loadMockCurlBtn" class="btn subtle btn-sm" type="button">Mock cURL</button>
              <button id="clearCurlFormBtn" class="btn subtle btn-sm" type="button">Reset</button>
            </div>
          </div>

          <!-- Raw cURL Input box -->
          <div class="form-group">
            <label for="rawCurlInput" class="form-label">Paste Raw cURL Command</label>
            <textarea id="rawCurlInput" placeholder="Paste curl --location --request PUT 'localhost:4504/...' here..." class="form-textarea-field" style="min-height: 100px; font-family: var(--font-mono); font-size: 0.8rem;"></textarea>
            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
              <button id="parseCurlBtn" class="btn primary btn-sm" type="button">Parse cURL</button>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid var(--table-border); margin: 1.5rem 0;" />

          <!-- Method and Url -->
          <div class="form-group row-inline">
            <div class="field-col flex-3">
              <label for="curlUrl" class="form-label">Request URL</label>
              <input id="curlUrl" type="text" placeholder="https://api.example.com/v1/resource" class="form-input-field" />
            </div>
            
            <div class="field-col flex-1">
              <label for="curlMethod" class="form-label">Method</label>
              <select id="curlMethod" class="form-select-field">
                <option value="GET" selected>GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
          </div>

          <!-- Headers List Section -->
          <div class="form-group">
            <div class="textarea-header">
              <label class="form-label">Headers</label>
              <button id="addHeaderBtn" class="btn text-btn" type="button">+ Add Header</button>
            </div>
            <div id="headersContainer" class="headers-editor-container">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- Request Body Section -->
          <div class="form-group">
            <div class="textarea-header">
              <label for="curlBody" class="form-label">Request Body (raw)</label>
              <button id="formatCurlBodyBtn" class="btn text-btn" type="button">Format JSON</button>
            </div>
            <textarea id="curlBody" placeholder="Request body payload (JSON or raw text)..." class="form-textarea-field"></textarea>
          </div>
        </div>

        <!-- Output Previews and Actions -->
        <div class="card api-preview-card">
          <div class="preview-header">
            <h2>Generated Output</h2>
            <div id="curlCreatorStatus" class="formatter-status" aria-live="polite"></div>
          </div>

          <div class="output-tab-nav">
            <button id="outTabCurlBtn" class="out-tab-btn active" type="button">cURL Command</button>
            <button id="outTabPostmanBtn" class="out-tab-btn" type="button">Postman Collection</button>
            <button id="outTabFetchBtn" class="out-tab-btn" type="button">JS Fetch</button>
          </div>

          <div class="preview-scroll">
            <pre id="curlLivePreview" class="preview-content"></pre>
          </div>

          <div id="curlOptionsPanel" class="output-options-panel">
            <label class="form-label" style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.78rem;">
              Line Continuation:
              <select id="lineContinuationSelect" class="form-select-field btn-sm" style="width: auto; padding-right: 1.8rem; margin: 0; padding-top: 0.2rem; padding-bottom: 0.2rem;">
                <option value="\\\\">Unix / Bash (\\)</option>
                <option value="\`">PowerShell (\`)</option>
              </select>
            </label>
          </div>

          <div class="copy-actions">
            <button id="curlCopyBtn" class="btn primary" type="button">Copy to Clipboard</button>
            <button id="curlDownloadBtn" class="btn subtle" type="button">Download File</button>
          </div>
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    // Inputs
    this.rawCurlInput = this.root.querySelector<HTMLTextAreaElement>("#rawCurlInput")!;
    this.parseCurlBtn = this.root.querySelector<HTMLButtonElement>("#parseCurlBtn")!;
    this.loadMockCurlBtn = this.root.querySelector<HTMLButtonElement>("#loadMockCurlBtn")!;
    this.clearCurlFormBtn = this.root.querySelector<HTMLButtonElement>("#clearCurlFormBtn")!;
    this.curlUrlInput = this.root.querySelector<HTMLInputElement>("#curlUrl")!;
    this.curlMethodSelect = this.root.querySelector<HTMLSelectElement>("#curlMethod")!;
    this.headersContainer = this.root.querySelector<HTMLDivElement>("#headersContainer")!;
    this.addHeaderBtn = this.root.querySelector<HTMLButtonElement>("#addHeaderBtn")!;
    this.curlBodyInput = this.root.querySelector<HTMLTextAreaElement>("#curlBody")!;
    this.formatCurlBodyBtn = this.root.querySelector<HTMLButtonElement>("#formatCurlBodyBtn")!;

    // Outputs
    this.curlCreatorStatusEl = this.root.querySelector<HTMLDivElement>("#curlCreatorStatus")!;
    this.outTabCurlBtn = this.root.querySelector<HTMLButtonElement>("#outTabCurlBtn")!;
    this.outTabPostmanBtn = this.root.querySelector<HTMLButtonElement>("#outTabPostmanBtn")!;
    this.outTabFetchBtn = this.root.querySelector<HTMLButtonElement>("#outTabFetchBtn")!;
    this.curlLivePreviewEl = this.root.querySelector<HTMLPreElement>("#curlLivePreview")!;
    this.lineContinuationSelect = this.root.querySelector<HTMLSelectElement>("#lineContinuationSelect")!;
    this.curlOptionsPanel = this.root.querySelector<HTMLDivElement>("#curlOptionsPanel")!;
    this.curlCopyBtn = this.root.querySelector<HTMLButtonElement>("#curlCopyBtn")!;
    this.curlDownloadBtn = this.root.querySelector<HTMLButtonElement>("#curlDownloadBtn")!;
  }

  private attachListeners(): void {
    // Parser triggers
    this.parseCurlBtn.addEventListener("click", () => this.handleParseRawCurl());
    this.loadMockCurlBtn.addEventListener("click", () => this.loadMockCurl());
    this.clearCurlFormBtn.addEventListener("click", () => this.clearForm());

    // Live form updates
    this.curlUrlInput.addEventListener("input", () => {
      this.url = this.curlUrlInput.value.trim();
      this.updateOutputs();
    });

    this.curlMethodSelect.addEventListener("change", () => {
      this.method = this.curlMethodSelect.value;
      this.updateOutputs();
    });

    this.curlBodyInput.addEventListener("input", () => {
      this.body = this.curlBodyInput.value;
      this.updateOutputs();
    });

    // Formatting & header list
    this.formatCurlBodyBtn.addEventListener("click", () => this.formatJsonBody());
    this.addHeaderBtn.addEventListener("click", () => this.handleAddHeader());

    // Navigation Tabs
    this.outTabCurlBtn.addEventListener("click", () => this.setTab("curl"));
    this.outTabPostmanBtn.addEventListener("click", () => this.setTab("postman"));
    this.outTabFetchBtn.addEventListener("click", () => this.setTab("fetch"));

    // Options
    this.lineContinuationSelect.addEventListener("change", () => {
      this.continuationChar = this.lineContinuationSelect.value as "\\" | "`";
      this.updateOutputs();
    });

    // Output Actions
    this.curlCopyBtn.addEventListener("click", () => this.handleCopy());
    this.curlDownloadBtn.addEventListener("click", () => this.handleDownload());
  }

  private handleParseRawCurl(): void {
    const rawVal = this.rawCurlInput.value.trim();
    if (!rawVal) {
      this.showStatus("Please paste a cURL command to parse.", true);
      return;
    }

    try {
      const parsed = parseCurl(rawVal);
      this.method = parsed.method;
      this.url = parsed.url;
      this.headers = parsed.headers;
      this.body = parsed.body;

      // Update UI components
      this.curlUrlInput.value = this.url;
      this.curlMethodSelect.value = this.method;
      
      // Attempt JSON body formatting automatically on paste if it's JSON
      try {
        const parsedBody = JSON.parse(this.body);
        this.curlBodyInput.value = JSON.stringify(parsedBody, null, 4);
      } catch {
        this.curlBodyInput.value = this.body;
      }

      this.renderHeadersList();
      this.updateOutputs();
      this.showStatus("Parsed cURL successfully.");
    } catch (err) {
      this.showStatus("Failed to parse cURL command.", true);
    }
  }

  private loadMockCurl(): void {
    this.rawCurlInput.value = `curl --location --request PUT 'localhost:4504/web/v4/api/estimate/update-estimate/6a337c11c562bf41e1ad346c?sendEmail=false' \\
--header 'sec-ch-ua-platform: "Windows"' \\
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2YjQ1YjdlZjU0ZjFlMGM2NDQwZDQyMiIsInJvbGUiOiJzaG9wX293bmVyIiwic2hvcCI6IjY2YjQ1YjdiZjU0ZjFlMGM2NDQwZDM1YSIsImVtYWlsIjoiYnVyaGFudWRkaW4ucitjYXJAZGV2c3RyZWUuaW4iLCJpYXQiOjE3ODE2NzkxMDUsImV4cCI6MTc5NzIzMTEwNX0.UV-_dtU5OqNMfxWvLZCaI6LN4Q0xrRn6r6LoF4KnM74' \\
--header 'Content-Type: application/json' \\
--data '{
    "serviceAdvisor": "69722539f5b186bf8d2a06a2",
    "customerId": "69f1a4a175ab4e57efdfc502",
    "odo": "123",
    "discount": 52
}'`;
    this.handleParseRawCurl();
  }

  private clearForm(): void {
    this.rawCurlInput.value = "";
    this.curlUrlInput.value = "";
    this.curlMethodSelect.value = "GET";
    this.curlBodyInput.value = "";

    this.method = "GET";
    this.url = "";
    this.headers = [];
    this.body = "";

    this.renderHeadersList();
    this.updateOutputs();
    this.showStatus("Workspace cleared.");
  }

  private handleAddHeader(): void {
    this.headers.push({ key: "", value: "" });
    this.renderHeadersList();

    // Focus key input of newly added header
    const rows = this.headersContainer.querySelectorAll(".header-row-item");
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const keyInput = lastRow.querySelector<HTMLInputElement>(".header-key-input");
      keyInput?.focus();
    }
  }

  private renderHeadersList(): void {
    this.headersContainer.innerHTML = "";

    if (this.headers.length === 0) {
      this.headersContainer.innerHTML = `
        <div class="headers-empty-state">
          No headers defined. Click "+ Add Header" to define headers.
        </div>
      `;
      return;
    }

    this.headers.forEach((header, index) => {
      const row = document.createElement("div");
      row.className = "header-row-item";
      row.innerHTML = `
        <input type="text" class="form-input-field header-key-input" placeholder="Header Key (e.g., Content-Type)" value="${this.escapeHtml(header.key)}" />
        <input type="text" class="form-input-field header-val-input" placeholder="Header Value" value="${this.escapeHtml(header.value)}" />
        <button class="btn subtle remove-header-btn" type="button" title="Remove Header">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      const keyInput = row.querySelector<HTMLInputElement>(".header-key-input")!;
      const valInput = row.querySelector<HTMLInputElement>(".header-val-input")!;
      const removeBtn = row.querySelector<HTMLButtonElement>(".remove-header-btn")!;

      keyInput.addEventListener("input", () => {
        this.headers[index].key = keyInput.value;
        this.updateOutputs();
      });

      valInput.addEventListener("input", () => {
        this.headers[index].value = valInput.value;
        this.updateOutputs();
      });

      removeBtn.addEventListener("click", () => {
        this.headers.splice(index, 1);
        this.renderHeadersList();
        this.updateOutputs();
      });

      this.headersContainer.appendChild(row);
    });
  }

  private formatJsonBody(): void {
    const rawBody = this.curlBodyInput.value.trim();
    if (!rawBody) {
      this.showStatus("Body is empty. Nothing to format.", true);
      return;
    }

    try {
      const parsed = JSON.parse(rawBody);
      this.curlBodyInput.value = JSON.stringify(parsed, null, 4);
      this.body = this.curlBodyInput.value;
      this.updateOutputs();
      this.showStatus("Formatted body JSON successfully.");
    } catch {
      this.showStatus("Invalid JSON syntax in request body.", true);
    }
  }

  private setTab(tab: "curl" | "postman" | "fetch"): void {
    this.activeOutputTab = tab;
    this.outTabCurlBtn.classList.toggle("active", tab === "curl");
    this.outTabPostmanBtn.classList.toggle("active", tab === "postman");
    this.outTabFetchBtn.classList.toggle("active", tab === "fetch");

    // Hide or show options panel depending on tab
    this.curlOptionsPanel.style.display = tab === "curl" ? "block" : "none";

    this.updateOutputs();
  }

  private generateOutputContent(): string {
    const cleanUrl = this.url || "http://localhost:8080/api";
    switch (this.activeOutputTab) {
      case "curl":
        return generateCurl(
          this.method,
          cleanUrl,
          this.headers,
          this.body,
          this.continuationChar
        );
      case "postman":
        return generatePostmanCollection(
          this.method,
          cleanUrl,
          this.headers,
          this.body
        );
      case "fetch":
        return generateFetchCode(
          this.method,
          cleanUrl,
          this.headers,
          this.body
        );
    }
  }

  private updateOutputs(): void {
    const content = this.generateOutputContent();
    this.curlLivePreviewEl.textContent = content;
  }

  private showStatus(msg: string, isError = false): void {
    this.curlCreatorStatusEl.textContent = msg;
    this.curlCreatorStatusEl.className = `formatter-status ${isError ? "error" : "success"}`;

    window.setTimeout(() => {
      if (this.curlCreatorStatusEl.textContent === msg) {
        this.curlCreatorStatusEl.textContent = "";
        this.curlCreatorStatusEl.className = "formatter-status";
      }
    }, 3500);
  }

  private async handleCopy(): Promise<void> {
    const content = this.generateOutputContent();
    if (!content) {
      this.showStatus("No output to copy.", true);
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const text = document.createElement("textarea");
        text.value = content;
        text.style.position = "fixed";
        text.style.opacity = "0";
        document.body.appendChild(text);
        text.focus();
        text.select();
        document.execCommand("copy");
        text.remove();
      }
      this.showStatus("Copied to clipboard!");
    } catch {
      this.showStatus("Failed to copy to clipboard.", true);
    }
  }

  private handleDownload(): void {
    const content = this.generateOutputContent();
    if (!content) {
      this.showStatus("No output to download.", true);
      return;
    }

    let filename = "request.sh";
    let mimeType = "text/plain";

    if (this.activeOutputTab === "curl") {
      filename = this.continuationChar === "`" ? "request.ps1" : "request.sh";
    } else if (this.activeOutputTab === "postman") {
      filename = "postman_collection.json";
      mimeType = "application/json";
    } else if (this.activeOutputTab === "fetch") {
      filename = "fetch_request.js";
      mimeType = "application/javascript";
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    this.showStatus(`Downloaded ${filename} successfully.`);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}
