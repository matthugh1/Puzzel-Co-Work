/**
 * WebSearch Tool
 * Search the web and return results
 */

import type { ToolExecutor } from "./types";

const MAX_RESULTS = 10;
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Simple web search using DuckDuckGo HTML interface
 * This is a basic implementation - in production you might want to use Tavily API or Google Custom Search
 */
async function searchWeb(
  query: string,
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    // Use DuckDuckGo's instant answer API (no API key required)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Cowork/1.0)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }

    const data = (await response.json()) as {
      Results?: Array<{ FirstURL: string; Text: string }>;
      RelatedTopics?: Array<{ FirstURL: string; Text: string }>;
    };

    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // Process Results
    if (data.Results) {
      for (const result of data.Results.slice(0, MAX_RESULTS)) {
        if (result.FirstURL && result.Text) {
          results.push({
            title: result.Text.split(" - ")[0] || result.Text.substring(0, 60),
            url: result.FirstURL,
            snippet: result.Text.substring(0, 200),
          });
        }
      }
    }

    // Process RelatedTopics if we need more results
    if (results.length < MAX_RESULTS && data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(
        0,
        MAX_RESULTS - results.length,
      )) {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 60),
            url: topic.FirstURL,
            snippet: topic.Text.substring(0, 200),
          });
        }
      }
    }

    return results;
  } catch (error) {
    // Fallback: return a simple error message
    console.error("[WebSearch] Error:", error);
    return [
      {
        title: "Search Error",
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Unable to fetch search results. You can try searching manually at the URL above. Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

export const webSearchTool: ToolExecutor = {
  name: "WebSearch",
  description:
    "Search the web for information. Returns a list of relevant URLs with titles and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g., 'Python async await tutorial')",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return (default 10, max 20)",
      },
    },
    required: ["query"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { query, maxResults } = input as {
      query: string;
      maxResults?: number;
    };

    if (!query || typeof query !== "string") {
      return {
        content: "Error: query must be a non-empty string",
        isError: true,
      };
    }

    const limit = Math.min(
      maxResults && maxResults > 0 ? maxResults : MAX_RESULTS,
      20,
    );

    try {
      const results = await searchWeb(query);

      if (results.length === 0) {
        return {
          content: `No results found for query: "${query}"`,
          isError: false,
        };
      }

      const formatted = results
        .slice(0, limit)
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n");

      return {
        content: `Found ${results.length} result(s) for "${query}":\n\n${formatted}`,
        isError: false,
        metadata: { query, results: results.slice(0, limit) },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error performing web search: ${message}`,
        isError: true,
      };
    }
  },
};
