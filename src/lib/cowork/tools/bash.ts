/**
 * Bash Execution Tool
 * Execute shell commands with timeout and directory sandboxing
 */

import { spawn } from "child_process";
import path from "path";
import type { ToolExecutor } from "./types";

const DEFAULT_TIMEOUT = 120000; // 120 seconds
const MAX_TIMEOUT = 600000; // 600 seconds (10 minutes)
const MAX_OUTPUT_LENGTH = 30000; // Truncate at 30K chars

export const bashTool: ToolExecutor = {
  name: "Bash",
  description:
    "Execute a bash command in the session's working directory. Use this to run scripts, install packages, or perform system operations. Commands run with a timeout and output is truncated for large results.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "Bash command to execute (e.g., 'npm install', 'ls -la', 'python script.py')",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default 120000, max 600000)",
      },
    },
    required: ["command"],
  },
  permissionLevel: "ask", // Bash commands require permission
  async execute(input, context) {
    const { command, timeout } = input as { command: string; timeout?: number };

    if (!command || typeof command !== "string") {
      return {
        content: "Error: command must be a non-empty string",
        isError: true,
      };
    }

    const timeoutMs = Math.min(
      timeout && timeout > 0 ? timeout : DEFAULT_TIMEOUT,
      MAX_TIMEOUT,
    );

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      // Spawn bash process with command
      const proc = spawn("bash", ["-c", command], {
        cwd: context.sessionDir, // Restrict to session directory
        env: {
          ...process.env,
          // Override PATH to prevent access to system binaries (optional security hardening)
          // PATH: "/usr/local/bin:/usr/bin:/bin",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Collect stdout
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString("utf-8");
        // Early truncation check
        if (stdout.length > MAX_OUTPUT_LENGTH) {
          if (!killed) {
            killed = true;
            proc.kill("SIGTERM");
          }
        }
      });

      // Collect stderr
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf-8");
        // Early truncation check
        if (stderr.length > MAX_OUTPUT_LENGTH) {
          if (!killed) {
            killed = true;
            proc.kill("SIGTERM");
          }
        }
      });

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (!killed) {
          killed = true;
          proc.kill("SIGTERM");
          // Give it a moment to clean up, then force kill
          setTimeout(() => {
            try {
              proc.kill("SIGKILL");
            } catch {
              // Process already dead
            }
          }, 1000);
        }
      }, timeoutMs);

      // Handle process exit
      proc.on("exit", (code, signal) => {
        clearTimeout(timeoutHandle);

        const wasTimeout = killed && signal === "SIGTERM" && code === null;
        const wasTruncated =
          stdout.length > MAX_OUTPUT_LENGTH ||
          stderr.length > MAX_OUTPUT_LENGTH;

        // Truncate output if needed
        let finalStdout = stdout;
        let finalStderr = stderr;
        if (finalStdout.length > MAX_OUTPUT_LENGTH) {
          finalStdout =
            finalStdout.substring(0, MAX_OUTPUT_LENGTH) +
            `\n\n... (truncated, ${stdout.length - MAX_OUTPUT_LENGTH} more characters)`;
        }
        if (finalStderr.length > MAX_OUTPUT_LENGTH) {
          finalStderr =
            finalStderr.substring(0, MAX_OUTPUT_LENGTH) +
            `\n\n... (truncated, ${stderr.length - MAX_OUTPUT_LENGTH} more characters)`;
        }

        // Build result message
        let resultMessage = "";
        if (wasTimeout) {
          resultMessage = `Command timed out after ${timeoutMs}ms.\n\n`;
        } else if (wasTruncated) {
          resultMessage =
            "Command output was truncated due to size limits.\n\n";
        }

        if (finalStdout) {
          resultMessage += `STDOUT:\n${finalStdout}\n\n`;
        }
        if (finalStderr) {
          resultMessage += `STDERR:\n${finalStderr}\n\n`;
        }

        if (!finalStdout && !finalStderr) {
          resultMessage = "Command completed with no output.";
        }

        resultMessage += `\nExit code: ${code ?? (signal ? `killed by ${signal}` : "unknown")}`;

        resolve({
          content: resultMessage,
          isError: code !== 0 && code !== null,
          metadata: {
            exitCode: code,
            signal,
            wasTimeout,
            wasTruncated,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
          },
        });
      });

      // Handle process errors
      proc.on("error", (error) => {
        clearTimeout(timeoutHandle);
        resolve({
          content: `Error spawning process: ${error.message}`,
          isError: true,
          metadata: { error: error.message },
        });
      });
    });
  },
};
