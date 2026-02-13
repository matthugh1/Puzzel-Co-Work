"use client";

/**
 * Cowork global state management
 * Uses React Context + useReducer for predictable state updates
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import type {
  CoworkAppState,
  CoworkSession,
  CoworkMessage,
  CoworkTodoItem,
  CoworkFileRecord,
  SubAgent,
  PermissionRequest,
  AskQuestion,
  PlanStep,
} from "@/types/cowork";

// ============================================================================
// Actions
// ============================================================================

export type CoworkAction =
  // Session actions
  | { type: "SET_SESSIONS"; payload: CoworkSession[] }
  | { type: "SET_ACTIVE_SESSION"; payload: CoworkSession | null }
  | { type: "ADD_SESSION"; payload: CoworkSession }
  | { type: "UPDATE_SESSION"; payload: Partial<CoworkSession> & { id: string } }
  | { type: "REMOVE_SESSION"; payload: string }
  | { type: "SET_SESSIONS_LOADING"; payload: boolean }
  // Chat actions
  | { type: "SET_MESSAGES"; payload: CoworkMessage[] }
  | { type: "ADD_MESSAGE"; payload: CoworkMessage }
  | { type: "UPDATE_LAST_MESSAGE"; payload: Partial<CoworkMessage> }
  | { type: "APPEND_TO_STREAM_BUFFER"; payload: string }
  | { type: "FLUSH_STREAM_BUFFER" }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_PENDING_PERMISSION"; payload: PermissionRequest | null }
  | { type: "SET_PENDING_QUESTION"; payload: AskQuestion | null }
  | {
      type: "SET_PENDING_PLAN";
      payload: { planId: string; steps: PlanStep[] } | null;
    }
  // Todo actions
  | { type: "SET_TODOS"; payload: CoworkTodoItem[] }
  // File actions
  | { type: "SET_UPLOADS"; payload: CoworkFileRecord[] }
  | { type: "SET_OUTPUTS"; payload: CoworkFileRecord[] }
  | { type: "ADD_FILE"; payload: CoworkFileRecord }
  | { type: "SET_ACTIVE_ARTIFACT"; payload: CoworkFileRecord | null }
  | {
      type: "SET_UPLOAD_PROGRESS";
      payload: { fileId: string; progress: number };
    }
  | { type: "CLEAR_UPLOAD_PROGRESS"; payload: string }
  // Sub-agent actions
  | { type: "SET_SUB_AGENTS"; payload: SubAgent[] }
  | { type: "UPDATE_SUB_AGENT"; payload: SubAgent }
  // Settings actions
  | {
      type: "SET_SETTINGS";
      payload: import("@/types/cowork").CoworkSettings | null;
    }
  // UI actions
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR_OPEN"; payload: boolean }
  | { type: "TOGGLE_RIGHT_PANEL" }
  | { type: "SET_RIGHT_PANEL_OPEN"; payload: boolean }
  | {
      type: "SET_RIGHT_PANEL_TAB";
      payload: "artifacts" | "files" | "tasks" | "tools";
    }
  | { type: "SET_COMMAND_PALETTE_OPEN"; payload: boolean }
  | { type: "SET_SETTINGS_OPEN"; payload: boolean }
  | { type: "SET_STARTER_MESSAGE"; payload: string | null }
  // Message feedback
  | {
      type: "SET_MESSAGE_FEEDBACK";
      payload: { messageId: string; rating: "positive" | "negative" };
    }
  | {
      type: "SET_MESSAGE_FEEDBACK_MAP";
      payload: Record<string, "positive" | "negative">;
    };

// ============================================================================
// Initial State
// ============================================================================

const initialState: CoworkAppState = {
  sessions: {
    list: [],
    active: null,
    loading: false,
  },
  chat: {
    messages: [],
    isStreaming: false,
    streamBuffer: "",
    pendingPermission: null,
    pendingQuestion: null,
    pendingPlan: null,
    starterMessage: null,
    messageFeedback: {},
  },
  todos: {
    items: [],
    lastUpdated: new Date().toISOString(),
  },
  files: {
    uploads: [],
    outputs: [],
    activeArtifact: null,
    uploadProgress: {},
  },
  subAgents: {
    active: [],
  },
  settings: null,
  ui: {
    sidebarOpen: true,
    rightPanelOpen: false,
    rightPanelTab: "artifacts",
    commandPaletteOpen: false,
    settingsOpen: false,
  },
};

// ============================================================================
// Reducer
// ============================================================================

function coworkReducer(
  state: CoworkAppState,
  action: CoworkAction,
): CoworkAppState {
  switch (action.type) {
    // Session
    case "SET_SESSIONS":
      return {
        ...state,
        sessions: { ...state.sessions, list: action.payload },
      };
    case "SET_ACTIVE_SESSION":
      return {
        ...state,
        sessions: { ...state.sessions, active: action.payload },
      };
    case "ADD_SESSION":
      return {
        ...state,
        sessions: {
          ...state.sessions,
          list: [action.payload, ...state.sessions.list],
        },
      };
    case "UPDATE_SESSION": {
      const updated = state.sessions.list.map((s) =>
        s.id === action.payload.id ? { ...s, ...action.payload } : s,
      );
      const activeUpdated =
        state.sessions.active?.id === action.payload.id
          ? { ...state.sessions.active, ...action.payload }
          : state.sessions.active;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          list: updated,
          active: activeUpdated,
        },
      };
    }
    case "REMOVE_SESSION":
      return {
        ...state,
        sessions: {
          ...state.sessions,
          list: state.sessions.list.filter((s) => s.id !== action.payload),
          active:
            state.sessions.active?.id === action.payload
              ? null
              : state.sessions.active,
        },
      };
    case "SET_SESSIONS_LOADING":
      return {
        ...state,
        sessions: { ...state.sessions, loading: action.payload },
      };

    // Chat
    case "SET_MESSAGES":
      return { ...state, chat: { ...state.chat, messages: action.payload } };
    case "ADD_MESSAGE":
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, action.payload],
        },
      };
    case "UPDATE_LAST_MESSAGE": {
      const messages = [...state.chat.messages];
      const lastMsg = messages[messages.length - 1];
      if (messages.length > 0 && lastMsg) {
        messages[messages.length - 1] = {
          ...lastMsg,
          ...action.payload,
          // Ensure required fields are never undefined
          id: action.payload.id ?? lastMsg.id,
          sessionId: action.payload.sessionId ?? lastMsg.sessionId,
          role: action.payload.role ?? lastMsg.role,
          content: action.payload.content ?? lastMsg.content,
          createdAt: action.payload.createdAt ?? lastMsg.createdAt,
        };
      }
      return { ...state, chat: { ...state.chat, messages } };
    }
    case "APPEND_TO_STREAM_BUFFER":
      return {
        ...state,
        chat: {
          ...state.chat,
          streamBuffer: state.chat.streamBuffer + action.payload,
        },
      };
    case "FLUSH_STREAM_BUFFER": {
      const messages = [...state.chat.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && state.chat.streamBuffer) {
        const content = [...(lastMsg.content || [])];
        const lastContent = content[content.length - 1];
        if (lastContent && lastContent.type === "text") {
          content[content.length - 1] = {
            ...lastContent,
            text: lastContent.text + state.chat.streamBuffer,
          };
        } else {
          content.push({ type: "text", text: state.chat.streamBuffer });
        }
        messages[messages.length - 1] = { ...lastMsg, content };
      }
      return {
        ...state,
        chat: { ...state.chat, messages, streamBuffer: "" },
      };
    }
    case "SET_STREAMING":
      return {
        ...state,
        chat: { ...state.chat, isStreaming: action.payload },
      };
    case "SET_PENDING_PERMISSION":
      return {
        ...state,
        chat: { ...state.chat, pendingPermission: action.payload },
      };
    case "SET_PENDING_QUESTION":
      return {
        ...state,
        chat: { ...state.chat, pendingQuestion: action.payload },
      };
    case "SET_PENDING_PLAN":
      return {
        ...state,
        chat: { ...state.chat, pendingPlan: action.payload },
      };

    // Todos
    case "SET_TODOS":
      return {
        ...state,
        todos: {
          items: action.payload,
          lastUpdated: new Date().toISOString(),
        },
      };

    // Files
    case "SET_UPLOADS":
      return { ...state, files: { ...state.files, uploads: action.payload } };
    case "SET_OUTPUTS":
      return { ...state, files: { ...state.files, outputs: action.payload } };
    case "ADD_FILE": {
      const file = action.payload;
      if (file.category === "upload") {
        return {
          ...state,
          files: {
            ...state.files,
            uploads: [...state.files.uploads, file],
          },
        };
      }
      return {
        ...state,
        files: { ...state.files, outputs: [...state.files.outputs, file] },
      };
    }
    case "SET_ACTIVE_ARTIFACT":
      return {
        ...state,
        files: { ...state.files, activeArtifact: action.payload },
        ui: { ...state.ui, rightPanelOpen: action.payload !== null },
      };
    case "SET_UPLOAD_PROGRESS":
      return {
        ...state,
        files: {
          ...state.files,
          uploadProgress: {
            ...state.files.uploadProgress,
            [action.payload.fileId]: action.payload.progress,
          },
        },
      };
    case "CLEAR_UPLOAD_PROGRESS": {
      const progress = { ...state.files.uploadProgress };
      delete progress[action.payload];
      return {
        ...state,
        files: { ...state.files, uploadProgress: progress },
      };
    }

    // Sub-agents
    case "SET_SUB_AGENTS":
      return {
        ...state,
        subAgents: { ...state.subAgents, active: action.payload },
      };
    case "UPDATE_SUB_AGENT": {
      const existingIndex = state.subAgents.active.findIndex(
        (a) => a.id === action.payload.id,
      );
      let agents;
      if (existingIndex >= 0) {
        // Update existing agent
        agents = state.subAgents.active.map((a) =>
          a.id === action.payload.id ? action.payload : a,
        );
      } else {
        // Add new agent
        agents = [...state.subAgents.active, action.payload];
      }
      return { ...state, subAgents: { ...state.subAgents, active: agents } };
    }

    // UI
    case "TOGGLE_SIDEBAR":
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      };
    case "SET_SIDEBAR_OPEN":
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: action.payload },
      };
    case "TOGGLE_RIGHT_PANEL":
      return {
        ...state,
        ui: { ...state.ui, rightPanelOpen: !state.ui.rightPanelOpen },
      };
    case "SET_RIGHT_PANEL_OPEN":
      return {
        ...state,
        ui: { ...state.ui, rightPanelOpen: action.payload },
      };
    case "SET_RIGHT_PANEL_TAB":
      return {
        ...state,
        ui: { ...state.ui, rightPanelTab: action.payload },
      };
    case "SET_COMMAND_PALETTE_OPEN":
      return {
        ...state,
        ui: { ...state.ui, commandPaletteOpen: action.payload },
      };
    case "SET_SETTINGS":
      return {
        ...state,
        settings: action.payload,
      };
    case "SET_SETTINGS_OPEN":
      return {
        ...state,
        ui: { ...state.ui, settingsOpen: action.payload },
      };

    case "SET_STARTER_MESSAGE":
      return {
        ...state,
        chat: { ...state.chat, starterMessage: action.payload },
      };

    case "SET_MESSAGE_FEEDBACK":
      return {
        ...state,
        chat: {
          ...state.chat,
          messageFeedback: {
            ...state.chat.messageFeedback,
            [action.payload.messageId]: action.payload.rating,
          },
        },
      };
    case "SET_MESSAGE_FEEDBACK_MAP":
      return {
        ...state,
        chat: { ...state.chat, messageFeedback: action.payload },
      };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface CoworkContextValue {
  state: CoworkAppState;
  dispatch: Dispatch<CoworkAction>;
}

const CoworkContext = createContext<CoworkContextValue | null>(null);

export function CoworkProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(coworkReducer, initialState);

  return (
    <CoworkContext.Provider value={{ state, dispatch }}>
      {children}
    </CoworkContext.Provider>
  );
}

export function useCowork(): CoworkContextValue {
  const context = useContext(CoworkContext);
  if (!context) {
    throw new Error("useCowork must be used within a CoworkProvider");
  }
  return context;
}

// ============================================================================
// Action Helpers
// ============================================================================

export function useCoworkActions() {
  const { dispatch } = useCowork();

  return {
    // Sessions
    setSessions: useCallback(
      (sessions: CoworkSession[]) =>
        dispatch({ type: "SET_SESSIONS", payload: sessions }),
      [dispatch],
    ),
    setActiveSession: useCallback(
      (session: CoworkSession | null) =>
        dispatch({ type: "SET_ACTIVE_SESSION", payload: session }),
      [dispatch],
    ),
    addSession: useCallback(
      (session: CoworkSession) =>
        dispatch({ type: "ADD_SESSION", payload: session }),
      [dispatch],
    ),
    updateSession: useCallback(
      (update: Partial<CoworkSession> & { id: string }) =>
        dispatch({ type: "UPDATE_SESSION", payload: update }),
      [dispatch],
    ),
    removeSession: useCallback(
      (id: string) => dispatch({ type: "REMOVE_SESSION", payload: id }),
      [dispatch],
    ),
    setSessionsLoading: useCallback(
      (loading: boolean) =>
        dispatch({ type: "SET_SESSIONS_LOADING", payload: loading }),
      [dispatch],
    ),

    // Chat
    setMessages: useCallback(
      (messages: CoworkMessage[]) =>
        dispatch({ type: "SET_MESSAGES", payload: messages }),
      [dispatch],
    ),
    addMessage: useCallback(
      (message: CoworkMessage) =>
        dispatch({ type: "ADD_MESSAGE", payload: message }),
      [dispatch],
    ),
    updateLastMessage: useCallback(
      (update: Partial<CoworkMessage>) =>
        dispatch({ type: "UPDATE_LAST_MESSAGE", payload: update }),
      [dispatch],
    ),
    appendToStreamBuffer: useCallback(
      (text: string) =>
        dispatch({ type: "APPEND_TO_STREAM_BUFFER", payload: text }),
      [dispatch],
    ),
    flushStreamBuffer: useCallback(
      () => dispatch({ type: "FLUSH_STREAM_BUFFER" }),
      [dispatch],
    ),
    setStreaming: useCallback(
      (streaming: boolean) =>
        dispatch({ type: "SET_STREAMING", payload: streaming }),
      [dispatch],
    ),

    // Todos
    setTodos: useCallback(
      (todos: CoworkTodoItem[]) =>
        dispatch({ type: "SET_TODOS", payload: todos }),
      [dispatch],
    ),

    // Files
    setUploads: useCallback(
      (files: CoworkFileRecord[]) =>
        dispatch({ type: "SET_UPLOADS", payload: files }),
      [dispatch],
    ),
    setOutputs: useCallback(
      (files: CoworkFileRecord[]) =>
        dispatch({ type: "SET_OUTPUTS", payload: files }),
      [dispatch],
    ),
    addFile: useCallback(
      (file: CoworkFileRecord) => dispatch({ type: "ADD_FILE", payload: file }),
      [dispatch],
    ),
    setActiveArtifact: useCallback(
      (file: CoworkFileRecord | null) =>
        dispatch({ type: "SET_ACTIVE_ARTIFACT", payload: file }),
      [dispatch],
    ),

    // Sub-agents
    setSubAgents: useCallback(
      (agents: SubAgent[]) =>
        dispatch({ type: "SET_SUB_AGENTS", payload: agents }),
      [dispatch],
    ),
    updateSubAgent: useCallback(
      (agent: SubAgent) =>
        dispatch({ type: "UPDATE_SUB_AGENT", payload: agent }),
      [dispatch],
    ),

    // Settings
    setSettings: useCallback(
      (settings: import("@/types/cowork").CoworkSettings | null) =>
        dispatch({ type: "SET_SETTINGS", payload: settings }),
      [dispatch],
    ),

    // UI
    toggleSidebar: useCallback(
      () => dispatch({ type: "TOGGLE_SIDEBAR" }),
      [dispatch],
    ),
    toggleRightPanel: useCallback(
      () => dispatch({ type: "TOGGLE_RIGHT_PANEL" }),
      [dispatch],
    ),
    openRightPanel: useCallback(
      () => dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true }),
      [dispatch],
    ),
    setRightPanelTab: useCallback(
      (tab: "artifacts" | "files" | "tasks" | "tools") =>
        dispatch({ type: "SET_RIGHT_PANEL_TAB", payload: tab }),
      [dispatch],
    ),
    setCommandPaletteOpen: useCallback(
      (open: boolean) =>
        dispatch({ type: "SET_COMMAND_PALETTE_OPEN", payload: open }),
      [dispatch],
    ),
    setStarterMessage: useCallback(
      (message: string | null) =>
        dispatch({ type: "SET_STARTER_MESSAGE", payload: message }),
      [dispatch],
    ),
    setMessageFeedbackMap: useCallback(
      (map: Record<string, "positive" | "negative">) =>
        dispatch({ type: "SET_MESSAGE_FEEDBACK_MAP", payload: map }),
      [dispatch],
    ),
  };
}
