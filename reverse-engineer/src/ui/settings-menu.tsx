import { useEffect, useState } from "react";
import type { PencilConfigData } from "@ha/pencil-editor";
import { DropdownMenuCheckboxItem } from "../components/dropdown-menu";
import { useSceneManager } from "../pages/Editor";
import { platform } from "../platform";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useIPC } from "../contexts/ipc-context";

const options: {
  label: string;
  id: keyof PencilConfigData;
  shortcut?: string;
}[] = [
  {
    label: "Show pixel grid",
    id: "showPixelGrid",
    shortcut: `${platform.cmdKey}+'`,
  },
  {
    label: "Snap to pixel grid",
    id: "roundToPixels",
    shortcut: `${platform.cmdKey}+⇧+'`,
  },
  { label: "Snap to objects", id: "snapToObjects" },
  { label: "Use scroll wheel to zoom", id: "scrollWheelZoom" },
  { label: "Invert zoom direction", id: "invertZoomDirection" },
  {
    label: "Hide sidebar when Layers are open",
    id: "hideSidebarWhenLayersAreOpen",
  },
  { label: "Generating effect", id: "generatingEffectEnabled" },
];

export function SettingsMenu(props: { isLoggedIn: boolean }) {
  const { isLoggedIn } = props;
  const sceneManager = useSceneManager();
  const { isReady, ipc } = useIPC();

  const [config, setConfig] = useState(() =>
    structuredClone(sceneManager.config.data),
  );

  useEffect(() => {
    function callback() {
      setConfig(structuredClone(sceneManager.config.data));
    }

    sceneManager.config.on("change", callback);
    return () => {
      sceneManager.config.off("change", callback);
    };
  }, [sceneManager]);

  return (
    <>
      {options.map((option) => {
        return (
          <DropdownMenuCheckboxItem
            key={option.id}
            className="text-xs pl-[25px]"
            checked={Boolean(config[option.id])}
            onClick={(e) => {
              e.preventDefault();
              sceneManager.config.set(option.id, !config[option.id]);
            }}
          >
            {option.label}
            {option.shortcut && (
              <div className="ml-auto pl-5 text-mauve11 group-data-[disabled]:text-mauve8 group-data-[highlighted]:text-white">
                {option.shortcut}
              </div>
            )}
          </DropdownMenuCheckboxItem>
        );
      })}
      {isLoggedIn && (
        <DropdownMenuItem
          className="text-xs pl-[25px] select-none p-1"
          onClick={(e) => {
            e.preventDefault();
            if (isReady && ipc) {
              ipc.notify("sign-out");
            }
          }}
        >
          Sign Out from Pencil
        </DropdownMenuItem>
      )}
    </>
  );
}
