import type { ClaudeConnectionStatus } from "@ha/shared";
import {
  CircleCheck,
  Code,
  Plus,
  FolderClock,
  Info,
  Moon,
  Sun,
  X,
} from "lucide-react";
import path from "path";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { platform } from "../platform";
import { ClaudeSetupDialog } from "./claude-setup-dialog";
import { CodeMcpDialog } from "./code-mcp-dialog";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface TitlebarProps {
  title: string | null | undefined;
  claudeCodeStatus: ClaudeConnectionStatus | undefined;
  isFullscreen: boolean;
  isDirty: boolean;
  ideName?: string;
  isPropertiesPanelVisible?: boolean;
  recentFiles: string[];
  layersButton?: React.ReactNode;
  designKitsButton?: React.ReactNode;
  codeMcpDialogOpen?: boolean;
  onCodeMcpDialogOpenChange?: (open: boolean) => void;
  onHelpClicked: () => void;
  onOpenTerminal: () => void;
  onAddClicked: () => void;
  onAddToIDEClicked: () => void;
  onRecentFileClicked: (filePath: string) => void;
  onClearRecentFiles: () => void;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

const ADD_TO_IDE_DISMISSED_KEY = "add-to-ide-dismissed";

export function Titlebar({
  title,
  claudeCodeStatus,
  isFullscreen,
  isDirty,
  ideName,
  isPropertiesPanelVisible,
  recentFiles,
  layersButton,
  designKitsButton,
  codeMcpDialogOpen,
  onCodeMcpDialogOpenChange,
  onHelpClicked,
  onOpenTerminal,
  onAddClicked,
  onAddToIDEClicked,
  onRecentFileClicked,
  onClearRecentFiles,
  toggleTheme,
  isDarkMode,
}: TitlebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [internalCodeMcpDialogOpen, setInternalCodeMcpDialogOpen] =
    useState(false);
  const posthog = usePostHog();
  const [dismissedIDE, setDismissedIDE] = useState<string | null>(() => {
    return localStorage.getItem(ADD_TO_IDE_DISMISSED_KEY);
  });

  // Use external state if provided, otherwise use internal state
  const isCodeMcpDialogOpen = codeMcpDialogOpen ?? internalCodeMcpDialogOpen;
  const setCodeMcpDialogOpen =
    onCodeMcpDialogOpenChange ?? setInternalCodeMcpDialogOpen;

  const shouldShowHelpButton = (status: ClaudeConnectionStatus) =>
    (!status.cliInstalled && !status.loggedIn) || !status.loggedIn;

  const ClaudeStatusIcon = !claudeCodeStatus ? null : shouldShowHelpButton(
      claudeCodeStatus,
    ) ? (
    <Info className="w-4 h-4" strokeWidth={1} />
  ) : (
    <CircleCheck className="w-4 h-4" strokeWidth={1} />
  );

  return (
    <div className={`absolute top-0 left-0 right-0 h-[40px] z-100`}>
      <div className="relative inset-0 flex w-full h-full items-center bg-white/50 drag dark:bg-black/50 backdrop-blur-lg border-b-[1px] border-border/40 z-10">
        {platform.isMac && (
          <>
            {
              /* macOS traffic lights area */
              !isFullscreen && <div className="w-18 h-full flex-shrink-0"></div>
            }
            {/* LayersButton area */}
            <div className="w-9 h-full no-drag flex-shrink-0 flex items-center justify-center">
              {layersButton}
            </div>
            {designKitsButton}
            <DropdownMenu>
              <Tooltip key="history" delayDuration={750}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={"ghost"}
                      size="icon"
                      aria-label="recent-files"
                      className="w-7 h-7 z-100 no-drag"
                      tabIndex={-1}
                    >
                      <FolderClock
                        className="w-4 h-4 text-zinc-800 dark:text-zinc-100"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="flex items-center gap-1.5">Recent Files</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                className="w-42"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {recentFiles.length === 0 ? (
                  <DropdownMenuItem
                    disabled
                    className="text-muted-foreground text-xxs"
                  >
                    No recent files
                  </DropdownMenuItem>
                ) : (
                  <>
                    {recentFiles.map((filePath) => (
                      <Tooltip key={filePath} delayDuration={500}>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem
                            onClick={() => onRecentFileClicked(filePath)}
                            className="cursor-pointer text-xxs"
                          >
                            <span className="truncate">
                              {path.basename(filePath)}
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="text-xxs text-background max-w-xs"
                        >
                          {filePath}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onClearRecentFiles}
                      className="cursor-pointer text-muted-foreground text-xxs"
                    >
                      Clear Menu
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip key="add-object" delayDuration={750}>
              <TooltipTrigger asChild>
                <Button
                  variant={"ghost"}
                  size="icon"
                  onClick={onAddClicked}
                  aria-label="toggle-new-file"
                  className="w-7 h-7 z-100 no-drag"
                  tabIndex={-1}
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="flex items-center gap-1.5">New File</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
        <div className="flex w-full h-full drag justify-center items-center space-x-1 text-xs text-foreground/50 dark:text-foreground/70 font-semibold overflow-hidden whitespace-nowrap select-none">
          <img
            src="./images/64x64.png"
            alt="Pencil Logo"
            className="w-5.5 h-5.5"
            draggable={false}
          />
          <span>
            {title}
            {isDirty && (
              <span className="text-foreground/50 font-medium"> — Edited</span>
            )}
          </span>
        </div>
        {ideName && dismissedIDE !== ideName && (
          <div className="flex flex-shrink-0 items-center h-6 p-0 mr-3 text-xxs text-muted-foreground bg-card border-border border-1 rounded-sm transition-colors select-none overflow-hidden">
            <button
              type="button"
              onClick={() => {
                posthog?.capture("add-to-ide-clicked", { ideName });
                onAddToIDEClicked();
              }}
              className="flex items-center p-1 space-x-1 cursor-pointer pr-1 hover:bg-accent no-drag"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 466.73 533.32"
                className="w-4 h-4 flex-shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#72716d"
                  d="M233.37,266.66l231.16,133.46c-1.42,2.46-3.48,4.56-6.03,6.03l-216.06,124.74c-5.61,3.24-12.53,3.24-18.14,0L8.24,406.15c-2.55-1.47-4.61-3.57-6.03-6.03l231.16-133.46h0Z"
                />
                <path
                  fill="#55544f"
                  d="M233.37,0v266.66L2.21,400.12c-1.42-2.46-2.21-5.3-2.21-8.24v-250.44c0-5.89,3.14-11.32,8.24-14.27L224.29,2.43c2.81-1.62,5.94-2.43,9.07-2.43h.01Z"
                />
                <path
                  fill="#43413c"
                  d="M464.52,133.2c-1.42-2.46-3.48-4.56-6.03-6.03L242.43,2.43c-2.8-1.62-5.93-2.43-9.06-2.43v266.66l231.16,133.46c1.42-2.46,2.21-5.3,2.21-8.24v-250.44c0-2.95-.78-5.77-2.21-8.24h-.01Z"
                />
                <path
                  fill="#d6d5d2"
                  d="M448.35,142.54c1.31,2.26,1.49,5.16,0,7.74l-209.83,363.42c-1.41,2.46-5.16,1.45-5.16-1.38v-239.48c0-1.91-.51-3.75-1.44-5.36l216.42-124.95h.01Z"
                />
                <path
                  fill="#fff"
                  d="M448.35,142.54l-216.42,124.95c-.92-1.6-2.26-2.96-3.92-3.92L20.62,143.83c-2.46-1.41-1.45-5.16,1.38-5.16h419.65c2.98,0,5.4,1.61,6.7,3.87Z"
                />
              </svg>
              <span className="pl-1 pr-1">
                Add to {ideName === "cursor" ? "Cursor" : ideName}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                posthog?.capture("add-to-ide-dismissed", { ideName });
                localStorage.setItem(ADD_TO_IDE_DISMISSED_KEY, ideName);
                setDismissedIDE(ideName);
              }}
              className="flex items-center justify-center cursor-pointer hover:bg-accent w-5 h-full transition-opacity no-drag"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex flex-shrink-0 items-center h-6 p-0 mr-1.5 text-xxs text-muted-foreground bg-card border-border border-1 rounded-sm transition-colors select-none overflow-hidden">
          <button
            type="button"
            onClick={() => {
              posthog?.capture("code-mcp-dialog-opened");
              setCodeMcpDialogOpen(true);
            }}
            className="flex items-center p-1 px-2 space-x-1.5 cursor-pointer hover:bg-accent no-drag"
          >
            <Code className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
            <span className="font-mono text-[10px] tracking-tight select-none">
              Export Code & MCP
            </span>
          </button>
        </div>
        <div className="flex flex-shrink-0 items-center h-6 p-0 mr-1 text-xxs text-muted-foreground bg-card border-border border-1 rounded-sm transition-colors select-none overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setDialogOpen(true);
              onHelpClicked();
            }}
            className="flex items-center p-1 px-2 space-x-1.5 cursor-pointer hover:bg-accent no-drag"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              fill={
                !claudeCodeStatus
                  ? "#DE7356"
                  : claudeCodeStatus.loggedIn
                    ? "currentColor"
                    : "#DE7356"
              }
              className="bi bi-claude flex-shrink-0"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
            </svg>
            <span className="font-mono text-[10px] tracking-tight select-none">
              {!claudeCodeStatus
                ? "Connecting to Claude Code"
                : claudeCodeStatus.loggedIn
                  ? "Claude Code Connected"
                  : claudeCodeStatus.cliInstalled
                    ? "Login to Claude Code"
                    : "Setup Claude Code"}
            </span>
            <span>{ClaudeStatusIcon}</span>
          </button>
        </div>
        {toggleTheme && (
          <Tooltip key="toggle-theme" delayDuration={750}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="toggle-theme"
                className="w-7 h-7 z-100 no-drag mr-1.5"
                tabIndex={-1}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Moon className="w-4 h-4" strokeWidth={1.5} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="flex items-center gap-1.5">
                {isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <ClaudeSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        claudeCodeStatus={claudeCodeStatus}
        onOpenTerminal={onOpenTerminal}
      />

      <CodeMcpDialog
        open={isCodeMcpDialogOpen}
        onOpenChange={setCodeMcpDialogOpen}
      />

      {/* Right-side gradient overlay when properties panel is open */}
      <div
        className={`absolute top-0 right-0 h-full w-32 pointer-events-none transition-opacity duration-200 bg-gradient-to-l from-white/50 to-transparent dark:from-black/50 z-0 ${
          isPropertiesPanelVisible ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
