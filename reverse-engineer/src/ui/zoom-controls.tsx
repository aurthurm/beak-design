import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/dropdown-menu";
import { KeyboardShortcut } from "@/src/components/keyboard-shortcut";
import { useSceneManager } from "../pages/Editor";

export function ZoomControls() {
  const sceneManager = useSceneManager();
  const zoomRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const callback = () => {
      if (zoomRef.current) {
        zoomRef.current.textContent = `${Math.round(sceneManager.camera.zoom * 100)}%`;
      }
    };

    callback();

    sceneManager.camera.on("change", callback);

    return () => {
      sceneManager.camera.off("change", callback);
    };
  }, [sceneManager]);

  const handleZoomIn = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      sceneManager.camera.setZoom(sceneManager.camera.zoom * 2, true);
    },
    [sceneManager],
  );

  const handleZoomOut = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      sceneManager.camera.setZoom(sceneManager.camera.zoom / 2, true);
    },
    [sceneManager],
  );

  const handleZoomToFit = useCallback(() => {
    const bounds = sceneManager.scenegraph.getDocumentBoundingBox();
    if (bounds) {
      sceneManager.camera.zoomToBounds(bounds, 40);
    }
  }, [sceneManager]);

  const handleZoomTo50 = useCallback(() => {
    sceneManager.camera.setZoom(0.5, true);
  }, [sceneManager]);

  const handleZoomTo100 = useCallback(() => {
    sceneManager.camera.setZoom(1, true);
  }, [sceneManager]);

  const handleZoomTo200 = useCallback(() => {
    sceneManager.camera.setZoom(2, true);
  }, [sceneManager]);

  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-1 p-0.5 bg-card rounded-md shadow-md select-none pointer-events-auto">
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7"
        aria-label="Zoom Out"
        onClick={handleZoomOut}
        tabIndex={-1}
      >
        <Minus
          className="w-4 h-4 text-zinc-800 dark:text-zinc-100"
          strokeWidth={1}
        />
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            ref={zoomRef}
            type="button"
            className="font-mono text-xs text-zinc-800 dark:text-zinc-100 w-11 text-center hover:bg-accent rounded py-1 transition-colors outline-none"
            tabIndex={-1}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          className="bg-card"
        >
          <DropdownMenuItem className="text-xs" onSelect={handleZoomToFit}>
            Zoom to fit
            <KeyboardShortcut keys="1" className="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={handleZoomTo50}>
            Zoom to 50%
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={handleZoomTo100}>
            Zoom to 100%
            <KeyboardShortcut keys="0" className="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={handleZoomTo200}>
            Zoom to 200%
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7"
        aria-label="Zoom In"
        onClick={handleZoomIn}
        tabIndex={-1}
      >
        <Plus
          className="w-4 h-4 text-zinc-800 dark:text-zinc-100"
          strokeWidth={1}
        />
      </Button>
    </div>
  );
}
