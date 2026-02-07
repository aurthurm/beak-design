import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/dialog";
import { KeyboardShortcut } from "@/src/components/keyboard-shortcut";
import { platform } from "../platform";

const cmd = platform.cmdKey;
const alt = platform.altKey;

interface Shortcut {
  key: string[];
  description: string;
}

// TODO(sedivy): Build this table dynamically from the registered shortcuts.
const shortcuts: { category: string; shortcuts: Shortcut[] }[] = [
  {
    category: "General",
    shortcuts: [
      { key: [cmd, "c"], description: "Copy" },
      { key: [cmd, "v"], description: "Paste" },
      { key: [cmd, "x"], description: "Cut" },
      { key: [cmd, "Z"], description: "Undo" },
      { key: [cmd, "⇧", "Z"], description: "Redo" },
      { key: [cmd, "S"], description: "Save" },
      { key: ["⌫"], description: "Delete" },
      { key: [cmd, "K"], description: "Prompt (for Claude Code)" },
      { key: ["Arrow keys"], description: "Move 1px (Shift for 10px)" },
      { key: ["Arrow keys"], description: "In Flex Layout swap elements" },
      { key: [cmd, "G"], description: "Group" },
      { key: [cmd, "⇧", "G"], description: "Ungroup" },
      { key: [cmd, alt, "G"], description: "Group with Frame" },
      { key: [cmd, "["], description: "Send backward" },
      { key: [cmd, "]"], description: "Bring forward" },
      { key: ["["], description: "Send to back" },
      { key: ["]"], description: "Bring to front" },
      { key: [cmd, alt, "K"], description: "Create component" },
      { key: [cmd, alt, "X"], description: "Detach component instance" },
      { key: [cmd, "'"], description: "Toggle pixel grid" },
      { key: [cmd, "⇧", "'"], description: "Toggle snap to pixel grid" },
    ],
  },
  {
    category: "Selection",
    shortcuts: [
      { key: [cmd, "A"], description: "Select all" },
      { key: [cmd, "click"], description: "Deep select" },
      { key: ["Esc"], description: "Clear selection" },
      { key: ["↵"], description: "Select children" },
      { key: ["⇧", "↵"], description: "Select parent" },
    ],
  },
  {
    category: "Tools",
    shortcuts: [
      { key: ["V"], description: "Move tool" },
      { key: ["H"], description: "Hand tool" },
      { key: ["R"], description: "Rectangle tool" },
      { key: ["O"], description: "Ellipse tool" },
      { key: ["A / F"], description: "Frame tool" },
      { key: ["T"], description: "Text tool" },
      { key: ["N"], description: "Sticky note tool" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { key: [cmd, "scroll"], description: "Zoom" },
      { key: ["Space", "drag"], description: "Pan" },
      { key: ["="], description: "Zoom in" },
      { key: ["-"], description: "Zoom out" },
      { key: ["0"], description: "Reset zoom" },
      { key: ["1"], description: "Zoom to fit" },
      { key: ["2"], description: "Zoom to selection" },
    ],
  },
];

export function KeyboardShortcuts() {
  return (
    <DialogContent className="!max-w-[min(708px,calc(100vw-16px))] !w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] p-4 !duration-0 data-[state=open]:!animate-none data-[state=closed]:!animate-none data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100 data-[state=open]:!translate-x-[-50%] data-[state=closed]:!translate-x-[-50%] data-[state=open]:!translate-y-[-50%] data-[state=closed]:!translate-y-[-50%] flex flex-col">
      <DialogHeader className="flex flex-row items-start justify-between space-y-0 text-left shrink-0">
        <div className="flex flex-col">
          <DialogTitle className="text-lg leading-7 font-semibold">
            Keyboard Shortcuts
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="mt-2 columns-2 gap-8 overflow-y-auto">
        {shortcuts.map((section) => (
          <div
            key={section.category}
            className="flex flex-col gap-2 break-inside-avoid mb-4"
          >
            <div className="text-sm font-semibold text-foreground">
              {section.category}
            </div>
            {section.shortcuts.map((shortcut) => (
              <div
                key={`${shortcut.description}`}
                className="flex items-center"
              >
                <div className="flex min-w-[120px] items-center justify-start gap-1">
                  <KeyboardShortcut keys={shortcut.key} />
                </div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground">
                    {shortcut.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DialogContent>
  );
}
