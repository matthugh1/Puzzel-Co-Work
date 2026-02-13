/**
 * WebFetch Tool
 * Fetch and extract content from a URL
 */

import type { ToolExecutor } from "./types";

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_CONTENT_LENGTH = 30000; // Truncate at 30K chars

/**
 * Simple HTML to text extraction
 * Removes script/style tags and extracts text content
 */
function htmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove HTML tags but preserve line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities (basic)
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.trim();

  return text;
}

export const webFetchTool: ToolExecutor = {
  name: "WebFetch",
  description:
    "Fetch content from a URL and extract readable text. Useful for reading web pages, documentation, or articles.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to fetch (must be http:// or https://)",
      },
    },
    required: ["url"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { url } = input as { url: string };

    if (!url || typeof url !== "string") {
      return {
        content: "Error: url must be a non-empty string",
        isError: true,
      };
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          content: `Error: URL must use http:// or https:// protocol (got ${parsedUrl.protocol})`,
          isError: true,
        };
      }
    } catch {
      return {
        content: `Error: Invalid URL: "${url}"`,
        isError: true,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Cowork/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: `Error: HTTP ${response.status} ${response.statusText}`,
          isError: true,
          metadata: {
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain")
      ) {
        return {
          content: `Error: Unsupported content type: ${contentType}. Only HTML and plain text are supported.`,
          isError: true,
          metadata: { contentType },
        };
      }

      const html = await response.text();

      // Extract text from HTML
      const text = htmlToText(html);

      // Truncate if needed
      const truncated =
        text.length > MAX_CONTENT_LENGTH
          ? text.substring(0, MAX_CONTENT_LENGTH) +
            `\n\n... (truncated, ${text.length - MAX_CONTENT_LENGTH} more characters)`
          : text;

      return {
        content: `Content from ${url}:\n\n${truncated}`,
        isError: false,
        metadata: {
          url,
          originalLength: text.length,
          truncated: text.length > MAX_CONTENT_LENGTH,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          content: `Error: Request timed out after ${REQUEST_TIMEOUT}ms`,
          isError: true,
        };
      }
      return {
        content: `Error fetching URL: ${message}`,
        isError: true,
        metadata: { error: message },
      };
    }
  },
};
