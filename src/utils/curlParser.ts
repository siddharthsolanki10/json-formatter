export interface ParsedCurl {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
}

/**
 * Parses a raw cURL command line string into its components: method, url, headers, and body.
 * Handles escaped characters, multi-line continuations, and quotes.
 */
export function parseCurl(curlCommand: string): ParsedCurl {
  // Normalize line continuations (\ or ` followed by optional carriage return and newline)
  const normalized = curlCommand
    .replace(/\\\r?\n/g, " ")
    .replace(/`\r?\n/g, " ");

  const args: string[] = [];
  let current = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escaped = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (/\s/.test(char) && !inDoubleQuote && !inSingleQuote) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) {
    args.push(current);
  }

  let method = "";
  let url = "";
  const headers: Array<{ key: string; value: string }> = [];
  let body = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-X" || arg === "--request") {
      if (i + 1 < args.length) {
        method = args[++i].toUpperCase();
      }
    } else if (arg === "-H" || arg === "--header") {
      if (i + 1 < args.length) {
        const headerStr = args[++i];
        const colonIndex = headerStr.indexOf(":");
        if (colonIndex !== -1) {
          const key = headerStr.slice(0, colonIndex).trim();
          const value = headerStr.slice(colonIndex + 1).trim();
          headers.push({ key, value });
        } else {
          headers.push({ key: headerStr.trim(), value: "" });
        }
      }
    } else if (
      arg === "-d" ||
      arg === "--data" ||
      arg === "--data-raw" ||
      arg === "--data-binary" ||
      arg === "--data-urlencode"
    ) {
      if (i + 1 < args.length) {
        const nextVal = args[++i];
        if (body) {
          body += "&" + nextVal;
        } else {
          body = nextVal;
        }
      }
    } else if (arg === "--url") {
      if (i + 1 < args.length) {
        url = args[++i];
      }
    } else if (arg.startsWith("-")) {
      // Skip common option arguments to prevent parsing them as URLs
      const optsWithArgs = [
        "-u", "--user",
        "-o", "--output",
        "-A", "--user-agent",
        "-e", "--referer",
        "-m", "--max-time",
        "--connect-timeout",
        "-E", "--cert",
        "--cacert"
      ];
      if (optsWithArgs.includes(arg)) {
        i++; // Skip the next argument as it belongs to this flag
      }
    } else {
      // Positional argument: if it's the first non-option positional, it's the URL.
      if (!url && arg.toLowerCase() !== "curl" && arg.toLowerCase() !== "curl.exe") {
        // Strip out enclosing quotes if any survived argument splitting
        url = arg.replace(/^['"]|['"]$/g, "");
      }
    }
  }

  // Set default method if not explicitly defined
  if (!method) {
    method = body ? "POST" : "GET";
  }

  return {
    method,
    url,
    headers,
    body,
  };
}

/**
 * Generates a clean, multi-line cURL command string.
 * Supports bash (\) and powershell (`) line continuations.
 */
export function generateCurl(
  method: string,
  url: string,
  headers: Array<{ key: string; value: string }>,
  body: string,
  continuationChar: "\\" | "`" = "\\"
): string {
  let command = `curl --location --request ${method} '${url}'`;

  headers.forEach(h => {
    if (h.key.trim()) {
      const escapedVal = h.value.replace(/'/g, "'\\''");
      command += ` ${continuationChar}\n--header '${h.key.trim()}: ${escapedVal}'`;
    }
  });

  if (body) {
    let formattedBody = body;
    try {
      const parsed = JSON.parse(body);
      formattedBody = JSON.stringify(parsed, null, 4);
    } catch {
      // Leave unformatted if not valid JSON
    }
    const escapedBody = formattedBody.replace(/'/g, "'\\''");
    command += ` ${continuationChar}\n--data '${escapedBody}'`;
  }

  return command;
}

/**
 * Generates a Postman Collection JSON (v2.1.0) string for importing.
 */
export function generatePostmanCollection(
  method: string,
  url: string,
  headers: Array<{ key: string; value: string }>,
  body: string
): string {
  let requestName = "cURL Request";
  if (url) {
    try {
      // Simple parse to extract pathname for request name
      const cleanUrl = url.startsWith("http") ? url : "http://" + url;
      const urlObj = new URL(cleanUrl);
      requestName = `${method} ${urlObj.pathname}`;
    } catch {
      requestName = `${method} ${url}`;
    }
  }

  const collection = {
    info: {
      _postman_id: "tablecraft-curl-" + Date.now(),
      name: "TableCraft cURL Import",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: requestName,
        request: {
          method: method,
          header: headers
            .filter(h => h.key.trim())
            .map(h => ({
              key: h.key.trim(),
              value: h.value,
              type: "text"
            })),
          body: body ? {
            mode: "raw",
            raw: body,
            options: {
              raw: {
                language: "json"
              }
            }
          } : undefined,
          url: url
        },
        response: []
      }
    ]
  };

  return JSON.stringify(collection, null, 2);
}

/**
 * Generates standard JavaScript fetch code.
 */
export function generateFetchCode(
  method: string,
  url: string,
  headers: Array<{ key: string; value: string }>,
  body: string
): string {
  const headerObj: Record<string, string> = {};
  headers.forEach(h => {
    if (h.key.trim()) {
      headerObj[h.key.trim()] = h.value;
    }
  });

  const fetchOptions: any = {
    method: method,
    headers: headerObj
  };

  if (body) {
    try {
      JSON.parse(body);
      // It's JSON, inject placeholding token for raw output code
      fetchOptions.body = "__JSON_BODY_PLACEHOLDER__";
    } catch {
      fetchOptions.body = body;
    }
  }

  let optionsStr = JSON.stringify(fetchOptions, null, 2);

  if (body) {
    try {
      JSON.parse(body);
      // Replace placeholder with unquoted JSON.stringify
      const bodyFormatted = JSON.stringify(JSON.parse(body), null, 2);
      // Indent JSON body representation inside fetch
      const indentedBody = bodyFormatted.split("\n").map((line, idx) => idx === 0 ? line : "    " + line).join("\n");
      optionsStr = optionsStr.replace(
        `"__JSON_BODY_PLACEHOLDER__"`,
        `JSON.stringify(${indentedBody})`
      );
    } catch {
      // fall back to raw string
    }
  }

  return `fetch('${url}', ${optionsStr})\n  .then(response => {\n    if (!response.ok) {\n      throw new Error('Network response was not ok ' + response.statusText);\n    }\n    return response.json();\n  })\n  .then(data => console.log(data))\n  .catch(error => console.error('Fetch Error:', error));`;
}
