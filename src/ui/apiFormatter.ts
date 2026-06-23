export class ApiFormatter {
  private readonly root: HTMLElement;
  
  // Element references
  private endpointInput!: HTMLInputElement;
  private methodSelect!: HTMLSelectElement;
  private reqBodyInput!: HTMLTextAreaElement;
  private apiParamsInput!: HTMLTextAreaElement;
  private notesInput!: HTMLTextAreaElement;
  private apiResponseInput!: HTMLTextAreaElement;
  
  private formatBodyBtn!: HTMLButtonElement;
  private formatParamsBtn!: HTMLButtonElement;
  private formatResponseBtn!: HTMLButtonElement;
  private loadMockBtn!: HTMLButtonElement;
  private clearFormBtn!: HTMLButtonElement;
  
  private copyTextBtn!: HTMLButtonElement;
  private copyMarkdownBtn!: HTMLButtonElement;
  private copyRichBtn!: HTMLButtonElement;
  
  private livePreviewEl!: HTMLPreElement;
  private statusMessageEl!: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    this.cacheElements();
    this.attachListeners();
    this.updatePreview();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="api-formatter-container">
        <!-- Input Form Section -->
        <div class="card api-form-card">
          <div class="api-form-header">
            <h2>API Details</h2>
            <div class="form-actions-top">
              <button id="loadMockBtn" class="btn subtle btn-sm" type="button">Mock Data</button>
              <button id="clearFormBtn" class="btn subtle btn-sm" type="button">Reset</button>
            </div>
          </div>

          <div class="form-group row-inline">
            <div class="field-col flex-3">
              <label for="apiEndpoint" class="form-label">Api Endpoint</label>
              <input id="apiEndpoint" type="text" placeholder="e.g., shopTaxes/list" class="form-input-field" />
            </div>
            
            <div class="field-col flex-1">
              <label for="apiMethod" class="form-label">Api Method</label>
              <select id="apiMethod" class="form-select-field">
                <option value="GET" selected>GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <div class="textarea-header">
              <label for="apiParams" class="form-label">Api params</label>
              <button id="formatParamsBtn" class="btn text-btn" type="button">Format JSON</button>
            </div>
            <textarea id="apiParams" placeholder="Query params or URL parameters (JSON or text)..." class="form-textarea-field"></textarea>
          </div>

          <div class="form-group">
            <div class="textarea-header">
              <label for="reqBody" class="form-label">req.body</label>
              <button id="formatBodyBtn" class="btn text-btn" type="button">Format JSON</button>
            </div>
            <textarea id="reqBody" placeholder="Request body payload (JSON)..." class="form-textarea-field"></textarea>
          </div>

          <div class="form-group">
            <label for="apiNotes" class="form-label">Notes</label>
            <textarea id="apiNotes" placeholder="Any notes regarding headers, authorization, or usage..." class="form-textarea-field" style="min-height: 80px;"></textarea>
          </div>

          <div class="form-group">
            <div class="textarea-header">
              <label for="apiResponse" class="form-label">Api Response</label>
              <button id="formatResponseBtn" class="btn text-btn" type="button">Format JSON</button>
            </div>
            <textarea id="apiResponse" placeholder="Response data payload (JSON)..." class="form-textarea-field"></textarea>
          </div>
        </div>

        <!-- Output Live Preview Section -->
        <div class="card api-preview-card">
          <div class="preview-header">
            <h2>MS Teams Copy-Ready Preview</h2>
            <div id="formatterStatus" class="formatter-status" aria-live="polite"></div>
          </div>

          <div class="preview-scroll">
            <pre id="livePreview" class="preview-content"></pre>
          </div>

          <div class="copy-actions">
            <button id="copyTextBtn" class="btn primary" type="button">Copy Plain Text</button>
            <button id="copyMarkdownBtn" class="btn subtle" type="button">Copy Markdown</button>
            <button id="copyRichBtn" class="btn subtle" type="button" title="Pasts with nice styles in Teams">Copy Rich Text</button>
          </div>
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    this.endpointInput = this.root.querySelector<HTMLInputElement>("#apiEndpoint")!;
    this.methodSelect = this.root.querySelector<HTMLSelectElement>("#apiMethod")!;
    this.reqBodyInput = this.root.querySelector<HTMLTextAreaElement>("#reqBody")!;
    this.apiParamsInput = this.root.querySelector<HTMLTextAreaElement>("#apiParams")!;
    this.notesInput = this.root.querySelector<HTMLTextAreaElement>("#apiNotes")!;
    this.apiResponseInput = this.root.querySelector<HTMLTextAreaElement>("#apiResponse")!;

    this.formatBodyBtn = this.root.querySelector<HTMLButtonElement>("#formatBodyBtn")!;
    this.formatParamsBtn = this.root.querySelector<HTMLButtonElement>("#formatParamsBtn")!;
    this.formatResponseBtn = this.root.querySelector<HTMLButtonElement>("#formatResponseBtn")!;
    
    this.loadMockBtn = this.root.querySelector<HTMLButtonElement>("#loadMockBtn")!;
    this.clearFormBtn = this.root.querySelector<HTMLButtonElement>("#clearFormBtn")!;

    this.copyTextBtn = this.root.querySelector<HTMLButtonElement>("#copyTextBtn")!;
    this.copyMarkdownBtn = this.root.querySelector<HTMLButtonElement>("#copyMarkdownBtn")!;
    this.copyRichBtn = this.root.querySelector<HTMLButtonElement>("#copyRichBtn")!;

    this.livePreviewEl = this.root.querySelector<HTMLPreElement>("#livePreview")!;
    this.statusMessageEl = this.root.querySelector<HTMLDivElement>("#formatterStatus")!;
  }

  private attachListeners(): void {
    const inputs = [
      this.endpointInput,
      this.methodSelect,
      this.reqBodyInput,
      this.apiParamsInput,
      this.notesInput,
      this.apiResponseInput
    ];

    inputs.forEach(input => {
      input.addEventListener("input", () => this.updatePreview());
    });

    this.methodSelect.addEventListener("change", () => this.updatePreview());

    // Format buttons
    this.formatBodyBtn.addEventListener("click", () => this.formatFieldJson(this.reqBodyInput, "req.body"));
    this.formatParamsBtn.addEventListener("click", () => this.formatFieldJson(this.apiParamsInput, "Api params"));
    this.formatResponseBtn.addEventListener("click", () => this.formatFieldJson(this.apiResponseInput, "Api Response"));

    // Form actions
    this.loadMockBtn.addEventListener("click", () => this.loadMockData());
    this.clearFormBtn.addEventListener("click", () => this.clearForm());

    // Copy buttons
    this.copyTextBtn.addEventListener("click", () => this.copyToClipboard("text"));
    this.copyMarkdownBtn.addEventListener("click", () => this.copyToClipboard("markdown"));
    this.copyRichBtn.addEventListener("click", () => this.copyToClipboard("rich"));
  }

  private formatFieldJson(textarea: HTMLTextAreaElement, fieldName: string): void {
    const rawVal = textarea.value.trim();
    if (!rawVal) {
      this.showStatus(`[${fieldName}] is empty. Nothing to format.`, true);
      return;
    }

    try {
      const parsed = JSON.parse(rawVal);
      textarea.value = JSON.stringify(parsed, null, 4);
      this.showStatus(`Formatted [${fieldName}] JSON successfully.`);
      this.updatePreview();
    } catch (err) {
      this.showStatus(`Failed to format [${fieldName}]: Invalid JSON syntax`, true);
    }
  }

  private showStatus(msg: string, isError = false): void {
    this.statusMessageEl.textContent = msg;
    this.statusMessageEl.className = `formatter-status ${isError ? "error" : "success"}`;
    
    // Clear status after 3.5 seconds
    window.setTimeout(() => {
      if (this.statusMessageEl.textContent === msg) {
        this.statusMessageEl.textContent = "";
        this.statusMessageEl.className = "formatter-status";
      }
    }, 3500);
  }

  private loadMockData(): void {
    this.endpointInput.value = "shopTaxes/list";
    this.methodSelect.value = "GET";
    this.apiParamsInput.value = JSON.stringify({ shopId: "66b45b7bf54f1e0c6440d35a", province: "Ontario" }, null, 4);
    this.reqBodyInput.value = "";
    this.notesInput.value = "Required headers:\n- Authorization: Bearer <token>\n- Content-Type: application/json";
    this.apiResponseInput.value = JSON.stringify({
      status: true,
      message: "Shop tax list fetched successfully.",
      data: {
        _id: "6a217bd8ab908b48fa23cd89",
        shop: "66b45b7bf54f1e0c6440d35a",
        country: "64e738882fec8f2c9b79c139",
        province: "64e738882fec8f2c9b79c13c",
        taxId: "6a1ff1a4b8fc5d2720d891ca",
        taxRules: [
          {
            taxName: "HST",
            invoiceRate: 13,
            includeInvoiceTax: true,
            estimateRate: 13
          }
        ]
      }
    }, null, 4);

    this.showStatus("Mock data loaded.");
    this.updatePreview();
  }

  private clearForm(): void {
    this.endpointInput.value = "";
    this.methodSelect.value = "GET";
    this.apiParamsInput.value = "";
    this.reqBodyInput.value = "";
    this.notesInput.value = "";
    this.apiResponseInput.value = "";
    
    this.showStatus("Form cleared.");
    this.updatePreview();
  }

  private formatMultiLineField(val: string, format: "text" | "markdown" | "html"): string {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-") {
      return "-";
    }

    const lines = trimmed.split("\n");
    // Check if the lines contain bullet point indicators
    const isList = lines.some(line => {
      const t = line.trim();
      return t.startsWith("-") || t.startsWith("*") || t.startsWith("•");
    });

    if (isList) {
      if (format === "html") {
        const listItems = lines.map(line => {
          const t = line.trim();
          const cleaned = t.replace(/^[-*•]\s*/, "");
          return `<li style="font-family: sans-serif; font-size: 14px; margin-bottom: 4px;">${this.escapeHtml(cleaned)}</li>`;
        }).join("");
        return `<ul style="margin: 4px 0 12px; padding-left: 20px; list-style-type: disc;">${listItems}</ul>`;
      }
      // markdown & plain text
      return lines.map(line => {
        const t = line.trim();
        const cleaned = t.replace(/^[-*•]\s*/, "");
        return `- ${cleaned}`;
      }).join("\n");
    }

    // Non-list multiline block
    if (format === "html") {
      return `<div style="font-family: sans-serif; font-size: 14px; white-space: pre-wrap; margin-bottom: 12px;">${this.escapeHtml(trimmed)}</div>`;
    }
    return trimmed;
  }

  private generateOutput(format: "text" | "markdown" | "html"): string {
    const endpoint = this.endpointInput.value.trim() || "N/A";
    const method = this.methodSelect.value;
    
    const params = this.apiParamsInput.value.trim() || "-";
    const body = this.reqBodyInput.value.trim() || "-";
    const notes = this.notesInput.value.trim() || "-";
    const response = this.apiResponseInput.value.trim() || "-";

    const paramsFormatted = this.formatMultiLineField(params, format);
    const bodyFormatted = this.formatMultiLineField(body, format);
    const notesFormatted = this.formatMultiLineField(notes, format);
    const responseFormatted = this.formatMultiLineField(response, format);

    if (format === "markdown") {
      const getVal = (val: string, formatted: string) => {
        if (this.isJsonString(val)) {
          return `\n  \`\`\`json\n${this.indentLines(val, "  ")}\n  \`\`\``;
        }
        return formatted === "-" ? " -" : `\n${this.indentLines(formatted, "  ")}`;
      };

      return [
        `- **Api Endpoint:** \`${endpoint}\``,
        `- **Api Method:** \`${method}\``,
        `- **Api params:**${getVal(params, paramsFormatted)}`,
        `- **req.body:**${getVal(body, bodyFormatted)}`,
        `- **Notes:**${notesFormatted === "-" ? " -" : `\n${this.indentLines(notesFormatted, "  ")}`}`,
        `- **Api Response:**${getVal(response, responseFormatted)}`
      ].join("\n");
    }

    if (format === "html") {
      const codeStyle = "font-family: 'IBM Plex Mono', monospace; font-size: 13px; background-color: rgba(0,0,0,0.04); border-radius: 4px; padding: 2px 4px;";
      const blockStyle = "font-family: 'IBM Plex Mono', monospace; font-size: 13px; background-color: #f7f9fa; border: 1px solid #e1e4e6; border-radius: 6px; padding: 10px; display: block; margin: 4px 0 12px; overflow-x: auto; white-space: pre; line-height: 1.4;";
      
      const renderHtmlBlock = (val: string, formatted: string) => {
        if (this.isJsonString(val)) {
          return `<pre style="${blockStyle}">${this.escapeHtml(val)}</pre>`;
        }
        return formatted === "-" ? " -" : `<div style="margin-top: 4px; margin-left: 12px;">${formatted}</div>`;
      };

      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #24292e; line-height: 1.5; max-width: 800px;">
          <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">Api Endpoint:</strong> <code style="${codeStyle}">${this.escapeHtml(endpoint)}</code></li>
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">Api Method:</strong> <span style="font-weight: 600; padding: 2px 6px; border-radius: 4px; color: #fff; background-color: ${this.getMethodColor(method)}; font-size: 12px; font-family: monospace;">${method}</span></li>
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">Api params:</strong>${renderHtmlBlock(params, paramsFormatted)}</li>
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">req.body:</strong>${renderHtmlBlock(body, bodyFormatted)}</li>
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">Notes:</strong>${notesFormatted === "-" ? " -" : `<div style="margin-top: 4px; margin-left: 12px;">${notesFormatted}</div>`}</li>
            <li style="margin-bottom: 8px;"><strong style="color: #1f2326;">Api Response:</strong>${renderHtmlBlock(response, responseFormatted)}</li>
          </ul>
        </div>
      `;
    }

    // Default plain text (User's direct requested style)
    const renderPlainBlock = (val: string, formatted: string) => {
      if (val === "-" || formatted === "-") {
        return " -";
      }
      if (this.isJsonString(val)) {
        return `\n${this.indentLines(val, "  ")}`;
      }
      return `\n${this.indentLines(formatted, "  ")}`;
    };

    return [
      `- Api Endpoint: ${endpoint}`,
      `- Api Method: ${method}`,
      `- Api params:${renderPlainBlock(params, paramsFormatted)}`,
      `- req.body:${renderPlainBlock(body, bodyFormatted)}`,
      `- Notes:${notesFormatted === "-" ? " -" : `\n${this.indentLines(notesFormatted, "  ")}`}`,
      `- Api Response:${renderPlainBlock(response, responseFormatted)}`
    ].join("\n");
  }

  private indentLines(text: string, indent = "  "): string {
    return text.split("\n").map(line => indent + line).join("\n");
  }

  private isJsonString(str: string): boolean {
    const trimmed = str.trim();
    if (!trimmed || trimmed === "-") return false;
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private getMethodColor(method: string): string {
    switch (method) {
      case "GET": return "#23b287"; // green
      case "POST": return "#336dff"; // blue
      case "PUT": return "#fe9a35"; // orange
      case "DELETE": return "#ff4d4d"; // red
      case "PATCH": return "#7246ff"; // purple
      default: return "#4d5b78"; // gray
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private updatePreview(): void {
    const textOutput = this.generateOutput("text");
    this.livePreviewEl.textContent = textOutput;
  }

  private async copyToClipboard(format: "text" | "markdown" | "rich"): Promise<void> {
    const textVal = this.generateOutput("text");
    const markdownVal = this.generateOutput("markdown");
    const htmlVal = this.generateOutput("html");

    try {
      if (format === "text") {
        await this.copyText(textVal);
        this.showStatus("Copied plain text to clipboard!");
      } else if (format === "markdown") {
        await this.copyText(markdownVal);
        this.showStatus("Copied markdown to clipboard!");
      } else if (format === "rich") {
        if (navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
          const blobHtml = new Blob([htmlVal], { type: "text/html" });
          const blobText = new Blob([textVal], { type: "text/plain" });
          const data = new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText
          });
          await navigator.clipboard.write([data]);
          this.showStatus("Copied Rich HTML to clipboard! (Ready for Teams)");
        } else {
          // Fallback to copying HTML source text
          await this.copyText(htmlVal);
          this.showStatus("Rich text fallback: copied HTML source to clipboard.");
        }
      }
    } catch (err) {
      this.showStatus("Failed to copy to clipboard.", true);
    }
  }

  private copyText(text: string): Promise<void> {
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
}
