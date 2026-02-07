import { Check } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { clamp, type SceneManager } from "@ha/pencil-editor";

export function FontList({
  manager,
  onClick,
  selectedFontName,
}: {
  manager: SceneManager;
  onClick: (fontName: string) => void;
  selectedFontName?: string | null;
}): React.ReactElement {
  const ref = useRef<VirtuosoHandle>(null);
  const availableFonts =
    manager.skiaRenderer.fontManager.getSupportedFontNames();
  const [search, setSearch] = useState("");

  const [currentItemIndex, setCurrentItemIndex] = useState(-1);

  const filteredFonts = useMemo(() => {
    if (!search) return availableFonts;

    const query = search.toLowerCase();
    return availableFonts.filter((font) => font.toLowerCase().includes(query));
  }, [availableFonts, search]);

  const keyDownCallback = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        const newIndex = clamp(
          0,
          e.code === "ArrowUp" ? currentItemIndex - 1 : currentItemIndex + 1,
          filteredFonts.length - 1,
        );

        setCurrentItemIndex(newIndex);
        ref.current?.scrollIntoView({ index: newIndex });
      }

      if (e.code === "Enter" && currentItemIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const fontName = filteredFonts[currentItemIndex];
        if (fontName) {
          onClick(fontName);
        }
      }
    },
    [currentItemIndex, filteredFonts, onClick],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
      }
    },
    [],
  );

  return (
    <div className="flex flex-col" onKeyDown={keyDownCallback} role="listbox">
      <input
        type="text"
        placeholder="Search fonts..."
        className="px-3 py-2 text-sm border-b border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none"
        value={search}
        onChange={(e) => {
          setCurrentItemIndex(0);
          ref.current?.scrollToIndex(0);
          setSearch(e.target.value);
        }}
        onKeyDown={onInputKeyDown}
      />
      <Virtuoso
        ref={ref}
        style={{ height: "300px" }}
        totalCount={filteredFonts.length}
        itemContent={(index) => {
          const fontName = filteredFonts[index];
          const isSelected = fontName === selectedFontName;
          const isFocused = index === currentItemIndex;
          return (
            <button
              type="button"
              className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                isFocused ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
              onClick={() => onClick(fontName)}
              onMouseEnter={() => setCurrentItemIndex(index)}
            >
              <span>{fontName}</span>
              {isSelected && <Check className="w-4 h-4" />}
            </button>
          );
        }}
      />
    </div>
  );
}
