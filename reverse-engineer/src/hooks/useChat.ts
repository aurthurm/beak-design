import { logger, type IPCHost } from "@ha/shared";
import type { PostHog } from "posthog-js";
import { useCallback, useEffect, useState } from "react";
import type {
  AgentMode,
  AskUserQuestionOutput,
  ChatMessage,
  ConversationTab,
  FileAttachment,
  ToolUseInfo,
} from "../components/chat";
import { platform } from "../platform";

interface UseChatOptions {
  ipc: IPCHost | null;
  isReady: boolean;
  selectedIDs: string[];
  posthog: PostHog;
}

interface UseChatReturn {
  conversations: ConversationTab[];
  activeConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onCloseConversation: (conversationId: string) => void;
  onSendMessage: (params: {
    conversationId?: string;
    prompt: string;
    agentMode?: AgentMode;
    files?: FileAttachment[];
  }) => void;
  onStopConversation: (conversationId: string) => void;
  onChangeAgentMode: (conversationId: string, mode: AgentMode) => void;
  onQuestionResponse: (
    conversationId: string,
    toolUseId: string,
    output: AskUserQuestionOutput,
  ) => void;
}

export function useChat({
  ipc,
  isReady,
  selectedIDs,
  posthog,
}: UseChatOptions): UseChatReturn {
  const createNewConversation = useCallback((): ConversationTab => {
    const STORAGE_KEY = "pencil-agent-mode";
    const defaultMode: AgentMode = platform.isElectron
      ? "opus"
      : "send_to_cursor";

    let agentMode: AgentMode = defaultMode;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      ["haiku", "sonnet", "opus", "send_to_cursor"].includes(saved)
    ) {
      agentMode = saved as AgentMode;
    }

    return {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: "New Chat",
      agentMode,
      messages: [],
      isRunning: false,
      lastUpdatedAt: Date.now(),
    };
  }, []);

  const [conversations, setConversations] = useState<ConversationTab[]>(() => [
    createNewConversation(),
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => conversations[0]?.id ?? "",
  );

  // Ensure activeConversationId is always valid
  useEffect(() => {
    if (
      conversations.length > 0 &&
      !conversations.find((c) => c.id === activeConversationId)
    ) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const onCreateConversation = useCallback(() => {
    const newConv = createNewConversation();
    setConversations((prev) => [...prev, newConv]);
    setActiveConversationId(newConv.id);
  }, [createNewConversation]);

  const onCloseConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== conversationId);
        // Always keep at least one conversation
        if (filtered.length === 0) {
          const newConv = createNewConversation();
          return [newConv];
        }
        return filtered;
      });
    },
    [createNewConversation],
  );

  const onSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const onChangeAgentMode = useCallback(
    (conversationId: string, mode: AgentMode) => {
      try {
        localStorage.setItem("pencil-agent-mode", mode);
      } catch {}

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, agentMode: mode } : c,
        ),
      );
    },
    [],
  );

  const onSendMessage = useCallback(
    async ({
      prompt,
      conversationId,
      agentMode,
      files,
    }: {
      prompt: string;
      conversationId?: string;
      agentMode?: AgentMode;
      files?: FileAttachment[];
    }) => {
      let conversation = conversations.find((c) => c.id === conversationId);

      if (!conversationId) {
        const activeConversation = conversations.find(
          (c) => c.id === activeConversationId,
        );

        if (activeConversation?.messages.length === 0) {
          conversation = activeConversation;
          conversationId = activeConversationId;
          if (agentMode) {
            conversation.agentMode = agentMode;
            onChangeAgentMode(conversationId, agentMode);
          }
        } else {
          conversation = createNewConversation();
          if (agentMode) {
            conversation.agentMode = agentMode;
          }
          setConversations((prev) => [...prev, conversation!]);
          setActiveConversationId(conversation.id);
          conversationId = conversation.id;
        }
      }

      if (!conversation) return;

      // If the conversation is running, stop it first before sending the new message
      if (conversation.isRunning && isReady && ipc) {
        await ipc.request("agent-stop", { conversationId });
      }

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "user",
        text: prompt,
        createdAt: Date.now(),
        status: "final",
        files,
      };

      // Add user message immediately (finalize any streaming messages first)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          // Finalize any streaming messages before adding the new user message
          const finalizedMessages = c.messages.map((m) =>
            m.status === "streaming" ? { ...m, status: "final" as const } : m,
          );
          return {
            ...c,
            messages: [...finalizedMessages, userMessage],
            isRunning: true,
            lastUpdatedAt: Date.now(),
            // Update title from first message if still default
            title:
              c.messages.length === 0
                ? prompt.slice(0, 30) + (prompt.length > 30 ? "..." : "")
                : c.title,
          };
        }),
      );

      // Create a placeholder assistant message for streaming
      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: assistantMessageId,
                    role: "assistant" as const,
                    text: "",
                    createdAt: Date.now(),
                    status: "streaming" as const,
                  },
                ],
              }
            : c,
        ),
      );

      // Send to IPC
      if (isReady && ipc) {
        posthog.capture("handlePromptSubmit");
        ipc.notify("send-prompt", {
          prompt,
          agentMode: conversation.agentMode,
          conversationId,
          sessionId: conversation.sessionId,
          selectedIDs,
          files,
        });
      }
    },
    [
      conversations,
      isReady,
      ipc,
      posthog,
      selectedIDs,
      createNewConversation,
      activeConversationId,
      onChangeAgentMode,
    ],
  );

  const onStopConversation = useCallback(
    async (conversationId: string) => {
      if (isReady && ipc) {
        await ipc.request("agent-stop", { conversationId });
      }

      // Mark as not running locally and cancel in-progress todos
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            isRunning: false,
            messages: c.messages.map((m) => {
              // Mark streaming messages as final
              if (m.status === "streaming") {
                return { ...m, status: "final" as const };
              }
              // Cancel in-progress todos
              if (
                m.role === "tool" &&
                m.toolUse &&
                (m.toolUse.name.toLowerCase().includes("todo_write") ||
                  m.toolUse.name.toLowerCase().includes("todowrite")) &&
                m.toolUse.input?.todos
              ) {
                return {
                  ...m,
                  toolUse: {
                    ...m.toolUse,
                    input: {
                      ...m.toolUse.input,
                      todos: m.toolUse.input.todos.map(
                        (todo: { status: string; [key: string]: any }) =>
                          todo.status === "in_progress"
                            ? { ...todo, status: "cancelled" }
                            : todo,
                      ),
                    },
                  },
                };
              }
              return m;
            }),
          };
        }),
      );
    },
    [isReady, ipc],
  );

  const onQuestionResponse = useCallback(
    (
      conversationId: string,
      toolUseId: string,
      output: AskUserQuestionOutput,
    ) => {
      logger.info(
        `[useChat] onQuestionResponse: toolUseId=${toolUseId} for ${conversationId}`,
      );

      // Format the user's answers as a readable response
      const answerEntries = Object.entries(output.answers);
      let answerText: string;

      if (answerEntries.length === 1) {
        answerText = answerEntries[0][1];
      } else {
        answerText = answerEntries
          .map(([question, answer]) => `${question}: ${answer}`)
          .join("\n");
      }

      // Send the answer as a new message to continue the conversation
      // The agent was stopped when the question was asked, so this will resume it
      if (answerText) {
        onSendMessage({ prompt: answerText, conversationId });
      }
    },
    [onSendMessage],
  );

  // Subscribe to chat IPC events
  useEffect(() => {
    logger.info(
      "[useChat] Chat useEffect running, ipc:",
      !!ipc,
      "isReady:",
      isReady,
    );
    if (!ipc || !isReady) return;

    logger.info("[useChat] Registering chat event handlers");

    // Handle session ID assignment
    const handleChatSession = ({
      conversationId,
      sessionId,
    }: {
      conversationId: string;
      sessionId: string;
    }) => {
      logger.info(
        `[useChat] handleChatSession: ${sessionId} for ${conversationId}`,
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, sessionId } : c)),
      );
    };

    // Handle streaming assistant text
    const handleAssistantDelta = ({
      conversationId,
      textDelta,
    }: {
      conversationId: string;
      textDelta: string;
    }) => {
      logger.info(
        `[useChat] handleAssistantDelta: "${textDelta.slice(0, 30)}..." for ${conversationId}`,
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages];
          const lastMsg = messages[messages.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "assistant" &&
            lastMsg.status === "streaming"
          ) {
            messages[messages.length - 1] = {
              ...lastMsg,
              text: lastMsg.text + textDelta,
            };
          }
          return { ...c, messages };
        }),
      );
    };

    // Handle final assistant message
    const handleAssistantFinal = ({
      conversationId,
      fullText,
      agentError,
    }: {
      conversationId: string;
      fullText: string;
      agentError?: string;
    }) => {
      logger.info(
        `[useChat] handleAssistantFinal: "${fullText.slice(0, 50)}..." for ${conversationId}`,
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages];
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            messages[messages.length - 1] = {
              ...lastMsg,
              text: fullText,
              agentError,
              status: "final",
            };
          }
          return { ...c, messages, isRunning: false };
        }),
      );
    };

    // Handle errors
    const handleChatError = ({
      conversationId,
      message,
      error,
    }: {
      conversationId: string;
      message: string;
      error?: string;
    }) => {
      logger.info(
        `[useChat] handleChatError: ${message} for ${conversationId}`,
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages];
          const lastMsg = messages[messages.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "assistant" &&
            lastMsg.status === "streaming"
          ) {
            messages[messages.length - 1] = {
              ...lastMsg,
              // Preserve existing content if present, otherwise show the error
              text: lastMsg.text.trim() || `Error: ${message}`,
              status: "final",
              agentError: error,
            };
          }
          return { ...c, messages, isRunning: false };
        }),
      );
    };

    const handleToolUse = async ({
      conversationId,
      toolName,
      toolInput,
      toolUseId,
    }: {
      conversationId: string;
      toolName: string;
      toolInput: any;
      toolUseId?: string;
    }) => {
      logger.info(`[useChat] handleToolUse: ${toolName} for ${conversationId}`);

      // Check if this is an ask_user_question tool - stop the agent to wait for user answer
      const normalizedName = toolName.split("__").pop()?.toLowerCase() ?? "";
      const isAskQuestion =
        normalizedName === "askuserquestion" ||
        normalizedName === "ask_user_question";

      if (isAskQuestion && isReady && ipc) {
        logger.info(
          `[useChat] Stopping agent for ask_user_question: ${conversationId}`,
        );
        await ipc.request("agent-stop", { conversationId });
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          // Mark any previous streaming message as final before adding tool message
          const messages = c.messages
            .map((m) =>
              m.status === "streaming" ? { ...m, status: "final" as const } : m,
            )
            .filter((m) => m.id !== toolUseId);
          const toolMessage: ChatMessage = {
            id:
              toolUseId ||
              `tool-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "tool",
            text: "",
            createdAt: Date.now(),
            status: "final",
            toolUse: {
              name: toolName,
              input: toolInput,
              toolUseId,
            } as ToolUseInfo,
          };
          return {
            ...c,
            messages: [...messages, toolMessage],
            // If ask_user_question, mark as not running since we stopped it
            isRunning: isAskQuestion ? false : c.isRunning,
          };
        }),
      );
    };

    const handleToolUseStart = async ({
      conversationId,
      toolName,
      toolUseId,
    }: {
      conversationId: string;
      toolName: string;
      toolUseId: string;
    }) => {
      logger.info(
        `[useChat] handleToolUseStart: ${toolName} for ${conversationId}`,
      );

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          // Mark any previous streaming message as final before adding tool message
          const messages = c.messages.map((m) =>
            m.status === "streaming" ? { ...m, status: "final" as const } : m,
          );
          const toolStartMessage: ChatMessage = {
            id: toolUseId,
            role: "tool",
            text: "",
            createdAt: Date.now(),
            status: "streaming",
            toolUse: {
              name: toolName,
              toolUseId,
            } as ToolUseInfo,
          };
          return {
            ...c,
            messages: [...messages, toolStartMessage],
            isRunning: c.isRunning,
          };
        }),
      );
    };

    // Handle tool result (output)
    const handleToolResult = ({
      conversationId,
      toolUseId,
      toolOutput,
      isError,
    }: {
      conversationId: string;
      toolUseId: string;
      toolOutput: any;
      isError: boolean;
    }) => {
      logger.info(
        `[useChat] handleToolResult: ${toolUseId} for ${conversationId}`,
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;

          let matchFound = false;
          // Find the tool message with matching toolUseId and add output
          const messages = c.messages.map((m) => {
            if (
              m.role === "tool" &&
              m.toolUse &&
              (m.toolUse.toolUseId === toolUseId || m.id === toolUseId)
            ) {
              matchFound = true;
              return {
                ...m,
                toolUse: {
                  ...m.toolUse,
                  output: toolOutput,
                  isError,
                },
              };
            }
            return m;
          });

          // Fallback: if no match found, update the last tool message without output
          if (!matchFound) {
            for (let i = messages.length - 1; i >= 0; i--) {
              const m = messages[i];
              if (m.role === "tool" && m.toolUse && !m.toolUse.output) {
                messages[i] = {
                  ...m,
                  toolUse: {
                    ...m.toolUse,
                    output: toolOutput,
                    isError,
                  },
                };
                break;
              }
            }
          }

          return { ...c, messages };
        }),
      );
    };

    // Handle question answered confirmation
    const handleQuestionAnswered = ({
      conversationId,
      userResponse,
      toolUseId,
    }: {
      conversationId: string;
      userResponse: string;
      toolUseId: string;
    }) => {
      logger.info(
        `[useChat] handleQuestionAnswered: toolUseId=${toolUseId} for ${conversationId}`,
      );
      // Add the user's response as a message in the conversation
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const responseMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "user",
            text: userResponse,
            createdAt: Date.now(),
            status: "final",
          };
          return { ...c, messages: [...c.messages, responseMessage] };
        }),
      );
    };

    // Handle full agent message content
    const handleAgentMessage = ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: Array<{
        type: string;
        text?: string;
        name?: string;
        input?: any;
      }>;
    }) => {
      // Extract text from content array
      const fullText = content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("");

      logger.info(
        `[useChat] handleAgentMessage: ${content.length} content items, text="${fullText.slice(0, 100)}..." for ${conversationId}`,
      );

      if (!fullText) {
        logger.info("[useChat] handleAgentMessage: no text content, skipping");
        return;
      }

      // Update or create assistant message with full content
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages];
          const lastMsg = messages[messages.length - 1];

          // If the last message is a streaming assistant message, update it
          if (lastMsg?.role === "assistant" && lastMsg.status === "streaming") {
            logger.info(
              `[useChat] handleAgentMessage: updating streaming assistant message`,
            );
            messages[messages.length - 1] = { ...lastMsg, text: fullText };
          }
          // If the last message is a tool or the assistant message is final, create a new assistant message
          else if (
            lastMsg?.role === "tool" ||
            (lastMsg?.role === "assistant" && lastMsg.status === "final")
          ) {
            logger.info(
              `[useChat] handleAgentMessage: creating new assistant message after ${lastMsg.role}`,
            );
            const newAssistantMessage: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              role: "assistant",
              text: fullText,
              createdAt: Date.now(),
              status: "streaming",
            };
            messages.push(newAssistantMessage);
          }
          // Otherwise just update the last assistant message if found
          else {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === "assistant") {
                logger.info(
                  `[useChat] handleAgentMessage: updating assistant message at index ${i}`,
                );
                messages[i] = { ...messages[i], text: fullText };
                break;
              }
            }
          }

          return { ...c, messages };
        });
        return updated;
      });
    };

    ipc.on("chat-session", handleChatSession);
    ipc.on("chat-assistant-delta", handleAssistantDelta);
    ipc.on("chat-assistant-final", handleAssistantFinal);
    ipc.on("chat-error", handleChatError);
    ipc.on("chat-tool-use", handleToolUse);
    ipc.on("chat-tool-use-start", handleToolUseStart);
    ipc.on("chat-tool-result", handleToolResult);
    ipc.on("chat-question-answered", handleQuestionAnswered);
    ipc.on("chat-agent-message", handleAgentMessage);
    logger.info("[useChat] Chat event handlers registered");

    return () => {
      ipc.off("chat-session", handleChatSession);
      ipc.off("chat-assistant-delta", handleAssistantDelta);
      ipc.off("chat-assistant-final", handleAssistantFinal);
      ipc.off("chat-error", handleChatError);
      ipc.off("chat-tool-use", handleToolUse);
      ipc.off("chat-tool-use-start", handleToolUseStart);
      ipc.off("chat-tool-result", handleToolResult);
      ipc.off("chat-question-answered", handleQuestionAnswered);
      ipc.off("chat-agent-message", handleAgentMessage);
    };
  }, [ipc, isReady]);

  return {
    conversations,
    activeConversationId,
    onSelectConversation,
    onCreateConversation,
    onCloseConversation,
    onSendMessage,
    onStopConversation,
    onChangeAgentMode,
    onQuestionResponse,
  };
}
