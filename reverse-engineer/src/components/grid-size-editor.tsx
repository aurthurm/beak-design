import { memo, useState } from "react";
import { SectionTitle } from "../ui/section-title";

export const GridSizeEditor = memo(function GridSizeEditor({
  max,
  columns,
  rows,
  onSelect,
}: {
  max: number;
  columns: number;
  rows: number;
  onSelect: (width: number, height: number) => void;
}) {
  const [hoverGridSize, setHoverGridSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const displaySize = hoverGridSize ?? { width: columns, height: rows };

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <SectionTitle title="Grid Size" />
      <div className="text-xxs text-muted-foreground text-center">
        {displaySize.width} × {displaySize.height}
      </div>
      <div
        className="inline-grid p-0.5 border border-input rounded bg-background"
        style={{
          gridTemplateColumns: `repeat(${max}, 24px)`,
          gridTemplateRows: `repeat(${max}, 24px)`,
        }}
        onMouseLeave={() => setHoverGridSize(null)}
      >
        {Array.from({ length: max * max }).map((_, index) => {
          const col = (index % max) + 1;
          const row = Math.floor(index / max) + 1;

          const isCurrent = col <= columns && row <= rows;
          const isHovered = hoverGridSize
            ? col <= hoverGridSize.width && row <= hoverGridSize.height
            : false;

          return (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: It's a grid
              key={index}
              className="p-0.5 cursor-pointer"
              onMouseEnter={() => {
                setHoverGridSize({ width: col, height: row });
              }}
              onClick={() => {
                onSelect(col, row);
              }}
            >
              <div
                className={`w-full h-full rounded-[2px] border transition-colors ${
                  isHovered ? "border-primary" : "border-muted-foreground/20"
                } ${isCurrent ? "bg-primary/20" : ""}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});
