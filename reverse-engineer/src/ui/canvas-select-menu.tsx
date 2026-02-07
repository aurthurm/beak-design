import React, { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../components/select";
import { useSceneManager } from "../pages/Editor";

export function CanvasSelectMenu() {
  const manager = useSceneManager();

  const [data, setData] = React.useState<{
    x: number;
    y: number;
    options: { value: string; label: string }[];
    onSelect: (value: string) => void;
    currentValue: string | null;
  } | null>(null);

  useEffect(() => {
    function callback(data: {
      x: number;
      y: number;
      options: { value: string; label: string }[];
      onSelect: (value: string) => void;
      currentValue: string | null;
    }) {
      setData(data);
    }

    manager.eventEmitter.on("showSelectUI", callback);

    return () => {
      manager.eventEmitter.off("showSelectUI", callback);
    };
  }, [manager]);

  return data ? (
    <Select
      open={data != null}
      value={data.currentValue ?? ""}
      onOpenChange={(open) => {
        if (!open) {
          setData(null);
        }
      }}
      onValueChange={(value) => {
        data.onSelect(value);
      }}
    >
      <SelectTrigger style={{ display: "none" }} />
      <SelectContent style={{ left: data.x, top: data.y }}>
        {data.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;
}
