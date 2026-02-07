import type { PopoverAnchorProps } from "@radix-ui/react-popover";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Input } from "./input";
import { cn } from "../lib/utils";
import { Check } from "lucide-react";

export interface PopoverPickerProps<T> {
  values: T[];
  selectedValue?: T;
  onFilter?: (searchTerm: string, value: T) => boolean;
  onCommit?: (value?: T) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  valueKey: (value: T) => string;
  valueLabel: (value: T) => string;
  children: React.ReactNode;
  className?: string;
  anchorRef?: PopoverAnchorProps["virtualRef"];
  title?: string;
  searchPlaceholder?: string;
  none?: boolean;
}

export function PopoverPicker<T>({
  values,
  selectedValue,
  onFilter,
  onCommit,
  open,
  onOpenChange,
  children,
  className,
  anchorRef,
  title,
  searchPlaceholder,
  none,
  valueKey,
  valueLabel,
}: PopoverPickerProps<T>) {
  const [search, setSearch] = useState("");

  const filteredValues = useMemo(() => {
    const filtered =
      search.length === 0 || !onFilter
        ? values
        : values.filter((value) => onFilter(search, value));
    return none ? [undefined, ...filtered] : filtered;
  }, [search, onFilter, values, none]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        virtualRef={
          anchorRef && {
            // NOTE(zaza): PopoverAnchor.virtualRef is broken and doesn't work right with memoized values -
            // it requires a new instance to trigger a re-render to work correctly.
            current: {
              getBoundingClientRect: () =>
                anchorRef.current.getBoundingClientRect(),
            },
          }
        }
      />
      <PopoverTrigger asChild>
        <button className={className} type="button" title={title}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-0 overflow-auto"
        side="right"
        align="center"
        sideOffset={20}
      >
        {onFilter && (
          <Input
            type="text"
            placeholder={searchPlaceholder ?? "Search..."}
            className="rounded-none border-x-0 border-t-0"
            style={{ outline: "none", boxShadow: "none" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <div className="max-h-[300px]">
          {filteredValues.map((value, index) => {
            const isSelected = value === selectedValue;
            return (
              <button
                key={none && index === 0 ? "none" : `value-${valueKey(value!)}`}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm flex items-center justify-between",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-700",
                  none &&
                    index === 0 &&
                    "border-b border-zinc-200 dark:border-zinc-700",
                )}
                onClick={() => onCommit?.(value)}
              >
                <span>{none && index === 0 ? "None" : valueLabel(value!)}</span>
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
