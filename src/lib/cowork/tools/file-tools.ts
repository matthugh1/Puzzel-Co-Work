/**
 * File Operation Tools
 * Read, Write, Edit, Glob, Grep
 */

import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import type { ToolExecutor } from "./types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_OUTPUT_LENGTH = 30000; // Truncate at 30K chars

/**
 * Ensure a path is within the session directory (security)
 */
function sanitizePath(filePath: string, sessionDir: string): string | null {
  const resolved = path.resolve(sessionDir, filePath);
  const sessionResolved = path.resolve(sessionDir);
  if (!resolved.startsWith(sessionResolved)) {
    return null; // Path outside session directory
  }
  return resolved;
}

export const readTool: ToolExecutor = {
  name: "Read",
  description:
    "Read the contents of a file from the session's working directory.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path to the file from the session directory",
      },
    },
    required: ["path"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { path: filePath } = input as { path: string };

    try {
      const fullPath = sanitizePath(filePath, context.sessionDir);
      if (!fullPath) {
        return {
          content: `Error: Path "${filePath}" is outside the session directory`,
          isError: true,
        };
      }

      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        return {
          content: `Error: "${filePath}" is not a file`,
          isError: true,
        };
      }

      if (stats.size > MAX_FILE_SIZE) {
        return {
          content: `Error: File "${filePath}" is too large (${stats.size} bytes, max ${MAX_FILE_SIZE})`,
          isError: true,
        };
      }

      const content = await fs.readFile(fullPath, "utf-8");
      const truncated =
        content.length > MAX_OUTPUT_LENGTH
          ? content.substring(0, MAX_OUTPUT_LENGTH) +
            `\n\n... (truncated, ${content.length - MAX_OUTPUT_LENGTH} more characters)`
          : content;

      return {
        content: truncated,
        isError: false,
        metadata: {
          filePath,
          size: stats.size,
          truncated: content.length > MAX_OUTPUT_LENGTH,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if ((error as { code?: string }).code === "ENOENT") {
        return {
          content: `Error: File "${filePath}" not found`,
          isError: true,
        };
      }
      return {
        content: `Error reading file: ${message}`,
        isError: true,
      };
    }
  },
};

export const writeTool: ToolExecutor = {
  name: "Write",
  description:
    "Create or overwrite a file in the session directory. Use this to generate code, documents, or other artifacts. Files written to 'outputs/' directory will be treated as artifacts.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Relative path to the file from the session directory (use 'outputs/filename.ext' for artifacts)",
      },
      content: { type: "string", description: "File contents" },
    },
    required: ["path", "content"],
  },
  permissionLevel: "auto", // Files are sandboxed to session directory
  async execute(input, context) {
    const { path: filePath, content } = input as {
      path: string;
      content: string;
    };

    try {
      // Handle outputs/ directory specially - it should be written to the outputs directory, not working/
      let targetDir = context.sessionDir;
      let relativePath = filePath;

      if (filePath.startsWith("outputs/")) {
        // Write to outputs directory (one level up from working/)
        targetDir = path.resolve(context.sessionDir, "..", "outputs");
        relativePath = filePath.replace(/^outputs\//, "");
        await fs.mkdir(targetDir, { recursive: true });
      }

      const fullPath = sanitizePath(relativePath, targetDir);
      if (!fullPath) {
        return {
          content: `Error: Path "${filePath}" is outside the session directory`,
          isError: true,
        };
      }

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, "utf-8");

      // Determine if this is an artifact (in outputs/)
      const isArtifact = filePath.startsWith("outputs/");

      return {
        content: `Successfully wrote file "${filePath}" (${content.length} characters)`,
        isError: false,
        metadata: {
          filePath,
          fullPath,
          size: content.length,
          isArtifact,
          // For artifacts, include info needed to create CoworkFile record
          ...(isArtifact
            ? {
                artifactPath: fullPath,
                artifactFileName: path.basename(filePath),
              }
            : {}),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error writing file: ${message}`,
        isError: true,
      };
    }
  },
};

export const editTool: ToolExecutor = {
  name: "Edit",
  description:
    "Perform a find-and-replace operation in a file. Useful for making targeted changes.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path to the file" },
      find: { type: "string", description: "Text to find (exact match)" },
      replace: { type: "string", description: "Replacement text" },
    },
    required: ["path", "find", "replace"],
  },
  permissionLevel: "auto", // Files are sandboxed to session directory
  async execute(input, context) {
    const {
      path: filePath,
      find,
      replace,
    } = input as { path: string; find: string; replace: string };

    try {
      const fullPath = sanitizePath(filePath, context.sessionDir);
      if (!fullPath) {
        return {
          content: `Error: Path "${filePath}" is outside the session directory`,
          isError: true,
        };
      }

      const content = await fs.readFile(fullPath, "utf-8");

      if (!content.includes(find)) {
        return {
          content: `Error: Text "${find}" not found in file "${filePath}"`,
          isError: true,
        };
      }

      const newContent = content.replace(find, replace);
      await fs.writeFile(fullPath, newContent, "utf-8");

      const count = (
        content.match(
          new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        ) || []
      ).length;

      return {
        content: `Successfully replaced "${find}" with "${replace}" in "${filePath}" (${count} occurrence(s))`,
        isError: false,
        metadata: { filePath, replacements: count },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if ((error as { code?: string }).code === "ENOENT") {
        return {
          content: `Error: File "${filePath}" not found`,
          isError: true,
        };
      }
      return {
        content: `Error editing file: ${message}`,
        isError: true,
      };
    }
  },
};

export const globTool: ToolExecutor = {
  name: "Glob",
  description:
    "List files matching a pattern in the session directory. Supports glob patterns (e.g., '*.ts', 'src/**/*.tsx').",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern to match files" },
    },
    required: ["pattern"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { pattern } = input as { pattern: string };

    try {
      const fullPattern = path.join(context.sessionDir, pattern);
      const matches = await glob(fullPattern, {
        cwd: context.sessionDir,
        absolute: false,
        nodir: true, // Only files, not directories
      });

      if (matches.length === 0) {
        return {
          content: `No files found matching pattern "${pattern}"`,
          isError: false,
          metadata: { pattern, count: 0 },
        };
      }

      // Get file sizes
      const files = await Promise.all(
        matches.map(async (match) => {
          const fullPath = path.join(context.sessionDir, match);
          const stats = await fs.stat(fullPath);
          return { path: match, size: stats.size };
        }),
      );

      const list = files.map((f) => `  ${f.path} (${f.size} bytes)`).join("\n");

      return {
        content: `Found ${files.length} file(s) matching "${pattern}":\n${list}`,
        isError: false,
        metadata: { pattern, count: files.length, files },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error searching files: ${message}`,
        isError: true,
      };
    }
  },
};

export const grepTool: ToolExecutor = {
  name: "Grep",
  description:
    "Search for text patterns in files within the session directory. Returns matching lines with file paths.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Text or regex pattern to search for",
      },
      filePattern: {
        type: "string",
        description:
          "Optional glob pattern to limit files to search (e.g., '*.ts')",
      },
    },
    required: ["pattern"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { pattern, filePattern } = input as {
      pattern: string;
      filePattern?: string;
    };

    try {
      // First, get list of files to search
      let filesToSearch: string[];
      if (filePattern) {
        const fullPattern = path.join(context.sessionDir, filePattern);
        filesToSearch = await glob(fullPattern, {
          cwd: context.sessionDir,
          absolute: false,
          nodir: true,
        });
      } else {
        // Search all files recursively
        filesToSearch = await glob("**/*", {
          cwd: context.sessionDir,
          absolute: false,
          nodir: true,
        });
      }

      if (filesToSearch.length === 0) {
        return {
          content: `No files found to search${filePattern ? ` matching "${filePattern}"` : ""}`,
          isError: false,
        };
      }

      const regex = new RegExp(pattern, "gi");
      const results: Array<{ file: string; line: number; content: string }> =
        [];

      for (const file of filesToSearch) {
        try {
          const fullPath = path.join(context.sessionDir, file);
          const stats = await fs.stat(fullPath);

          // Skip large files
          if (stats.size > MAX_FILE_SIZE) continue;

          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");

          lines.forEach((line, index) => {
            if (regex.test(line)) {
              results.push({
                file,
                line: index + 1,
                content: line.trim(),
              });
            }
          });
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      if (results.length === 0) {
        return {
          content: `Pattern "${pattern}" not found in any files${filePattern ? ` matching "${filePattern}"` : ""}`,
          isError: false,
          metadata: { pattern, filesSearched: filesToSearch.length },
        };
      }

      // Format results
      const output = results
        .slice(0, 100) // Limit to 100 matches
        .map((r) => `${r.file}:${r.line}: ${r.content}`)
        .join("\n");

      const truncated =
        results.length > 100
          ? `${output}\n\n... (${results.length - 100} more matches)`
          : output;

      return {
        content: `Found ${results.length} match(es) for "${pattern}":\n${truncated}`,
        isError: false,
        metadata: {
          pattern,
          matches: results.length,
          filesSearched: filesToSearch.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error searching files: ${message}`,
        isError: true,
      };
    }
  },
};
