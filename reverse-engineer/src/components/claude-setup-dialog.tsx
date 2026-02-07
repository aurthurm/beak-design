import type { ClaudeConnectionStatus } from "@ha/shared";
import { ExternalLink, MessageCircleIcon, Terminal } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

interface ClaudeSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claudeCodeStatus: ClaudeConnectionStatus | undefined;
  onOpenTerminal: () => void;
}

function NotInstalledContent() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Claude Code CLI is not installed. You can install it by running the
        following command:
      </p>
      <div className="rounded-lg bg-muted p-4 space-y-3">
        <p className="font-medium">Install Claude Code:</p>
        <code className="block text-xs bg-black/10 dark:bg-white/10 rounded px-3 py-2 font-mono">
          curl -fsSL https://claude.ai/install.sh | bash
        </code>
      </div>
      <p className="text-muted-foreground">
        Or open the quickstart guide for more information and ways to install
        Claude Code.
      </p>
      <Button asChild className="w-full">
        <a
          href="https://code.claude.com/docs/en/quickstart"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="w-4 h-4" />
          Open Quickstart Guide
        </a>
      </Button>
    </div>
  );
}

function NotLoggedInContent({
  onOpenTerminal,
}: {
  onOpenTerminal: () => void;
}) {
  return (
    <div className="space-y-4 text-xs text-muted-foreground text-xs">
      <p className="text-muted-foreground">
        In order to user Claude Code with Pencil, you need to log in to your
        Claude account.
      </p>
      <p className="text-muted-foreground">Step 1. Open Terminal</p>
      <Button onClick={onOpenTerminal} className="w-full bg-foreground">
        <Terminal className="w-4 h-4" />
        Open Terminal
      </Button>
      <p className="text-muted-foreground">Step 2. Start Claude Code</p>
      <div className="rounded-lg bg-muted p-4 space-y-3">
        <div className="space-y-2">
          <code className="block text-xs bg-black/10 dark:bg-white/10 rounded px-3 py-2 font-mono">
            claude
          </code>
        </div>
      </div>
      <p className="text-muted-foreground">Step 3. Login to Claude Code</p>
      <div className="rounded-lg bg-muted p-4 space-y-3">
        <div className="space-y-2">
          <code className="block text-xs bg-black/10 dark:bg-white/10 rounded px-3 py-2 font-mono">
            /login
          </code>
        </div>
      </div>
    </div>
  );
}

function LoggedInContent({ accountInfoEmail }: { accountInfoEmail: string }) {
  return (
    <div className="space-y-4 text-xs">
      <p className="text-muted-foreground">
        Your AI assistant is connected to Pencil and waiting for commands.
      </p>
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <p className="text-sm font-medium">Claude Code is logged in</p>
        <div className="text-xs text-muted-foreground space-y-1">
          {accountInfoEmail && (
            <p>
              <span className="font-medium">Email:</span> {accountInfoEmail}
            </p>
          )}
        </div>
      </div>
      <p>
        Feel free to open the chat prompt inside Pencil{" "}
        <MessageCircleIcon className="w-4 h-4 inline-block" /> or go back to
        <span className="font-mono m-1 p-0.5 rounded-md bg-muted">claude</span>{" "}
        code in Terminal and ask to design something or convert design into
        code. For instance:
      </p>
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <code className="block text-xs bg-black/10 dark:bg-white/10 rounded px-3 py-2 font-mono">
          Design a modern technical looking web app for managing renewable
          energy usage.
        </code>
      </div>
    </div>
  );
}

export function ClaudeSetupDialog({
  open,
  onOpenChange,
  claudeCodeStatus,
  onOpenTerminal,
}: ClaudeSetupDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const getDialogTitle = () => {
    if (!claudeCodeStatus?.cliInstalled) {
      return "Install Claude Code CLI";
    }
    if (!claudeCodeStatus?.loggedIn) {
      return "Login to Claude Code CLI";
    }
    return "Claude Code is Ready";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md !slide-in-from-top-0 !slide-in-from-left-0 !slide-out-to-top-0 !slide-out-to-left-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              className="bi bi-claude"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
            </svg>
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {!claudeCodeStatus?.cliInstalled ? (
          <NotInstalledContent />
        ) : !claudeCodeStatus?.loggedIn ? (
          <NotLoggedInContent onOpenTerminal={onOpenTerminal} />
        ) : (
          <LoggedInContent
            accountInfoEmail={
              claudeCodeStatus.accountInfoEmail ?? "Not logged in"
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
