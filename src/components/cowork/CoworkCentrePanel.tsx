"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  CoworkSession,
  CoworkMessage,
  CoworkTodoItem,
  CoworkFileRecord,
  MessageContent,
  PermissionRequest,
  PlanStep,
  SubAgent,
} from "@/types/cowork";
import { CoworkMessageItem } from "@/components/cowork/CoworkMessageItem";
import { CoworkInputArea } from "@/components/cowork/CoworkInputArea";
import { CoworkTodoWidget } from "@/components/cowork/CoworkTodoWidget";
import { EmptyStateWidget } from "@/components/cowork/EmptyStateWidget";
import { CapabilitiesPanel } from "@/components/cowork/CapabilitiesPanel";
import { useCowork, useCoworkActions } from "@/lib/cowork/context";
import {
  IconMenu,
  IconMessageSquare,
  IconList,
  IconPanelRight,
  IconRocket,
} from "@/components/cowork/icons";

interface CoworkCentrePanelProps {
  session: CoworkSession | null;
  messages: CoworkMessage[];
  todos: CoworkTodoItem[];
  isStreaming: boolean;
  settings: import("@/types/cowork").CoworkSettings | null;
  onToggleSidebar: () => void;
}

type CentreTab = "chat" | "tasks";

export function CoworkCentrePanel({
  session,
  messages,
  todos,
  isStreaming,
  settings,
  onToggleSidebar,
}: CoworkCentrePanelProps) {
  const [activeTab, setActiveTab] = useState<CentreTab>("chat");
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { state, dispatch } = useCowork();
  const actions = useCoworkActions();

  // Smart auto-scroll - only scroll if user is near bottom
  useEffect(() => {
    if (activeTab === "chat" && messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages, activeTab]);

  // Poll sub-agent status - only once per session
  useEffect(() => {
    if (!session) {
      // Clean up polling when session is cleared
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // If already polling for this session, don't start again
    if (pollingIntervalRef.current) return;

    let pollCount = 0;
    const maxEmptyPolls = 5; // Stop after 5 empty checks (10 seconds)

    const checkAgents = async () => {
      try {
        const res = await fetch(`/api/cowork/sessions/${session.id}/agents`);
        if (res.ok) {
          const data = await res.json();
          const agents = data.agents || [];
          
          if (agents.length > 0) {
            pollCount = 0; // Reset when agents found
            
            // Update each agent in state
            agents.forEach((agent: SubAgent) => {
              dispatch({
                type: "UPDATE_SUB_AGENT",
                payload: agent,
              });
            });

            // Check if still running
            const stillRunning = agents.some((a: SubAgent) => a.status === "running");
            return stillRunning;
          } else {
            pollCount++;
            return pollCount < maxEmptyPolls;
          }
        }
        return false;
      } catch (error) {
        // Silently handle errors (rate limits, etc)
        return true; // Keep trying
      }
    };

    // Immediate check
    checkAgents();

    // Poll every 3 seconds (slower to avoid rate limits)
    pollingIntervalRef.current = setInterval(async () => {
      const shouldContinue = await checkAgents();
      if (!shouldContinue && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [session?.id, dispatch]); // Only re-run when session ID changes

  // Inject sub-agent status block when agents are found
  useEffect(() => {
    if (!session) return;
    
    const activeAgents = state.subAgents?.active || [];
    if (activeAgents.length === 0) return;
    
    const currentMessages = state.chat.messages;
    const lastMessage = currentMessages[currentMessages.length - 1];
    
    if (lastMessage && lastMessage.role === "assistant") {
      const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
      const hasStatusBlock = content.some((b: MessageContent) => b.type === "sub_agent_status");
      
      if (!hasStatusBlock) {
        // Add status block to message
        const statusBlock: MessageContent = {
          type: "sub_agent_status",
          agents: activeAgents.map((a: SubAgent) => ({
            id: a.id,
            description: a.description,
            status: a.status,
            turns: a.turns,
            maxTurns: a.maxTurns,
          })),
        };
        
        dispatch({
          type: "UPDATE_LAST_MESSAGE",
          payload: {
            content: [...content, statusBlock],
          },
        });
      }
    }
  }, [session?.id, state.subAgents?.active, state.chat.messages, dispatch]);

  const completedTodos = todos.filter((t) => t.status === "completed").length;
  const totalTodos = todos.length;
  const progressPct = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

  const handleSendMessage = useCallback(
    async (text: string, provider?: string, model?: string) => {
      if (!session) return;

      // Optimistic user message
      const userMsg: CoworkMessage = {
        id: `temp-${Date.now()}`,
        sessionId: session.id,
        role: "user",
        content: [{ type: "text", text }] as MessageContent[],
        createdAt: new Date().toISOString(),
      };
      actions.addMessage(userMsg);
      actions.setStreaming(true);

      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        const response = await fetch(`/api/cowork/sessions/${session.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
          body: JSON.stringify({ content: text, provider, model }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to send message");
        }

        // Stream response — handle all SSE event types from agent loop
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        // Track all content blocks for the current assistant message
        let contentBlocks: MessageContent[] = [];
        // Track sub-agents locally for this stream
        const activeSubAgents = new Map<string, SubAgent>();

        const rebuildContent = (): MessageContent[] => {
          const blocks: MessageContent[] = [];
          if (assistantText) {
            blocks.push({ type: "text", text: assistantText });
          }
          blocks.push(...contentBlocks);
          return blocks.length > 0 ? blocks : [{ type: "text", text: "" }] as MessageContent[];
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;

            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "message_start": {
                  // Reset state for new assistant message
                  assistantText = "";
                  contentBlocks = [];
                  const assistantMsg: CoworkMessage = {
                    id: data.messageId || `assistant-${Date.now()}`,
                    sessionId: session.id,
                    role: "assistant",
                    content: [{ type: "text", text: "" }] as MessageContent[],
                    createdAt: new Date().toISOString(),
                  };
                  actions.addMessage(assistantMsg);
                  break;
                }

                case "content_delta": {
                  assistantText += data.text || "";
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "tool_use_start": {
                  const toolBlock: MessageContent = {
                    type: "tool_use",
                    id: data.id || data.data?.id || `tool-${Date.now()}`,
                    name: data.name || data.data?.name || "unknown",
                    input: data.input || data.data?.input || {},
                  };
                  contentBlocks.push(toolBlock);
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "tool_result": {
                  const resultBlock: MessageContent = {
                    type: "tool_result",
                    tool_use_id: data.tool_use_id || data.data?.tool_use_id || "",
                    content: data.content || data.data?.content || "",
                    is_error: data.is_error || data.data?.is_error || false,
                  };
                  contentBlocks.push(resultBlock);
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "todo_update": {
                  const todos = data.items || data.todos || data.data?.todos;
                  if (todos) {
                    actions.setTodos(todos);
                  }
                  break;
                }

                case "artifact_created": {
                  const artifact = data.data || data;
                  const fileRecord: CoworkFileRecord = {
                    id: artifact.id || `artifact-${Date.now()}`,
                    sessionId: session.id,
                    fileName: artifact.fileName,
                    mimeType: artifact.mimeType || "application/octet-stream",
                    sizeBytes: artifact.sizeBytes || 0,
                    category: "output",
                    storagePath: artifact.storagePath || "",
                    downloadUrl: artifact.downloadUrl || "",
                    createdAt: artifact.createdAt || new Date().toISOString(),
                    metadata: artifact.metadata,
                  };

                  // Add to outputs list
                  actions.addFile(fileRecord);

                  // Add artifact chip to message
                  const artifactBlock: MessageContent = {
                    type: "artifact",
                    artifactId: fileRecord.id,
                    fileName: fileRecord.fileName,
                    renderType: fileRecord.metadata?.artifactType || "other",
                  };
                  contentBlocks.push(artifactBlock);
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "permission_request": {
                  const perm = data.data || data;
                  const permBlock: MessageContent = {
                    type: "permission_request",
                    requestId: perm.requestId || perm.id,
                    action: perm.action || perm.toolName || "Tool action",
                    details: perm.details || perm.input || {},
                  };
                  contentBlocks.push(permBlock);
                  actions.updateLastMessage({ content: rebuildContent() });

                  // Store pending permission for interactive resolution
                  dispatch({
                    type: "SET_PENDING_PERMISSION",
                    payload: {
                      requestId: perm.requestId || perm.id,
                      action: perm.action || perm.toolName || "Tool action",
                      details: perm.details || perm.input || {},
                    },
                  });
                  break;
                }

                case "plan_proposed": {
                  const plan = data.data || data;
                  const planBlock: MessageContent = {
                    type: "plan",
                    planId: plan.planId,
                    steps: (plan.steps || []).map((s: { id?: string; description: string; status?: string }, i: number) => ({
                      id: s.id || `step-${i}`,
                      description: s.description,
                      status: s.status || "pending",
                    })),
                    status: "pending",
                  };
                  contentBlocks.push(planBlock);
                  actions.updateLastMessage({ content: rebuildContent() });

                  // Store pending plan for interactive resolution
                  dispatch({
                    type: "SET_PENDING_PLAN",
                    payload: {
                      planId: plan.planId,
                      steps: planBlock.steps,
                    },
                  });
                  break;
                }

                case "ask_question": {
                  const question = data.data || data;
                  const questionBlock: MessageContent = {
                    type: "ask_user",
                    questionId: question.id || question.questionId,
                    questions: [{
                      id: question.id || question.questionId,
                      prompt: question.prompt,
                      options: (question.options || []).map((opt: { id: string; label: string }) => ({
                        id: opt.id,
                        label: opt.label,
                      })),
                      allowMultiple: question.allowMultiple || false,
                    }],
                  };
                  contentBlocks.push(questionBlock);
                  actions.updateLastMessage({ content: rebuildContent() });

                  // Store pending question for interactive resolution
                  dispatch({
                    type: "SET_PENDING_QUESTION",
                    payload: {
                      id: question.id || question.questionId,
                      prompt: question.prompt,
                      options: (question.options || []).map((opt: { id: string; label: string }) => ({
                        id: opt.id,
                        label: opt.label,
                      })),
                      allowMultiple: question.allowMultiple || false,
                    },
                  });
                  break;
                }

                case "sub_agent_update": {
                  const agentUpdate = data.data || data;
                  
                  // Create/update sub-agent object
                  const subAgent: SubAgent = {
                    id: agentUpdate.id,
                    parentSessionId: session.id,
                    description: agentUpdate.description || "",
                    type: (agentUpdate.type || "general-purpose") as "bash" | "general-purpose" | "explore" | "plan",
                    status: (agentUpdate.status || "running") as "running" | "completed" | "failed" | "cancelled",
                    prompt: agentUpdate.prompt || "",
                    result: agentUpdate.result,
                    model: agentUpdate.model,
                    createdAt: agentUpdate.createdAt || new Date().toISOString(),
                    completedAt: agentUpdate.completedAt,
                    turns: agentUpdate.turns || 0,
                    maxTurns: agentUpdate.maxTurns || 10,
                  };
                  
                  // Update local tracking
                  activeSubAgents.set(subAgent.id, subAgent);
                  
                  // Update global state
                  actions.updateSubAgent(subAgent);

                  // Find or create sub_agent_status block in message
                  const statusBlockIndex = contentBlocks.findIndex((b) => b.type === "sub_agent_status");
                  const statusBlock: MessageContent = {
                    type: "sub_agent_status",
                    agents: Array.from(activeSubAgents.values()).map((a) => ({
                      id: a.id,
                      description: a.description,
                      status: a.status,
                      turns: a.turns,
                      maxTurns: a.maxTurns,
                    })),
                  };
                  
                  if (statusBlockIndex >= 0) {
                    // Update existing block
                    contentBlocks[statusBlockIndex] = statusBlock;
                  } else {
                    // Add new block
                    contentBlocks.push(statusBlock);
                  }
                  
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "error": {
                  const errData = data.data || data;
                  const errBlock: MessageContent = {
                    type: "error",
                    code: errData.code || "error",
                    message: errData.message || "An error occurred",
                  };
                  contentBlocks.push(errBlock);
                  actions.updateLastMessage({ content: rebuildContent() });
                  break;
                }

                case "message_end": {
                  // Streaming is complete
                  break;
                }

                default:
                  break;
              }
            } catch {
              // skip malformed SSE events
            }
          }
        }
      } catch (err) {
        console.error("Send error:", err);
        const errorMsg: CoworkMessage = {
          id: `error-${Date.now()}`,
          sessionId: session.id,
          role: "assistant",
          content: [{ type: "error", code: "send_error", message: "Failed to get response. Please try again." }] as MessageContent[],
          createdAt: new Date().toISOString(),
        };
        actions.addMessage(errorMsg);
      } finally {
        actions.setStreaming(false);
      }
    },
    [session, actions, dispatch]
  );

  const handleStop = useCallback(() => {
    actions.setStreaming(false);
  }, [actions]);

  // No session - show empty state
  if (!session) {
    return (
      <div className="cowork-centre">
        <div className="cowork-empty-state">
          <div className="cowork-empty-state__icon">
            <IconRocket size={28} />
          </div>
          <div className="cowork-empty-state__title">What would you like to do?</div>
          <div className="cowork-empty-state__description">
            Start a new task and your AI agent will help you plan, execute, and deliver results.
          </div>
          <div className="cowork-empty-state__suggestions">
            <button className="cowork-empty-state__suggestion">
              Organise my project files
            </button>
            <button className="cowork-empty-state__suggestion">
              Research and summarise a topic
            </button>
            <button className="cowork-empty-state__suggestion">
              Process data from a spreadsheet
            </button>
            <button className="cowork-empty-state__suggestion">
              Draft a document for review
            </button>
          </div>
        </div>
        <CoworkInputArea
          isStreaming={false}
          disabled
          onSend={() => {}}
          onStop={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="cowork-centre">
      {/* Header with tabs */}
      <div className="cowork-centre__header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
          <button
            className="cowork-input__btn"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            style={{ display: "none" }}
          >
            <IconMenu size={18} />
          </button>
          <div className="cowork-centre__tabs">
            <button
              className={`cowork-centre__tab ${activeTab === "chat" ? "cowork-centre__tab--active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <IconMessageSquare size={14} />
              Chat
              {messages.length > 0 && (
                <span className="cowork-centre__tab-badge">{messages.length}</span>
              )}
            </button>
            <button
              className={`cowork-centre__tab ${activeTab === "tasks" ? "cowork-centre__tab--active" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              <IconList size={14} />
              Tasks
              {totalTodos > 0 && (
                <span className="cowork-centre__tab-badge">
                  {completedTodos}/{totalTodos}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="cowork-centre__actions">
          <button
            className="cowork-input__btn"
            onClick={actions.toggleRightPanel}
            aria-label="Toggle side panel"
            title="Toggle artifacts panel"
          >
            <IconPanelRight size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {totalTodos > 0 && (
        <div className="cowork-progress-bar">
          <div className="cowork-progress-bar__fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Content */}
      {activeTab === "chat" ? (
        <>
          <div className="cowork-messages">
            {messages.length === 0 ? (
              <EmptyStateWidget onOpenCapabilities={() => setCapabilitiesOpen(true)} />
            ) : (
              messages.map((msg) => (
                <CoworkMessageItem key={msg.id} message={msg} />
              ))
            )}

            {isStreaming && (
              <div className="cowork-streaming">
                <div className="cowork-streaming-indicator">
                  <div className="cowork-streaming-indicator__dot" />
                  <div className="cowork-streaming-indicator__dot" />
                  <div className="cowork-streaming-indicator__dot" />
                </div>
                <span>Cowork is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <CoworkInputArea
            isStreaming={isStreaming}
            onSend={handleSendMessage}
            onStop={handleStop}
            defaultProvider={settings?.defaultProvider}
            defaultModel={settings?.defaultModel || session.model || "claude-sonnet-4-20250514"}
          />
          <CapabilitiesPanel isOpen={capabilitiesOpen} onClose={() => setCapabilitiesOpen(false)} />
        </>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {todos.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--color-text-muted)",
              gap: 8,
            }}>
              <IconList size={32} />
              <span style={{ fontSize: "0.9375rem" }}>No tasks yet</span>
              <span style={{ fontSize: "0.8125rem" }}>Tasks will appear as your agent works</span>
            </div>
          ) : (
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              <CoworkTodoWidget items={todos} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
