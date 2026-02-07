import { clamp, type SceneManager } from "@ha/pencil-editor";
import { lookupIconSet } from "@ha/pencil-editor/src/managers/icon-manager";
import Fuse from "fuse.js";
import { Check } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { VirtuosoGrid, type VirtuosoGridHandle } from "react-virtuoso";

export function IconList({
  manager,
  family,
  onClick,
  selectedIconName,
}: {
  manager: SceneManager;
  family: string;
  onClick: (iconName: string) => void;
  selectedIconName?: string | null;
}): React.ReactElement {
  const ref = useRef<VirtuosoGridHandle>(null);
  const [search, setSearch] = useState("");
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);

  const fuzzySearchIndex = useMemo(() => {
    const iconSet = lookupIconSet(family);
    if (iconSet) {
      return new Fuse(iconSet.list, {
        keys: ["name"],
        threshold: 0.4,
      });
    }
  }, [family]);

  const filteredIcons = useMemo(() => {
    // NOTE(sedivy): Return the whole list when there's no search query.
    if (!search) {
      return lookupIconSet(family)?.list ?? [];
    }

    return fuzzySearchIndex?.search(search).map((result) => result.item) ?? [];
  }, [fuzzySearchIndex, family, search]);

  const matchedFont = useMemo(() => {
    const match = manager.skiaRenderer.fontManager.matchFont(
      family,
      200,
      false,
    );
    if (match) {
      manager.skiaRenderer.fontManager.loadFont(match);
    }

    return match;
  }, [family, manager]);

  const keyDownCallback = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const columnsPerRow = 6;

      if (e.code === "ArrowUp") {
        e.preventDefault();
        const newIndex = clamp(
          0,
          currentItemIndex - columnsPerRow,
          filteredIcons.length - 1,
        );
        setCurrentItemIndex(newIndex);
        ref.current?.scrollToIndex({ index: newIndex, behavior: "auto" });
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const newIndex = clamp(
          0,
          currentItemIndex + columnsPerRow,
          filteredIcons.length - 1,
        );
        setCurrentItemIndex(newIndex);
        ref.current?.scrollToIndex({ index: newIndex, behavior: "auto" });
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const newIndex = clamp(
          0,
          currentItemIndex - 1,
          filteredIcons.length - 1,
        );
        setCurrentItemIndex(newIndex);
        ref.current?.scrollToIndex({ index: newIndex, behavior: "auto" });
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const newIndex = clamp(
          0,
          currentItemIndex + 1,
          filteredIcons.length - 1,
        );
        setCurrentItemIndex(newIndex);
        ref.current?.scrollToIndex({ index: newIndex, behavior: "auto" });
      }

      if (e.code === "Enter" && currentItemIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const icon = filteredIcons[currentItemIndex];
        if (icon) {
          onClick(icon.name);
        }
      }
    },
    [currentItemIndex, filteredIcons, onClick],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight"
      ) {
        e.preventDefault();
      }
    },
    [],
  );

  if (!matchedFont) {
    return (
      <div className="p-4 text-sm text-red-500">Failed to load {family}.</div>
    );
  }

  return (
    <div className="flex flex-col" onKeyDown={keyDownCallback} role="listbox">
      <input
        ref={(r) => {
          r?.focus();
        }}
        type="text"
        placeholder="Search icons..."
        className="px-3 py-2 text-sm border-b border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none"
        value={search}
        onChange={(e) => {
          setCurrentItemIndex(0);
          ref.current?.scrollToIndex({ index: 0, behavior: "auto" });
          setSearch(e.target.value);
        }}
        onKeyDown={onInputKeyDown}
      />

      <div className="text-xs text-zinc-500 px-3 py-1 border-b border-zinc-200 dark:border-zinc-700">
        {filteredIcons.length} {filteredIcons.length === 1 ? "icon" : "icons"}
      </div>

      <VirtuosoGrid
        ref={ref}
        style={{ height: "300px", width: "320px" }}
        totalCount={filteredIcons.length}
        listClassName="grid grid-cols-6 gap-1 p-2"
        itemClassName="flex"
        itemContent={(index) => {
          const icon = filteredIcons[index];
          const isSelected = icon.name === selectedIconName;
          const isFocused = index === currentItemIndex;

          return (
            <button
              type="button"
              className={`relative w-10 h-10 flex items-center justify-center rounded transition-colors ${
                isFocused
                  ? "bg-zinc-200 dark:bg-zinc-700"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
              onClick={() => onClick(icon.name)}
              onMouseEnter={() => setCurrentItemIndex(index)}
              title={icon.name}
            >
              <span
                style={{
                  fontFamily: matchedFont.key(),
                }}
                className="text-2xl leading-none"
              >
                {icon.codepoint != null
                  ? String.fromCodePoint(icon.codepoint)
                  : icon.name}
              </span>
              {isSelected && (
                <Check className="absolute top-0.5 right-0.5 w-3 h-3 text-blue-500" />
              )}
            </button>
          );
        }}
      />
    </div>
  );
}
