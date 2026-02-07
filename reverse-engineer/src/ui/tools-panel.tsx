import { ChevronDown, PenTool } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { Button } from "@/src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/dropdown-menu";
import { toast } from "sonner";
import { KeyboardShortcut } from "@/src/components/keyboard-shortcut";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/tooltip";
import { cn } from "@/src/lib/utils";
import {
  IconEllipse,
  IconFigma,
  IconFrame,
  IconHand,
  IconIconFont,
  IconImage,
  IconKeyboard,
  IconMove,
  IconRectangle,
  IconSettings,
  IconStickyNote,
  IconText,
  IconVariables,
  IconResize,
} from "../components/icons";
import { KeyboardShortcuts } from "../components/keyboard-shortcuts";
import { requestNativeImageFileImport } from "../importer";
import { useSceneManager } from "../pages/Editor";
import { SettingsMenu } from "./settings-menu";
import { platform } from "../platform";
import type { Tool } from "@ha/pencil-editor";
import { globalEventEmitter } from "../lib/global-event-emitter";

interface ToolsPanelProps {
  className?: string;
  isLoggedIn: boolean;
  onToggleImagePanel?: () => void;
  onToggleVariablesPanel?: () => void;
  onToggleDesignMode?: () => void;
  layersButton?: React.ReactNode;
  designKitsButton?: React.ReactNode;
}

const primitiveTools: {
  type: Tool;
  name: string;
  icon: React.ElementType;
  disabled?: boolean;
}[] = [
  { type: "rectangle", name: "Rectangle", icon: IconRectangle },
  { type: "ellipse", name: "Ellipse", icon: IconEllipse },
  { type: "icon_font", name: "Icon Font", icon: IconIconFont },
  { type: "image", name: "Import Image or SVG…", icon: IconImage },
];

const tools: { type: Tool; name: string; icon: React.ElementType }[] = [
  { type: "text", name: "Text", icon: IconText },
  { type: "frame", name: "Frame", icon: IconFrame },
  { type: "sticky_note", name: "Sticky Note", icon: IconStickyNote },
  { type: "hand", name: "Hand", icon: IconHand },
];

const ToolsPanel: React.FC<ToolsPanelProps> = ({
  className,
  isLoggedIn,
  onToggleVariablesPanel,
  onToggleDesignMode,
  layersButton,
  designKitsButton,
}) => {
  const sceneManager = useSceneManager();

  const getTooltipContent = (toolName: string) => {
    const tooltipData: Record<string, { label: string; shortcut?: string }> = {
      rectangle: { label: "Rectangle", shortcut: "R" },
      ellipse: { label: "Ellipse", shortcut: "O" },
      line: { label: "Line", shortcut: "L" },
      polygon: { label: "Polygon", shortcut: "P" },
      image: { label: "Import Image or SVG…" },
      icon: { label: "Icon" },
      icon_font: { label: "Icon Font" },
      text: { label: "Text", shortcut: "T" },
      frame: { label: "Frame", shortcut: "F" },
      sticky_note: { label: "Sticky Note", shortcut: "N" },
      hand: { label: "Hand", shortcut: "H" },
    };
    const data = tooltipData[toolName] || { label: toolName };

    if (data.shortcut) {
      return (
        <p className="flex items-center gap-1.5">
          {data.label} <KeyboardShortcut keys={data.shortcut} />
        </p>
      );
    }
    return <p>{data.label}</p>;
  };
  const [activeTool, setActiveTool] = useState<Tool>(
    sceneManager.getActiveTool(),
  );

  const [selectedPrimitiveTool, setSelectedPrimitiveTool] =
    useState<Tool>("rectangle");

  useEffect(() => {
    const handleToolChange = (newTool: Tool) => {
      setActiveTool(newTool);
      if (primitiveTools.some((tool) => tool.type === newTool)) {
        setSelectedPrimitiveTool(newTool);
      }
    };

    sceneManager.eventEmitter.on("toolChange", handleToolChange);
    setActiveTool(sceneManager.getActiveTool());

    return () => {
      sceneManager.eventEmitter.off("toolChange", handleToolChange);
    };
  }, [sceneManager]);

  const SelectedPrimitiveIcon =
    primitiveTools.find((tool) => tool.type === selectedPrimitiveTool)?.icon ??
    IconRectangle;

  return (
    <div
      role="toolbar"
      className={cn(
        className,
        "flex flex-col justify-between space-y-3 py-1.5 pl-1.5 h-full no-drag",
      )}
      style={{
        paddingTop: platform.isElectronMac ? 44 : 48,
      }}
      onKeyDown={(e) => {
        e.preventDefault();
      }}
    >
      <div
        className={cn(
          "tools-panel flex flex-col space-y-1 bg-card rounded-lg p-1 shadow-md pointer-events-auto",
        )}
      >
        {layersButton}
        <Tooltip delayDuration={750}>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === "move" ? "outline" : "ghost"}
              size="icon"
              onClick={() => sceneManager.setActiveTool("move")}
              aria-label="Move"
              className="w-7 h-7"
              tabIndex={-1}
            >
              <IconMove className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p className="flex items-center gap-1.5">
              Move <KeyboardShortcut keys="V" />
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-center">
          <Tooltip delayDuration={750}>
            <TooltipTrigger asChild>
              <Button
                variant={
                  primitiveTools.some((tool) => tool.type === activeTool)
                    ? "outline"
                    : "ghost"
                }
                size="icon"
                onClick={() =>
                  sceneManager.setActiveTool(selectedPrimitiveTool)
                }
                aria-label="Selected Primitive"
                className="w-7 h-7"
                tabIndex={-1}
              >
                <SelectedPrimitiveIcon className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {getTooltipContent(selectedPrimitiveTool)}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Primitives"
                className="w-7 h-3 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                tabIndex={-1}
              >
                <ChevronDown className="w-3 h-3 transform scale-75 text-zinc-800 dark:text-zinc-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={10}>
              {primitiveTools.flatMap((tool) => {
                const menuItem =
                  tool.type === "icon_font" ? (
                    <DropdownMenuItem
                      key={tool.type}
                      className="text-xs"
                      disabled={tool.disabled}
                      onClick={() => {
                        sceneManager.setActiveTool("icon_font");
                        setSelectedPrimitiveTool("icon_font");
                      }}
                    >
                      <tool.icon className="w-4 h-4 mr-2" />
                      Icon
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      key={tool.type}
                      className="text-xs"
                      disabled={tool.disabled}
                      onClick={() => {
                        if (tool.type === "image") {
                          requestNativeImageFileImport(sceneManager);
                        } else {
                          sceneManager.setActiveTool(tool.type);
                          setSelectedPrimitiveTool(tool.type);
                        }
                      }}
                    >
                      <tool.icon className="w-4 h-4 mr-2" />
                      {tool.name}
                    </DropdownMenuItem>
                  );

                return [menuItem];
              })}
              <DropdownMenuItem
                className="text-xs"
                onClick={() => {
                  toast.info("How to import from Figma", {
                    description:
                      "Just copy/paste.\n\nCopy any layer or frame in Figma and paste it directly into the canvas using Cmd+V (Mac) or Ctrl+V (Window/Linux).\n\nNote: Bitmaps won't copy over currently, coming in the future. Some advanced graphics features might be not yet supported.",
                    duration: 8000,
                  });
                }}
              >
                <IconFigma className="w-4 h-4 mr-2" />
                Import Figma
              </DropdownMenuItem>
              <DropdownMenuItem
                key="pen"
                className="text-xs text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  toast.info(
                    "Yeah, we know we are called Pencil and don't have it yet. But no worries. Pen tool and shape editing are coming! 🤓",
                    { duration: 6000 },
                  );
                }}
              >
                <PenTool className="w-4 h-4 mr-2" />
                Pen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Tooltip key={tool.type} delayDuration={750}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === tool.type ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => {
                    sceneManager.setActiveTool(tool.type);
                  }}
                  aria-label={tool.type}
                  className="w-7 h-7"
                  tabIndex={-1}
                >
                  <Icon className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {getTooltipContent(tool.type)}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <Tooltip key="variables" delayDuration={750}>
          <TooltipTrigger asChild>
            <Button
              variant={"ghost"}
              size="icon"
              onClick={onToggleVariablesPanel}
              aria-label="variables"
              className="w-7 h-7"
              tabIndex={-1}
            >
              <IconVariables className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p>Variables</p>
          </TooltipContent>
        </Tooltip>
        {designKitsButton}
        <Tooltip key="keyboard-shortcuts" delayDuration={750}>
          <TooltipTrigger asChild>
            <Button
              variant={"ghost"}
              size="icon"
              onClick={() => {
                globalEventEmitter.emit("openModal", <KeyboardShortcuts />);
              }}
              aria-label="keyboard-shortcuts"
              className="w-7 h-7"
              tabIndex={-1}
            >
              <IconKeyboard className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p className="flex items-center gap-1.5">
              Keyboard Shortcuts{" "}
              <KeyboardShortcut keys={[platform.shiftKey, "?"]} />
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip delayDuration={750}>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant={"ghost"}
                  size="icon"
                  aria-label="settings"
                  className="w-7 h-7 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                  tabIndex={-1}
                >
                  <IconSettings className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent side="right" className="text-xs">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={10}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            <SettingsMenu isLoggedIn={isLoggedIn} />
          </DropdownMenuContent>
        </DropdownMenu>
        {platform.isVSCode ? (
          <Tooltip key="toggle-design-mode" delayDuration={750}>
            <TooltipTrigger asChild>
              <Button
                variant={"ghost"}
                size="icon"
                onClick={() => {
                  onToggleDesignMode?.();
                }}
                aria-label="toggle-design-mode"
                className="w-7 h-7"
                tabIndex={-1}
              >
                <IconResize className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="flex items-center gap-1.5">
                Toggle Design Mode{" "}
                <KeyboardShortcut
                  keys={[platform.cmdKey, platform.shiftKey, "\\"]}
                />
              </p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};

export default ToolsPanel;
