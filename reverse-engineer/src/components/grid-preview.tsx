import { memo, useCallback, useState } from "react";
import { GridSizeEditor } from "./grid-size-editor";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export const GridPreview = memo(function GridPreview({
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
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (width: number, height: number) => {
      onSelect(width, height);
      setIsOpen(false);
    },
    [onSelect],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative w-full h-full border border-input rounded bg-background hover:bg-muted transition-colors cursor-pointer"
        >
          <div className="absolute inset-1 flex flex-col gap-0.5">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: It's a grid
              <div key={rowIndex} className="flex-1 flex gap-0.5">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: It's a grid
                    key={colIndex}
                    className="flex-1 rounded-[2px] border border-muted-foreground/20"
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xxs font-medium px-1 rounded">
              {columns} × {rows}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-2"
        side="top"
        align="center"
        collisionPadding={8}
        style={{ width: "max-content" }}
      >
        <GridSizeEditor
          max={max}
          columns={columns}
          rows={rows}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
});
