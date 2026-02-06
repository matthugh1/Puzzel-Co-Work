/**
 * Cowork TypeScript types
 * Matches the data models from the product specification
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = "active" | "paused" | "completed" | "error";
export type ClaudeModel =
  | "claude-sonnet-4-5"
  | "claude-opus-4-5"
  | "claude-haiku-4-5";

export interface CoworkSession {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  status: SessionStatus;
  model: ClaudeModel;
  createdAt: string;
  updatedAt: string;
  messages?: CoworkMessage[];
  todos?: CoworkTodoItem[];
  files?: CoworkFileRecord[];
  activeSubAgents?: SubAgent[];
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

export interface CoworkMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: MessageContent[];
  createdAt: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokenUsage?: { input: number; output: number };
  toolCalls?: ToolCall[];
  subAgentId?: string;
}

export type MessageContent =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | FileReferenceContent
  | ArtifactContent
  | TodoUpdateContent
  | PermissionRequestContent
  | AskUserContent
  | PlanContent
  | SubAgentStatusContent
  | ErrorContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export interface FileReferenceContent {
  type: "file_reference";
  fileId: string;
  fileName: string;
  mimeType: string;
}

export interface ArtifactContent {
  type: "artifact";
  artifactId: string;
  fileName: string;
  renderType: ArtifactType;
}

export interface TodoUpdateContent {
  type: "todo_update";
  todos: CoworkTodoItem[];
}

export interface PermissionRequestContent {
  type: "permission_request";
  requestId: string;
  action: string;
  details: Record<string, unknown>;
}

export interface AskUserContent {
  type: "ask_user";
  questionId: string;
  questions: AskQuestion[];
}

export interface PlanContent {
  type: "plan";
  planId: string;
  steps: PlanStep[];
  status: "pending" | "approved" | "rejected";
}

export interface SubAgentStatusContent {
  type: "sub_agent_status";
  agents: SubAgentSummary[];
}

export interface ErrorContent {
  type: "error";
  code: string;
  message: string;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
}

// ============================================================================
// Todo Types
// ============================================================================

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface CoworkTodoItem {
  id: string;
  sessionId: string;
  content: string;
  activeForm: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// File Types
// ============================================================================

export type FileCategory = "upload" | "output" | "working";
export type ArtifactType =
  | "html"
  | "jsx"
  | "markdown"
  | "mermaid"
  | "svg"
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "image"
  | "code"
  | "other";

export interface CoworkFileRecord {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  storagePath: string;
  downloadUrl: string;
  createdAt: string;
  metadata?: {
    originalName?: string;
    generatedBy?: string;
    artifactType?: ArtifactType;
  };
}

// ============================================================================
// Sub-Agent Types
// ============================================================================

export type SubAgentType = "bash" | "general-purpose" | "explore" | "plan";
export type SubAgentStatus = "running" | "completed" | "failed" | "cancelled";

export interface SubAgent {
  id: string;
  parentSessionId: string;
  description: string;
  type: SubAgentType;
  status: SubAgentStatus;
  prompt: string;
  result?: string;
  model?: string;
  createdAt: string;
  completedAt?: string;
  turns: number;
  maxTurns: number;
}

export interface SubAgentSummary {
  id: string;
  description: string;
  status: SubAgentStatus;
  turns: number;
  maxTurns: number;
}

// ============================================================================
// Plan Types
// ============================================================================

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
}

// ============================================================================
// Ask User Types
// ============================================================================

export interface AskQuestion {
  id: string;
  prompt: string;
  options: AskOption[];
  allowMultiple?: boolean;
}

export interface AskOption {
  id: string;
  label: string;
}

// ============================================================================
// Permission Types
// ============================================================================

export interface PermissionRequest {
  requestId: string;
  action: string;
  details: Record<string, unknown>;
}

// ============================================================================
// SSE Event Types
// ============================================================================

export type ServerEvent =
  | { type: "message_start"; data: { messageId: string; role: string } }
  | {
      type: "content_delta";
      data: { type: string; text?: string; [key: string]: unknown };
    }
  | { type: "tool_use_start"; data: ToolCall }
  | {
      type: "tool_result";
      data: { tool_use_id: string; content: string; is_error: boolean };
    }
  | { type: "todo_update"; data: { todos: CoworkTodoItem[] } }
  | { type: "artifact_created"; data: CoworkFileRecord }
  | { type: "sub_agent_update"; data: SubAgent }
  | { type: "permission_request"; data: PermissionRequest }
  | { type: "ask_question"; data: AskQuestion }
  | { type: "plan_proposed"; data: { planId: string; steps: PlanStep[] } }
  | {
      type: "message_end";
      data: { messageId: string; tokenUsage: { input: number; output: number } };
    }
  | { type: "error"; data: { code: string; message: string } }
  | { type: "session_status"; data: { status: SessionStatus } };

export type ClientEvent =
  | { type: "send_message"; data: { content: string; fileIds?: string[] } }
  | {
      type: "resolve_permission";
      data: { requestId: string; approved: boolean };
    }
  | {
      type: "answer_question";
      data: { questionId: string; answers: Record<string, string> };
    }
  | { type: "approve_plan"; data: { planId: string } }
  | { type: "reject_plan"; data: { planId: string } }
  | { type: "cancel_agent"; data: { agentId: string } }
  | { type: "stop_generation"; data: Record<string, never> };

// ============================================================================
// Settings Types
// ============================================================================

export interface CoworkSettings {
  defaultProvider: "anthropic" | "openai";
  defaultModel: string;
}

// ============================================================================
// Global State Shape
// ============================================================================

export interface CoworkAppState {
  sessions: {
    list: CoworkSession[];
    active: CoworkSession | null;
    loading: boolean;
  };
  chat: {
    messages: CoworkMessage[];
    isStreaming: boolean;
    streamBuffer: string;
    pendingPermission: PermissionRequest | null;
    pendingQuestion: AskQuestion | null;
    pendingPlan: { planId: string; steps: PlanStep[] } | null;
  };
  todos: {
    items: CoworkTodoItem[];
    lastUpdated: string;
  };
  files: {
    uploads: CoworkFileRecord[];
    outputs: CoworkFileRecord[];
    activeArtifact: CoworkFileRecord | null;
    uploadProgress: Record<string, number>;
  };
  subAgents: {
    active: SubAgent[];
  };
  settings: CoworkSettings | null;
  ui: {
    sidebarOpen: boolean;
    rightPanelOpen: boolean;
    rightPanelTab: "artifacts" | "files";
    commandPaletteOpen: boolean;
    settingsOpen: boolean;
  };
}
