import { Code, ExternalLink, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface CodeMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CODE_MCP_DISMISSED_KEY = "code-mcp-dismissed";

export function CodeMcpDialog({ open, onOpenChange }: CodeMcpDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

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

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(CODE_MCP_DISMISSED_KEY, "true");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl !slide-in-from-top-0 !slide-in-from-left-0 !slide-out-to-top-0 !slide-out-to-left-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Export Design to Code with Pencil MCP in Terminal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Pencil automatically installs pencil MCP (Model Context Protocol)
            server to Claude Code*, allowing you to generate production-ready
            code from your designs directly in your terminal.
          </p>

          <p className="text-muted-foreground text-xxs">
            * Pencil MCP is also automatically installed to Codex CLI and Gemini
            CLI if you have them.
          </p>

          <div className="rounded-lg bg-muted p-4 space-y-3">
            <p className="font-medium flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              How to export your design to code:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
              <li>
                Pencil app has to be launched first, after that open Claude Code
                in your terminal by running{" "}
                <code className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono">
                  claude
                </code>
              </li>
              <li>
                Check if you can see Pencil MCP tools by running command{" "}
                <code className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono">
                  /mcp
                </code>
                <div className="mt-2">
                  Note: If you still don't see Pencil MCP tools, make sure to
                  launch Pencil app first and then claude code afterwards.
                  Pencil installs MCP tools automatically on launch.
                </div>
              </li>
              <li>
                Ask Claude to generate code from your designs (Keep Pencil
                desktop app running). Claude Code will be able to access
                selections, components, variables, etc.
              </li>
            </ol>
          </div>

          <p className="text-xs font-medium">
            Example prompt (Run via Claude Code CLI in Terminal):
          </p>
          <code className="block text-sm bg-white/90 dark:bg-black/90 text-black/80 dark:text-white/80 rounded px-3 py-2 font-mono before:content-['%_'] before:text-black/40 dark:before:text-white/40 before:select-none">
            Generate React/Tailwind/NextJS code from the selected frame
          </code>

          <code className="block text-sm bg-white/90 dark:bg-black/90 text-black/80 dark:text-white/80 rounded px-3 py-2 font-mono before:content-['%_'] before:text-black/40 dark:before:text-white/40 before:select-none">
            Update CSS based on the variables in the design
          </code>

          <code className="block text-sm bg-white/90 dark:bg-black/90 text-black/80 dark:text-white/80 rounded px-3 py-2 font-mono before:content-['%_'] before:text-black/40 dark:before:text-white/40 before:select-none">
            Create a React component based on the selected frame
          </code>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-0">
          <label className="flex items-center gap-2  text-xs text-muted-foreground cursor-pointer select-none mr-auto">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-border"
            />
            Don't show this dialog again
          </label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function isCodeMcpDismissed(): boolean {
  return localStorage.getItem(CODE_MCP_DISMISSED_KEY) === "true";
}
