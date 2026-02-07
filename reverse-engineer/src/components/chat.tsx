import type { ClaudeConnectionStatus } from "@ha/shared";
import {
  ArrowUp,
  Ban,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Circle,
  File,
  HelpCircle,
  Loader,
  Loader2,
  Palette,
  Paperclip,
  Plus,
  PencilLine,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/tabs";
import { cn } from "@/src/lib/utils";
import { useDraggablePanel, type Corner } from "@/src/hooks/useDraggablePanel";
import { globalEventEmitter } from "@/src/lib/global-event-emitter";
import { useIPC } from "../contexts/ipc-context";
import { platform } from "../platform";
import { TemplatePicker } from "./template-picker";

const DEFAULT_PANEL_WIDTH = 300;
const MIN_PANEL_WIDTH = 250;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_MESSAGES_HEIGHT = 250;
const MIN_MESSAGES_HEIGHT = 150;
const MIN_MESSAGES_HEIGHT_NO_MESSAGE = 0;
const MAX_AUTO_GROW_HEIGHT = 700;
const MAX_MANUAL_RESIZE_HEIGHT = 1200;
const TOOLBAR_WIDTH = 40;
const EDGE_OFFSET = 8;

const EXAMPLE_PROMPTS = [
  "Technical dashboard for a utilities company",
  "Terminal-style dashboard for a sports team",
  "Dark bold website for a coffee shop in Prague",
  "Luxury app for managing barbershop clients",
];

export type AgentMode = "send_to_cursor" | "haiku" | "sonnet" | "opus";

interface Base64ImageSource {
  data: string;
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  type: "base64";
}

export type FileAttachment =
  | {
      type: "image";
      name: string;
      source: Base64ImageSource;
    }
  | {
      type: "text";
      name: string;
      content: string;
    };

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".pen",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".json",
  ".yaml",
  ".yml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".csv",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".java",
  ".kt",
  ".swift",
  ".rb",
  ".php",
  ".vue",
  ".svelte",
  ".xml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
];

const ACCEPTED_FILE_EXTENSIONS = [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS].join(
  ",",
);

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

async function encodeImageToBase64(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
): Promise<Base64ImageSource> {
  const mediaTypeMap: Record<string, Base64ImageSource["media_type"]> = {
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
  };
  const media_type = mediaTypeMap[file.type];

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(file.type);
        const data = dataUrl.split(",")[1];

        resolve({ data, media_type, type: "base64" });
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export interface ToolUseInfo {
  name: string;
  input: any;
  output?: any;
  toolUseId?: string;
  isError?: boolean;
}

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

interface TodoWriteInput {
  todos: TodoItem[];
  merge?: boolean;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

interface Question {
  id: string;
  prompt: string;
  header?: string;
  options?: QuestionOption[];
  allow_multiple?: boolean;
}

interface AskUserQuestionInput {
  questions?: Question[];
  question?: string;
  title?: string;
  toolUseId?: string;
}

export interface AskUserQuestionOutput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect: boolean;
  }>;
  answers: Record<string, string>;
}

interface TaskInput {
  description: string;
  prompt?: string;
  tools?: string[];
  model?: "sonnet" | "opus" | "haiku" | "inherit";
}

type ToolKind = "todo_write" | "ask_question" | "task" | "generic";

interface ResolvedToolUse {
  kind: ToolKind;
  input: TodoWriteInput | AskUserQuestionInput | TaskInput | unknown;
}

function isTodoWriteInput(input: unknown): input is TodoWriteInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "todos" in input &&
    Array.isArray((input as TodoWriteInput).todos)
  );
}

function isAskUserQuestionInput(input: unknown): input is AskUserQuestionInput {
  return (
    typeof input === "object" &&
    input !== null &&
    ("questions" in input || "question" in input || "title" in input)
  );
}

function isTaskInput(input: unknown): input is TaskInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "description" in input &&
    typeof (input as TaskInput).description === "string"
  );
}

function resolveToolUse(toolUse: ToolUseInfo): ResolvedToolUse {
  const name = parseToolName(toolUse.name).toLowerCase();

  if (
    (name === "todowrite" || name === "todo_write") &&
    isTodoWriteInput(toolUse.input)
  ) {
    return { kind: "todo_write", input: toolUse.input };
  }

  if (
    (name === "askuserquestion" || name === "ask_user_question") &&
    isAskUserQuestionInput(toolUse.input)
  ) {
    return { kind: "ask_question", input: toolUse.input };
  }

  if (name === "task" && isTaskInput(toolUse.input)) {
    return { kind: "task", input: toolUse.input };
  }

  return { kind: "generic", input: toolUse.input };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: number;
  status?: "streaming" | "final";
  toolUse?: ToolUseInfo;
  files?: FileAttachment[];
  agentError?: string;
}

export interface ConversationTab {
  id: string;
  title: string;
  agentMode: AgentMode;
  sessionId?: string;
  messages: ChatMessage[];
  isRunning: boolean;
  lastUpdatedAt: number;
}

export interface ChatProps {
  selectedIDs: string[];

  conversations: ConversationTab[];
  activeConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onCloseConversation: (conversationId: string) => void;
  onSendMessage: (params: {
    prompt: string;
    conversationId?: string;
    agentMode?: AgentMode;
    files?: FileAttachment[];
  }) => void;
  onStopConversation: (conversationId: string) => void;
  onChangeAgentMode: (conversationId: string, mode: AgentMode) => void;
  onQuestionResponse?: (
    conversationId: string,
    toolUseId: string,
    output: AskUserQuestionOutput,
  ) => void;

  propertiesPanelWidth?: number;
  layersListPanelWidth?: number;
  claudeCodeStatus?: ClaudeConnectionStatus;
}

function parseToolName(fullName: string): string {
  const parts = fullName.split("__");
  return parts[parts.length - 1];
}

const PENCIL_TOOL_DISPLAY_NAMES: Record<string, string> = {
  batch_design: "Design",
  batch_design_streaming: "Designing…",
  get_screenshot: "Took screenshot",
  batch_get: "Reading objects",
  get_editor_state: "Getting editor state",
  open_document: "Opening document",
  get_guidelines: "Checking guidelines",
  get_style_guide_tags: "Available styles",
  get_style_guide: "Picked a styleguide",
  snapshot_layout: "Checking the layout",
  get_variables: "Reading variables",
  set_variables: "Setting variables",
  find_empty_space_around_node: "Looking for space",
  search_all_unique_properties: "Searching properties",
  replace_all_matching_properties: "Replacing properties",
};

function getToolDisplayName(fullName: string, isStreaming?: boolean): string {
  const toolName = parseToolName(fullName);
  const toolNameWithStreaming = isStreaming
    ? `${toolName}_streaming`
    : toolName;
  return PENCIL_TOOL_DISPLAY_NAMES[toolNameWithStreaming] || toolName;
}

function isTodoWriteTool(toolName: string): boolean {
  const name = parseToolName(toolName).toLowerCase();
  return name === "todowrite" || name === "todo_write";
}

function formatToolInput(input: any): string {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function TodoStatusIcon({ status }: { status: TodoItem["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />;
    case "in_progress":
      return (
        <Loader2 className="w-3 h-3 text-blue-400 animate-spin flex-shrink-0" />
      );
    case "cancelled":
      return <Ban className="w-3 h-3 text-zinc-500 flex-shrink-0" />;
    case "pending":
    default:
      return <Circle className="w-3 h-3 text-zinc-500 flex-shrink-0" />;
  }
}

function TodoWriteDisplay({ input }: { input: TodoWriteInput }) {
  const completedCount = input.todos.filter(
    (t) => t.status === "completed",
  ).length;
  const totalCount = input.todos.length;

  return (
    <div className="flex w-full justify-start">
      <div className="w-full rounded-md px-2 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <PencilLine className="w-3 h-3 text-foreground/50" />
          <span className="text-foreground/70 font-medium text-xxs">Tasks</span>
          <span className="text-foreground/40 text-xxs ml-auto">
            {completedCount}/{totalCount}
          </span>
          {input.merge && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/50 text-foreground/50">
              merge
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {input.todos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                "flex items-start gap-1.5 text-[10px]",
                todo.status === "cancelled" && "line-through opacity-50",
              )}
            >
              <TodoStatusIcon status={todo.status} />
              <span
                className={cn(
                  "text-foreground/80 leading-tight",
                  todo.status === "completed" && "text-foreground/60",
                )}
              >
                {todo.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AskUserQuestionDisplay({
  input,
  onSubmit,
  isSubmitted,
}: {
  input: AskUserQuestionInput;
  onSubmit?: (output: AskUserQuestionOutput) => void;
  isSubmitted?: boolean;
}) {
  const questions =
    input.questions ||
    (input.question ? [{ id: "1", prompt: input.question }] : []);

  const [selections, setSelections] = useState<Record<string, Set<string>>>({});

  const handleOptionClick = (
    questionId: string,
    optionId: string,
    allowMultiple: boolean,
  ) => {
    if (isSubmitted) return;

    setSelections((prev) => {
      const current = prev[questionId] || new Set<string>();
      const updated = new Set(current);

      if (allowMultiple) {
        if (updated.has(optionId)) {
          updated.delete(optionId);
        } else {
          updated.add(optionId);
        }
      } else {
        updated.clear();
        updated.add(optionId);
      }

      return { ...prev, [questionId]: updated };
    });
  };

  const handleSubmit = () => {
    if (!onSubmit || isSubmitted) return;

    const output: AskUserQuestionOutput = {
      questions: questions.map((q, qIdx) => ({
        question: q.prompt || q.header || input.title || `Question ${qIdx + 1}`,
        header: q.header || input.title || "",
        options: (q.options || []).map((opt) => ({
          label: opt.label,
          description: opt.description || "",
        })),
        multiSelect: q.allow_multiple || false,
      })),
      answers: {},
    };

    questions.forEach((q, qIdx) => {
      const questionKey = q.id || `q-${qIdx}`;
      const questionText =
        q.prompt || q.header || input.title || `Question ${qIdx + 1}`;
      const selected = selections[questionKey] || new Set<string>();
      if (selected.size > 0 && q.options) {
        const selectedLabels = q.options
          .filter((opt, optIdx) => {
            const optionKey = opt.id || opt.label || `opt-${optIdx}`;
            return selected.has(optionKey);
          })
          .map((opt) => opt.label);
        output.answers[questionText] = selectedLabels.join(", ");
      }
    });

    onSubmit(output);
  };

  const hasSelections = Object.values(selections).some((s) => s.size > 0);

  return (
    <div className="flex w-full justify-start">
      <div className="w-full rounded-md px-2 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <HelpCircle className="w-3 h-3 text-amber-400/70" />
          <span className="text-foreground/70 font-medium text-xxs">
            {input.title || "Question"}
          </span>
          {isSubmitted && (
            <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {questions.map((q, qIdx) => {
            const questionKey = q.id || `q-${qIdx}`;
            return (
              <div key={questionKey} className="flex flex-col gap-1">
                {q.header && (
                  <p className="text-xxs text-foreground/50 font-medium">
                    {q.header}
                  </p>
                )}
                <p className="text-xxs text-foreground/80 leading-tight">
                  {q.prompt}
                </p>
                {q.options && q.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {q.options.map((opt, optIdx) => {
                      const optionKey = opt.id || opt.label || `opt-${optIdx}`;
                      const isSelected =
                        selections[questionKey]?.has(optionKey) || false;
                      return (
                        <button
                          key={optionKey}
                          type="button"
                          onClick={() =>
                            handleOptionClick(
                              questionKey,
                              optionKey,
                              q.allow_multiple || false,
                            )
                          }
                          disabled={isSubmitted}
                          className={cn(
                            "text-xxs px-1.5 py-0.5 rounded-full border transition-colors",
                            isSubmitted
                              ? "cursor-default"
                              : "cursor-pointer hover:bg-zinc-300/60 dark:hover:bg-zinc-600/60",
                            isSelected
                              ? "bg-amber-500/30 border-amber-400/50 text-amber-700 dark:text-amber-200"
                              : "bg-zinc-200/60 dark:bg-zinc-700/60 border-zinc-300/50 dark:border-zinc-600/30 text-foreground/70",
                          )}
                          title={opt.description}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    {q.allow_multiple && !isSubmitted && (
                      <span className="text-xxs text-foreground/40 italic">
                        (multi-select)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {onSubmit && !isSubmitted && (
          <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/30">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasSelections}
              className={cn(
                "w-full text-xxs py-1 rounded transition-colors",
                hasSelections
                  ? "bg-amber-500/80 hover:bg-amber-500 text-white"
                  : "bg-zinc-200/50 dark:bg-zinc-700/50 text-foreground/40 cursor-not-allowed",
              )}
            >
              Submit Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDisplay({ input }: { input: TaskInput }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex w-full justify-start">
      <div className="w-full rounded-md px-2 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50">
        <div className="flex items-center gap-1.5 mb-1">
          <Bot className="w-3 h-3 text-violet-400/70" />
          <span className="text-foreground/70 font-medium text-xxs">
            Subagent Task
          </span>
          {input.model && input.model !== "inherit" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300/80 ml-auto">
              {input.model}
            </span>
          )}
        </div>
        <p className="text-[10px] text-foreground/80 leading-tight mb-1">
          {input.description}
        </p>
        {input.tools && input.tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {input.tools.slice(0, 5).map((tool) => (
              <span
                key={tool}
                className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/50 text-foreground/60"
              >
                {tool}
              </span>
            ))}
            {input.tools.length > 5 && (
              <span className="text-[9px] text-foreground/40">
                +{input.tools.length - 5} more
              </span>
            )}
          </div>
        )}
        {input.prompt && (
          <>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[9px] text-foreground/40 hover:text-foreground/60 mt-1.5 flex items-center gap-0.5"
            >
              <ChevronsUpDown className="w-2.5 h-2.5" />
              {isExpanded ? "Hide" : "Show"} prompt
            </button>
            {isExpanded && (
              <pre className="font-mono text-[9px] text-foreground/50 whitespace-pre-wrap break-all overflow-x-auto max-h-24 overflow-y-auto mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-700/30">
                {input.prompt}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ToolOutputContent {
  type: "text" | "image";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

function ToolOutputDisplay({
  output,
  isError,
}: {
  output: any;
  isError?: boolean;
}) {
  if (Array.isArray(output)) {
    return (
      <div className="flex flex-col gap-2">
        {output.map((item: ToolOutputContent, idx: number) => {
          if (item.type === "text" && item.text) {
            return (
              <div
                key={`text-${idx}-${item.text.slice(0, 20)}`}
                className="text-[10px] leading-relaxed"
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-1 text-foreground/70">{children}</p>
                    ),
                    code: ({ children }) => (
                      <code className="bg-zinc-200 dark:bg-zinc-700/50 px-1 py-0.5 rounded text-[9px]">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded my-1 overflow-x-auto text-[9px]">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {item.text}
                </ReactMarkdown>
              </div>
            );
          }
          if (item.type === "image" && item.source?.data) {
            const mediaType = item.source.media_type || "image/png";
            return (
              <img
                key={`img-${idx}-${item.source.data.slice(0, 20)}`}
                src={`data:${mediaType};base64,${item.source.data}`}
                alt="Tool output"
                className="max-w-full rounded border border-zinc-200 dark:border-zinc-700/50"
              />
            );
          }
          return null;
        })}
      </div>
    );
  }

  if (typeof output === "string") {
    return (
      <div className="text-[10px] leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p
                className={cn(
                  "mb-1",
                  isError ? "text-zinc-400/80" : "text-foreground/70",
                )}
              >
                {children}
              </p>
            ),
            code: ({ children }) => (
              <code className="bg-zinc-200 dark:bg-zinc-700/50 px-1 py-0.5 rounded text-[9px]">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded my-1 overflow-x-auto text-[9px]">
                {children}
              </pre>
            ),
          }}
        >
          {output}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <pre
      className={cn(
        "font-mono text-[10px] whitespace-pre-wrap break-all overflow-x-auto max-h-40 overflow-y-auto",
        isError ? "text-zinc-400/80" : "text-foreground/60",
      )}
    >
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

function GenericToolDisplay({
  toolUse,
  isStreaming,
}: {
  toolUse: ToolUseInfo;
  isStreaming?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayName = getToolDisplayName(toolUse.name, isStreaming);
  const inputStr = formatToolInput(toolUse.input);
  const hasOutput = toolUse.output !== undefined && toolUse.output !== null;

  return (
    <div className="flex w-full justify-start">
      <div
        className={cn(
          "w-full rounded-md py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900/50 border",
          toolUse.isError
            ? "border-zinc-500/50"
            : "border-zinc-200 dark:border-zinc-700/50",
        )}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 pl-2 pr-2">
            <span className="text-foreground/70 font-medium text-xxs">
              {displayName}
            </span>
            {isStreaming ? (
              <Loader className="w-2.5 h-2.5 animate-spin flex-shrink-0 mr-1" />
            ) : (
              hasOutput && (
                <CheckCircle2
                  className={cn(
                    "w-3 h-3",
                    toolUse.isError ? "text-zinc-400" : "text-green-400",
                  )}
                />
              )
            )}
          </div>
          {!isStreaming && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 mr-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-foreground/40 hover:text-foreground/70"
              aria-label={isExpanded ? "Collapse input" : "Show input"}
            >
              <ChevronsUpDown className="w-3 h-3" strokeWidth={1} />
            </button>
          )}
        </div>

        {isExpanded && hasOutput && (
          <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700/30 pl-2 pr-2 pb-1 max-h-[150px] overflow-y-auto">
            <ToolOutputDisplay
              output={toolUse.output}
              isError={toolUse.isError}
            />
          </div>
        )}
        {isExpanded && (
          <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700/30 pl-2 pr-2 pb-1">
            <span className="text-[9px] text-foreground/40 uppercase tracking-wide">
              Input
            </span>
            <pre className="font-mono text-[10px] text-foreground/60 whitespace-pre-wrap break-all overflow-x-auto max-h-40 overflow-y-auto mt-0.5">
              {inputStr}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentDisplay({ files }: { files: FileAttachment[] }) {
  const [expandedTexts, setExpandedTexts] = useState<Set<number>>(new Set());

  const toggleTextExpanded = (index: number) => {
    setExpandedTexts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="flex w-full justify-end">
      <div className="w-full max-w-[85%] rounded-md px-2 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Paperclip className="w-3 h-3 text-foreground/50" />
          <span className="text-foreground/70 font-medium text-xxs">
            {files.length === 1 ? "Attachment" : "Attachments"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`}>
              {file.type === "image" ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-foreground/50 truncate">
                    {file.name}
                  </span>
                  <img
                    src={`data:${file.source.media_type};base64,${file.source.data}`}
                    alt={file.name}
                    className="max-w-full rounded border border-zinc-200 dark:border-zinc-700/50"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => toggleTextExpanded(index)}
                    className="flex items-center gap-1 text-[9px] text-foreground/50 hover:text-foreground/70 transition-colors"
                  >
                    <File className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <ChevronsUpDown className="w-2.5 h-2.5 ml-auto flex-shrink-0" />
                  </button>
                  {expandedTexts.has(index) && (
                    <pre className="font-mono text-[9px] text-foreground/60 whitespace-pre-wrap break-all overflow-x-auto max-h-40 overflow-y-auto mt-0.5 p-1.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded">
                      {file.content}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToolRendererProps {
  input: any;
  toolUse: ToolUseInfo;
  onQuestionSubmit?: (output: AskUserQuestionOutput) => void;
  isQuestionSubmitted?: boolean;
  isStreaming?: boolean;
}

const TOOL_RENDERERS: Record<ToolKind, React.FC<ToolRendererProps>> = {
  todo_write: ({ input }) => <TodoWriteDisplay input={input} />,
  ask_question: ({ input, onQuestionSubmit, isQuestionSubmitted }) => (
    <AskUserQuestionDisplay
      input={input}
      onSubmit={onQuestionSubmit}
      isSubmitted={isQuestionSubmitted}
    />
  ),
  task: ({ input }) => <TaskDisplay input={input} />,
  generic: ({ toolUse, isStreaming }) => (
    <GenericToolDisplay toolUse={toolUse} isStreaming={isStreaming} />
  ),
};

function ToolUseBubble({
  toolUse,
  onQuestionSubmit,
  isQuestionSubmitted,
  isStreaming,
}: {
  toolUse: ToolUseInfo;
  onQuestionSubmit?: (output: AskUserQuestionOutput) => void;
  isQuestionSubmitted?: boolean;
  isStreaming?: boolean;
}) {
  const resolved = resolveToolUse(toolUse);
  const Renderer = TOOL_RENDERERS[resolved.kind];
  return (
    <Renderer
      input={resolved.input}
      toolUse={toolUse}
      onQuestionSubmit={onQuestionSubmit}
      isQuestionSubmitted={isQuestionSubmitted}
      isStreaming={isStreaming}
    />
  );
}

function MessageBubble({
  message,
  onQuestionSubmit,
  onOpenTerminal,
  isQuestionSubmitted,
}: {
  message: ChatMessage;
  onQuestionSubmit?: (toolUseId: string, output: AskUserQuestionOutput) => void;
  onOpenTerminal: () => void;
  isQuestionSubmitted?: boolean;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isStreaming = message.status === "streaming";

  if (isTool && message.toolUse) {
    if (isTodoWriteTool(message.toolUse.name)) {
      return null;
    }

    const resolved = resolveToolUse(message.toolUse);
    const isAskQuestion = resolved.kind === "ask_question";

    return (
      <ToolUseBubble
        toolUse={message.toolUse}
        onQuestionSubmit={
          isAskQuestion && onQuestionSubmit
            ? (output) => onQuestionSubmit(message.id, output)
            : undefined
        }
        isQuestionSubmitted={isAskQuestion ? isQuestionSubmitted : undefined}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div className="flex flex-col w-full gap-1.5">
      {isUser ? (
        <>
          {message.files && message.files.length > 0 && (
            <AttachmentDisplay files={message.files} />
          )}
          {message.text && (
            <div className="whitespace-pre-wrap break-words rounded-xl px-2 py-1 text-xs max-w-[85%] bg-zinc-600 text-white border border-zinc-600/50 self-end">
              {message.text}
            </div>
          )}
        </>
      ) : (
        <div className="w-full pl-1 pr-1 text-xs leading-tight">
          {message.agentError ? (
            <div
              style={{ color: "#DE7356" }}
              className="pb-2 text-xs font-bold"
            >
              Claude Code Error:
            </div>
          ) : null}
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-semibold mt-2 mb-1">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-1">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-4 mb-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-4 mb-2">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
              code: ({ children }) => (
                <code className="bg-zinc-200 dark:bg-zinc-700/50 px-1 py-0.5 rounded text-[10px]">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded my-2 overflow-x-auto">
                  {children}
                </pre>
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
          {message.agentError ? (
            <span style={{ color: "#DE7356" }}>
              Open{" "}
              <code className="bg-zinc-200 dark:bg-zinc-700/50 px-1 py-0.5 rounded text-[10px]">
                claude
              </code>{" "}
              in Terminal to resolve the issue.{" "}
              <button
                type="button"
                className="rounded-xl px-2 py-1 mt-1 text-xs transition-colors bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-300 dark:hover:bg-zinc-500 text-white dark:text-zinc-800"
                onClick={onOpenTerminal}
              >
                Open Terminal
              </button>
            </span>
          ) : null}
        </div>
      )}
      {isStreaming && (
        <div className="flex w-full h-4 mt-1 p-1 text-xxs items-center text-foreground/40">
          <Loader className="w-3 h-3 animate-spin flex-shrink-0 mr-1" />
          Thinking…
        </div>
      )}
    </div>
  );
}

export default function Chat({
  selectedIDs,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onCloseConversation,
  onSendMessage,
  onStopConversation,
  onChangeAgentMode,
  onQuestionResponse,
  propertiesPanelWidth = 0,
  layersListPanelWidth = 0,
  claudeCodeStatus,
}: ChatProps) {
  const { isReady, ipc } = useIPC();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const collapsedInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const expandedPanelRef = useRef<HTMLDivElement>(null);
  const collapsedPanelRef = useRef<HTMLDivElement>(null);

  // Track if user has used the chat before. If not, keep it expanded
  const [userHasUsedChat, setUserHasUsedChat] = useState(() => {
    try {
      return localStorage.getItem("pencil-chat-user-has-used") === "true";
    } catch {
      return false;
    }
  });

  const markChatAsUsed = useCallback(() => {
    if (!userHasUsedChat) {
      setUserHasUsedChat(true);
      try {
        localStorage.setItem("pencil-chat-user-has-used", "true");
      } catch {
        // Ignore storage errors
      }
    }
  }, [userHasUsedChat]);

  // Start expanded if user has never used the chat before
  const [isExpanded, setIsExpanded] = useState(() => !userHasUsedChat);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  const [inputHasText, setInputHasText] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(
    new Set(),
  );
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get the active panel element based on expanded/collapsed state
  const getActivePanel = useCallback((): HTMLDivElement | null => {
    return isExpanded ? expandedPanelRef.current : collapsedPanelRef.current;
  }, [isExpanded]);

  // Use the draggable panel hook for drag/corner-snap behavior
  // manageDimensions=false because chat has special scroll-anchoring resize logic
  const { corner, isDragging, positionStyle, dragHandleProps } =
    useDraggablePanel({
      defaultWidth: DEFAULT_PANEL_WIDTH,
      defaultHeight: DEFAULT_MESSAGES_HEIGHT,
      defaultCorner: "bottom-left",
      rightOffset: propertiesPanelWidth,
      leftOffset: layersListPanelWidth,
      toolbarWidth: TOOLBAR_WIDTH,
      manageDimensions: false, // Chat manages its own dimensions for scroll-anchoring
      getActivePanel, // Pass the function to get the correct panel based on state
      storageKey: "pencil-chat-corner",
    });

  // Chat manages its own dimensions for scroll-anchoring during resize
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [messagesHeight, setMessagesHeight] = useState(DEFAULT_MESSAGES_HEIGHT);
  const [hasManuallyResizedHeight, setHasManuallyResizedHeight] =
    useState(false);
  const messagesHeightRef = useRef(DEFAULT_MESSAGES_HEIGHT);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{
    type: "width" | "height" | "corner" | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startScrollTop: number;
    startCorner: Corner;
  }>({
    type: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startScrollTop: 0,
    startCorner: "bottom-left",
  });

  const getEdgeType = useCallback(
    (
      e: React.MouseEvent | MouseEvent,
    ): "width" | "height" | "corner" | null => {
      if (!expandedPanelRef.current) return null;
      const rect = expandedPanelRef.current.getBoundingClientRect();

      const isLeftCorner = corner === "bottom-left" || corner === "top-left";
      const isBottomCorner =
        corner === "bottom-left" || corner === "bottom-right";

      const nearHorizontalEdge = isLeftCorner
        ? e.clientX >= rect.right - EDGE_OFFSET
        : e.clientX <= rect.left + EDGE_OFFSET;
      const nearVerticalEdge = isBottomCorner
        ? e.clientY <= rect.top + EDGE_OFFSET
        : e.clientY >= rect.bottom - EDGE_OFFSET;

      if (nearHorizontalEdge && nearVerticalEdge) return "corner";
      if (nearHorizontalEdge) return "width";
      if (nearVerticalEdge) return "height";
      return null;
    },
    [corner],
  );

  const getCursorForType = useCallback(
    (type: "width" | "height" | "corner" | null): string => {
      if (type === "corner") {
        // nesw for top-right and bottom-left, nwse for top-left and bottom-right
        return corner === "bottom-left" || corner === "top-right"
          ? "nesw-resize"
          : "nwse-resize";
      }
      if (type === "width") return "ew-resize";
      if (type === "height") return "ns-resize";
      return "";
    },
    [corner],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (resizingRef.current.type || !expandedPanelRef.current) return;
      const type = getEdgeType(e);
      expandedPanelRef.current.style.cursor = getCursorForType(type);
    },
    [getEdgeType, getCursorForType],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const type = getEdgeType(e);
      if (!type) return;

      e.preventDefault();
      resizingRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: panelWidth,
        startHeight: messagesHeight,
        startScrollTop: messagesContainerRef.current?.scrollTop ?? 0,
        startCorner: corner,
      };
      document.body.style.cursor = getCursorForType(type);
    },
    [getEdgeType, getCursorForType, panelWidth, messagesHeight, corner],
  );

  const handleMouseLeave = useCallback(() => {
    if (!resizingRef.current.type && expandedPanelRef.current) {
      expandedPanelRef.current.style.cursor = "";
    }
  }, []);
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const hasMultipleTabs = conversations.length > 1;
  const hasMessages =
    activeConversation && activeConversation.messages.length > 0;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const {
        type,
        startX,
        startY,
        startWidth,
        startHeight,
        startScrollTop,
        startCorner,
      } = resizingRef.current;
      if (!type) return;

      const isLeftCorner =
        startCorner === "bottom-left" || startCorner === "top-left";
      const isBottomCorner =
        startCorner === "bottom-left" || startCorner === "bottom-right";

      if (type === "width" || type === "corner") {
        // For left corners, dragging right increases width; for right corners, dragging left increases width
        const deltaX = isLeftCorner ? e.clientX - startX : startX - e.clientX;
        setPanelWidth(
          Math.min(
            MAX_PANEL_WIDTH,
            Math.max(MIN_PANEL_WIDTH, startWidth + deltaX),
          ),
        );
      }

      if (type === "height" || type === "corner") {
        // For bottom corners, dragging up increases height; for top corners, dragging down increases height
        const deltaY = isBottomCorner ? startY - e.clientY : e.clientY - startY;
        const newHeight = Math.min(
          MAX_MANUAL_RESIZE_HEIGHT,
          Math.max(
            hasMessages ? MIN_MESSAGES_HEIGHT : MIN_MESSAGES_HEIGHT_NO_MESSAGE,
            startHeight + deltaY,
          ),
        );

        // Anchor scroll to bottom: as height shrinks, scroll increases proportionally
        const container = messagesContainerRef.current;
        if (container && isBottomCorner) {
          const heightDelta = startHeight - newHeight;
          if (heightDelta > 0) {
            // Shrinking: move scroll down to keep bottom content visible
            container.scrollTop = startScrollTop + heightDelta;
          } else {
            // Expanding: keep original scroll position
            container.scrollTop = startScrollTop;
          }
        }

        setMessagesHeight(newHeight);
        messagesHeightRef.current = newHeight;
      }
    };

    const onMouseUp = () => {
      if (resizingRef.current.type) {
        const wasResizingHeight =
          resizingRef.current.type === "height" ||
          resizingRef.current.type === "corner";
        if (wasResizingHeight) {
          setHasManuallyResizedHeight(true);
        }
        resizingRef.current.type = null;
        document.body.style.cursor = "";
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [hasMessages]);

  useEffect(() => {
    const handlePromptAgent = (params: {
      prompt: string;
      agentMode?: AgentMode;
    }) => {
      setIsExpanded(true);
      onSendMessage(params);
    };

    if (isReady && ipc) {
      ipc.on("prompt-agent", handlePromptAgent);
    }
    return () => {
      ipc?.off("prompt-agent", handlePromptAgent);
    };
  }, [isReady, ipc, onSendMessage]);

  const handleQuestionSubmit = useCallback(
    (toolUseId: string, output: AskUserQuestionOutput) => {
      setSubmittedQuestions((prev) => new Set(prev).add(toolUseId));

      if (onQuestionResponse) {
        onQuestionResponse(activeConversationId, toolUseId, output);
      }
    },
    [activeConversationId, onQuestionResponse],
  );

  const handleOpenTerminal = useCallback(() => {
    if (isReady && ipc) {
      ipc.notify("desktop-open-terminal", { runCheck: true });
    }
  }, [isReady, ipc]);

  const latestTodos = useMemo(() => {
    if (!activeConversation) return null;
    for (let i = activeConversation.messages.length - 1; i >= 0; i--) {
      const msg = activeConversation.messages[i];
      if (
        msg.role === "tool" &&
        msg.toolUse &&
        isTodoWriteTool(msg.toolUse.name) &&
        isTodoWriteInput(msg.toolUse.input)
      ) {
        return msg.toolUse.input as TodoWriteInput;
      }
    }
    return null;
  }, [activeConversation]);

  const prevConversationIdRef = useRef<string | null>(null);
  const prevMessagesCountRef = useRef<number>(0);

  const scrollToBottom = useCallback((animate: boolean) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: animate ? "smooth" : "instant",
    });
  }, []);

  const messagesCount = activeConversation?.messages.length ?? 0;
  const lastMessageLength =
    activeConversation?.messages[messagesCount - 1]?.text?.length ?? 0;
  useEffect(() => {
    const isTabSwitch = prevConversationIdRef.current !== activeConversationId;
    const isNewMessage = messagesCount > prevMessagesCountRef.current;

    prevConversationIdRef.current = activeConversationId;
    prevMessagesCountRef.current = messagesCount;

    scrollToBottom((isNewMessage || lastMessageLength > 0) && !isTabSwitch);
  }, [scrollToBottom, activeConversationId, messagesCount, lastMessageLength]);

  useEffect(() => {
    if (isExpanded) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        scrollToBottom(false);
      });
    }
  }, [isExpanded, scrollToBottom]);

  const handleSubmit = useCallback(() => {
    const text = inputRef.current?.value.trim();
    if ((text || pendingFiles.length > 0) && activeConversationId) {
      markChatAsUsed();
      onSendMessage({
        prompt: text || "",
        conversationId: activeConversationId,
        files: pendingFiles.length > 0 ? pendingFiles : undefined,
      });
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
      }
      setInputHasText(false);
      setPendingFiles([]);
    }
  }, [activeConversationId, onSendMessage, markChatAsUsed, pendingFiles]);

  const handleExpand = useCallback(() => {
    const text = collapsedInputRef.current?.value || "";
    setIsExpanded(true);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.value = text;
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
      }
    });
  }, []);

  const handleCollapse = useCallback(() => {
    markChatAsUsed();
    const text = inputRef.current?.value || "";
    setIsExpanded(false);
    requestAnimationFrame(() => {
      if (collapsedInputRef.current) {
        collapsedInputRef.current.value = text;
      }
    });
  }, [markChatAsUsed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        handleCollapse();
      }
    },
    [handleSubmit, handleCollapse],
  );

  const handleCollapsedSubmit = useCallback(() => {
    const text = collapsedInputRef.current?.value.trim();
    if (text && activeConversationId) {
      markChatAsUsed();
      onSendMessage({ prompt: text, conversationId: activeConversationId });
      if (collapsedInputRef.current) {
        collapsedInputRef.current.value = "";
      }
      setInputHasText(false);
      setIsExpanded(true);
    }
  }, [activeConversationId, onSendMessage, markChatAsUsed]);

  const handleCollapsedKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCollapsedSubmit();
      }
      if (e.key === "Escape") {
        collapsedInputRef.current?.blur();
      }
    },
    [handleCollapsedSubmit],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleAddToChat = (message: string) => {
      setIsExpanded(true);

      requestAnimationFrame(() => {
        if (!inputRef.current) return;

        inputRef.current.value = message;
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        setInputHasText(true);
        inputRef.current.focus();
      });
    };

    if (isReady && ipc) {
      ipc.on("add-to-chat", handleAddToChat);
    }

    return () => {
      ipc?.off("add-to-chat", handleAddToChat);
    };
  }, [isReady, ipc]);

  const adjustTextareaHeight = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      setInputHasText(textarea.value.trim().length > 0);
    },
    [],
  );

  // File attachment
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: FileAttachment[] = [];

    for (const file of fileArray) {
      if (isImageFile(file.name)) {
        newAttachments.push({
          type: "image",
          name: file.name,
          source: await encodeImageToBase64(file),
        });
      } else if (isTextFile(file.name)) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        newAttachments.push({
          type: "text",
          name: file.name,
          content,
        });
      }
    }

    if (newAttachments.length > 0) {
      setPendingFiles((prev) => [...prev, ...newAttachments]);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        e.target.value = "";
      }
    },
    [processFiles],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  // Drop file
  const handleCollapsedDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
        setIsExpanded(true);
      }
    },
    [processFiles],
  );

  // Collapsed state: minimal one-liner input bar
  if (!isExpanded) {
    return (
      <div
        ref={collapsedPanelRef}
        role="dialog"
        aria-label="Chat"
        className={cn(
          "pr-1.5 pl-1.5 py-2 absolute z-40 ring-1 ring-zinc-300 dark:ring-zinc-700 flex items-center bg-white dark:bg-zinc-900 shadow-lg dark:border-black/50 rounded-lg pointer-events-auto transition-colors",
          isDragOver &&
            "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50 ring-inset",
        )}
        style={{
          width: 270,
          ...positionStyle,
        }}
        onMouseDown={dragHandleProps.onMouseDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleCollapsedDrop}
      >
        {/* Drag handle area */}
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ pointerEvents: isDragging ? "none" : "auto" }}
        />
        <button
          type="button"
          onClick={handleExpand}
          className="relative z-10 w-5 h-5 mr-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-sm flex items-center justify-center transition-colors text-foreground/70 hover:text-foreground flex-shrink-0"
          aria-label="Expand chat"
        >
          <ChevronUp className="w-4 h-4" strokeWidth={1} />
        </button>
        <input
          ref={collapsedInputRef}
          type="text"
          className="relative z-10 mr-1 flex-1 text-[13px] border-none bg-transparent text-foreground placeholder:text-foreground/50 outline-none focus:outline-none min-w-0"
          placeholder="Design with Claude Code…"
          onKeyDown={handleCollapsedKeyDown}
          onChange={(e) => setInputHasText(e.target.value.trim().length > 0)}
        />
        <button
          type="button"
          onClick={handleCollapsedSubmit}
          className={`relative z-10 w-5 h-5 mr-1 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
            inputHasText
              ? "bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-300 dark:hover:bg-zinc-500 text-white"
              : "bg-zinc-400 dark:bg-zinc-600 text-zinc-400 dark:text-zinc-500"
          }`}
          aria-label="Send message"
        >
          <ArrowUp className="w-3.5 h-3.5 text-background" />
        </button>
      </div>
    );
  }

  // Expanded state: full chat interface
  return (
    <div
      ref={expandedPanelRef}
      role="dialog"
      aria-label="Chat"
      style={{
        width: panelWidth,
        ...positionStyle,
      }}
      className="absolute ring-1 ring-zinc-300 dark:ring-zinc-700 z-40 flex flex-col bg-zinc-100 dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden pointer-events-auto"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex-shrink-0">
        <div className="">
          <Tabs
            value={activeConversationId}
            onValueChange={onSelectConversation}
            className="w-full"
          >
            {/* Tabs - draggable header */}
            <div
              className="flex items-center mt-2 pb-2 h-5.5 border-b border-zinc-200 dark:border-zinc-700/50 cursor-grab active:cursor-grabbing"
              onMouseDown={dragHandleProps.onMouseDown}
              role="toolbar"
              aria-label="Chat panel controls and drag handle"
            >
              <button
                type="button"
                onClick={handleCollapse}
                className="p-0.5 ml-1 bg-accent hover:bg-black/5 dark:hover:bg-white/10 rounded-sm transition-colors text-foreground/60 hover:text-foreground"
                aria-label="Minimize Chat"
              >
                <ChevronDown className="w-4 h-4" strokeWidth={1} />
              </button>
              <TabsList className="flex-1 p-0 h-5 bg-transparent gap-1 justify-start overflow-x-auto overflow-y-hidden scrollbar-hidden rounded-none">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="relative flex items-center group"
                  >
                    <TabsTrigger
                      value={conv.id}
                      className={cn(
                        "relative select-none shadow-none px-1 h-5 text-left scrollbar-hidden text-xs transition-colors font-semibold",
                        "data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground/70",
                        "data-[state=inactive]:text-foreground/40 data-[state=inactive]:hover:text-foreground/60",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate max-w-[120px] transition-opacity",
                          hasMultipleTabs && "group-hover:opacity-100",
                        )}
                      >
                        {conv.title || "New Chat"}
                      </span>
                      {conv.isRunning && (
                        <Loader2 className="w-3 h-3 ml-1 animate-spin flex-shrink-0" />
                      )}
                    </TabsTrigger>
                    {conversations.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseConversation(conv.id);
                        }}
                        className="absolute right-0 w-6 h-5 flex items-center justify-end pr-1 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white via-25% to-white dark:via-zinc-800 dark:to-zinc-800 rounded-r-sm transition-opacity z-10"
                      >
                        <X className="w-3 h-3" strokeWidth={1} />
                      </button>
                    )}
                  </div>
                ))}
              </TabsList>
              <button
                type="button"
                onClick={onCreateConversation}
                className="p-1 mr-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-sm transition-colors text-foreground/60 hover:text-foreground"
                aria-label="New conversation"
              >
                <Plus className="w-4 h-4" strokeWidth={1} />
              </button>
            </div>
          </Tabs>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          style={{
            height: messagesHeight,
            minHeight: 0,
            maxHeight: hasManuallyResizedHeight
              ? messagesHeight
              : Math.min(messagesHeight, MAX_AUTO_GROW_HEIGHT),
            scrollBehavior: "auto",
          }}
          className="overflow-y-auto scrollbar-minimal pl-2 pr-2 pt-2 border-b border-black/5 dark:border-white/5"
        >
          {hasMessages ? (
            <div
              className="flex flex-col gap-2"
              data-pencil-allow-chat-clipboard
            >
              {activeConversation?.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onQuestionSubmit={handleQuestionSubmit}
                  onOpenTerminal={handleOpenTerminal}
                  isQuestionSubmitted={submittedQuestions.has(message.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-foreground/40 text-[10px]">
                Try an example to design...
              </span>
              <div className="flex flex-wrap justify-center gap-1.5 px-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      markChatAsUsed();
                      onSendMessage({
                        prompt,
                        conversationId: activeConversationId,
                      });
                    }}
                    className="text-xxs px-2 py-1 rounded-full border transition-colors cursor-pointer hover:bg-zinc-300/60 dark:hover:bg-zinc-600/60 bg-zinc-200/60 dark:bg-zinc-700/60 border-zinc-300/50 dark:border-zinc-600/30 text-foreground/70 truncate"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <span className="text-foreground/40 text-[10px]">
                Tip: Export design to code via Claude Code in terminal.
              </span>
              <span className="text-foreground/40 text-[10px]">
                Drop image / text file to chat or via{" "}
                <Paperclip className="w-3 h-3 inline-block" />
              </span>

              {claudeCodeStatus &&
                (!claudeCodeStatus.cliInstalled ||
                  !claudeCodeStatus.loggedIn) && (
                  <span className="text-amber-500 dark:text-amber-400 text-[10px] flex items-center text-center gap-1">
                    {!claudeCodeStatus.cliInstalled
                      ? "You have to install Claude Code to design with AI. Follow the steps in the top right corner."
                      : "Please login to Claude Code to design with AI. Run `claude` in terminal and follow the instructions."}
                  </span>
                )}
            </div>
          )}
        </div>

        {/* TODO */}
        {latestTodos && latestTodos.todos.length > 0 && (
          <div className="p-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PencilLine className="w-3 h-3 text-foreground/50" />
                <span className="text-foreground/60 font-medium text-[10px]">
                  Pencil it out
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground/40 text-[10px]">
                  {
                    latestTodos.todos.filter((t) => t.status === "completed")
                      .length
                  }
                  /{latestTodos.todos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTasksExpanded(!isTasksExpanded)}
                  className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-foreground/40 hover:text-foreground/60"
                  aria-label={
                    isTasksExpanded ? "Collapse tasks" : "Expand tasks"
                  }
                >
                  <ChevronsUpDown className="w-3 h-3" strokeWidth={1} />
                </button>
              </div>
            </div>
            {isTasksExpanded && (
              <div className="flex flex-col gap-0.5 max-h-[100px] overflow-y-auto mt-1.5">
                {latestTodos.todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={cn(
                      "flex items-start gap-1.5 text-[10px]",
                      todo.status === "cancelled" && "line-through opacity-50",
                    )}
                  >
                    <TodoStatusIcon status={todo.status} />
                    <span
                      className={cn(
                        "text-foreground/70 leading-tight",
                        todo.status === "completed" && "text-foreground/50",
                      )}
                    >
                      {todo.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Composer */}
        {/* biome-ignore lint/a11y/useSemanticElements: drag-drop area needs event handlers */}
        <div
          role="region"
          aria-label="Message composer with file drop support"
          className={cn(
            "flex flex-col gap-1 bg-white dark:bg-zinc-900 dark:border-zinc-700/50 rounded-b-md pl-2.5 pr-2 pt-2 pb-1.5 transition-colors",
            isDragOver &&
              "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50 ring-inset",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File previews */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-zinc-200 dark:border-zinc-700/50">
              {pendingFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative group">
                  {file.type === "image" ? (
                    <>
                      <div className="w-12 h-12 rounded overflow-hidden border border-zinc-200 dark:border-zinc-700">
                        <img
                          src={`data:${file.source.media_type};base64,${file.source.data}`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-600 hover:bg-zinc-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-xxs text-foreground/70">
                      <File className="w-3 h-3 flex-shrink-0" />
                      <span className="max-w-[80px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="w-3 h-3 flex items-center justify-center hover:text-foreground transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            onChange={adjustTextareaHeight}
            onKeyDown={handleKeyDown}
            className="text-[13px] border-none bg-transparent text-foreground placeholder:text-foreground/50 outline-none focus:outline-none resize-none min-h-[48px] max-h-[120px]"
            placeholder={
              isDragOver ? "Drop files here…" : "Design with Claude Code…"
            }
          />
          <div className="flex items-center justify-between">
            <div className="relative flex items-center gap-1">
              {/* Model picker */}
              <select
                value={activeConversation?.agentMode || "opus"}
                onChange={(e) =>
                  onChangeAgentMode(
                    activeConversationId,
                    e.target.value as AgentMode,
                  )
                }
                disabled={activeConversation?.isRunning}
                className="bg-transparent text-xxs select-none text-foreground/70 outline-none focus:outline-none border-none appearance-none cursor-pointer pr-3 text-left disabled:cursor-not-allowed"
              >
                {!platform.isElectron && (
                  <option value="send_to_cursor">Cursor Composer-1</option>
                )}
                <option value="haiku">Claude Haiku 4.5</option>
                <option value="sonnet">Claude Sonnet 4.5</option>
                <option value="opus">Claude Opus 4.5</option>
              </select>
              <ChevronDown
                className="absolute right-0 top-1/2 -translate-y-1 w-3 h-3 text-foreground/70 pointer-events-none stroke-[1.5]"
                strokeWidth={1}
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Attach file button */}
              <button
                type="button"
                onClick={openFilePicker}
                className="p-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-foreground/50 hover:text-foreground/70"
                aria-label="Attach file"
                title="Attach an image or text file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {/* Pick a style guide button */}
              <button
                type="button"
                onClick={() =>
                  globalEventEmitter.emit(
                    "openModal",
                    <TemplatePicker styleGuidesOnly />,
                  )
                }
                className="p-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-foreground/50 hover:text-foreground/70"
                aria-label="Pick a style guide"
                title="Pick a style guide"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
              {selectedIDs.length > 0 && (
                <div className="text-[10px] text-foreground/70">
                  {selectedIDs.length} object
                  {selectedIDs.length !== 1 ? "s" : ""} selected
                </div>
              )}
              {activeConversation?.isRunning ? (
                <button
                  type="button"
                  onClick={() => onStopConversation(activeConversationId)}
                  className="w-5 h-5 bg-zinc-500/80 hover:bg-zinc-500 text-white rounded-xl flex items-center justify-center transition-colors"
                  aria-label="Stop generation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className={`w-5 h-5 rounded-xl flex items-center justify-center transition-colors ${
                    inputHasText || pendingFiles.length > 0
                      ? "bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-300 dark:hover:bg-zinc-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500"
                  }`}
                  aria-label="Send message"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-background stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
