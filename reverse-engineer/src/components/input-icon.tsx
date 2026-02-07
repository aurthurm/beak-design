import {
  type Single,
  type Value,
  Variable,
  type VariableType,
} from "@ha/pencil-editor";
import { DiamondIcon, DiamondMinusIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import type { ValueWithResolved } from "../ui/properties/properties-compute";
import { ColorPicker } from "./color-picker";
import { DraggableIcon } from "./draggable-icon";
import { useAvailableVariableTypes, VariablePicker } from "./variable-picker";

export type InputIconProps<
  T extends Exclude<VariableType, "boolean"> | undefined,
  V = Value<NonNullable<T>>,
> = {
  allowArrowKeysChange?: boolean;

  variables?: T;
  value:
    | "Mixed"
    | (undefined extends T ? number | string : ValueWithResolved<V>);
  onCommit?: (
    value:
      | string
      | (undefined extends T ? never : Variable<NonNullable<T>> | undefined),
  ) => void;
  onCommitDelta?: (value: number, round: boolean) => void;
  onMouseDown?: () => void;

  icon?: React.ReactNode;
  letter?: string;
  isSwatch?: boolean;
  iconPosition?: "left" | "right";
  iconClassName?: string;
  wrapperClassName?: string;
  suffix?: string;

  className?: string;
  disabled?: boolean;
  placeholder?: string;
  readOnly?: boolean;

  draggable?: boolean;
  step?: number;
  stepMultiplier?: number;
  stepDistance?: number;

  displayVariableName?: boolean;
  transparent?: boolean;

  inputRef?: React.Ref<HTMLInputElement>;
};

export function InputIcon<
  T extends Single<Exclude<VariableType, "boolean"> | undefined> = undefined,
  V = Value<NonNullable<T>>,
>(props: InputIconProps<T, V>) {
  const {
    icon: iconProp,
    letter,
    isSwatch,
    iconPosition = "left",
    iconClassName,
    wrapperClassName,
    variables,
    value: initialValue,
    onCommit,
    onCommitDelta,
    step = 1,
    stepMultiplier = 10,
    stepDistance = 2,
    suffix,
    inputRef,
    draggable = true,
    displayVariableName,
    transparent,
    readOnly,
    onMouseDown,
    placeholder,
  } = props;

  const initialDisplayValue =
    typeof initialValue === "string" || typeof initialValue === "number"
      ? initialValue
      : initialValue.resolved;
  const variable =
    typeof initialValue === "object" && initialValue.value instanceof Variable
      ? initialValue.value
      : undefined;

  const wasFocusedThisClick = useRef(false);
  const [localValue, setLocalValue] = useState("");
  const availableVariableTypes = useAvailableVariableTypes();

  const [isHovered, setIsHovered] = useState(false);
  const handleOnMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleOnMouseLeave = useCallback(() => setIsHovered(false), []);
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(false);

  useEffect(() => {
    let display;

    if (typeof initialDisplayValue === "number") {
      display = String(Number(initialDisplayValue.toFixed(2)));
    } else {
      display = String(initialDisplayValue);
    }

    if (suffix) {
      display += suffix;
    }

    setLocalValue(display);
  }, [initialDisplayValue, suffix]);

  const swatchStyle: React.CSSProperties = isSwatch
    ? typeof initialDisplayValue === "string" && initialDisplayValue !== "Mixed"
      ? {
          backgroundColor: initialDisplayValue,
          // Add a checkerboard pattern for transparency visualization if alpha < 1
          ...(initialDisplayValue.length === 9 &&
          initialDisplayValue.startsWith("#") &&
          parseInt(initialDisplayValue.slice(7, 9), 16) < 255
            ? {
                backgroundImage: `
                  linear-gradient(45deg, #ccc 25%, transparent 25%),
                  linear-gradient(-45deg, #ccc 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #ccc 75%),
                  linear-gradient(-45deg, transparent 75%, #ccc 75%)
                `,
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
              }
            : {}),
        }
      : {}
    : {};

  const swatchElement =
    isSwatch && initialDisplayValue !== "Mixed" ? (
      <div
        className="w-4 h-4 rounded-[4px] border border-input"
        style={swatchStyle}
      />
    ) : isSwatch && initialDisplayValue === "Mixed" ? (
      <div className="w-4 h-4 rounded-[4px] border border-input italic text-muted-foreground text-[8px] flex items-center justify-center">
        Mix
      </div>
    ) : null;

  const letterElement =
    letter && !iconProp && !swatchElement ? (
      <span className="font-medium select-none opacity-60">
        {letter.slice(0, 1)}
      </span>
    ) : null;

  const visualElement = swatchElement || letterElement || iconProp;

  const hasVisualElement = Boolean(visualElement);

  const Adornment = (
    <div
      className={cn(
        "absolute w-6 h-6 flex items-center justify-center text-xxs",
        iconPosition === "left" ? "left-0" : "right-0",
      )}
    >
      {isSwatch ? (
        <ColorPicker
          value={String(initialDisplayValue)}
          onCommit={onCommit}
          className={cn("text-muted-foreground", iconClassName)}
        >
          {visualElement}
        </ColorPicker>
      ) : draggable ? (
        <DraggableIcon
          value={localValue}
          onCommit={onCommit}
          onCommitDelta={onCommitDelta}
          suffix={suffix}
          step={step}
          stepMultiplier={stepMultiplier}
          stepDistance={stepDistance}
          draggable={props.allowArrowKeysChange && !props.disabled && !readOnly}
          className={cn(
            !swatchElement && "text-muted-foreground",
            iconClassName,
          )}
        >
          {visualElement}
        </DraggableIcon>
      ) : (
        visualElement
      )}
    </div>
  );

  const popoverAnchorRef = useRef<HTMLDivElement>(null!);
  const showVariablePicker =
    (isHovered || isVariablePickerOpen || variable) &&
    variables &&
    availableVariableTypes.has(variables);
  const VariableIcon = variable ? DiamondMinusIcon : DiamondIcon;
  const VariableButton = showVariablePicker ? (
    <VariablePicker
      variables={variables}
      selectedVariable={variable}
      onCommit={onCommit as any}
      onOpenChange={setIsVariablePickerOpen}
      className={cn(
        "absolute w-5 h-6 flex items-center justify-center",
        iconPosition === "left" ? "right-0" : "left-0",
      )}
      anchorRef={popoverAnchorRef}
    >
      <VariableIcon
        className={cn(
          "w-4 h-4 p-0.5 rounded-[4px]",
          variable
            ? `${isHovered || isVariablePickerOpen ? "text-[#D480FF]" : "text-[#674578]"} hover:bg-[#674578] hover:text-[#D480FF]`
            : "text-secondary-foreground hover:bg-input hover:text-sidebar-accent-foreground",
        )}
      />
    </VariablePicker>
  ) : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value !== initialDisplayValue) {
      onCommit?.(e.target.value);
    }
    wasFocusedThisClick.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    wasFocusedThisClick.current = document.activeElement !== e.currentTarget;

    onMouseDown?.();
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (
      wasFocusedThisClick.current &&
      e.currentTarget.selectionStart === e.currentTarget.selectionEnd
    ) {
      e.currentTarget.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    }

    if (
      props.allowArrowKeysChange &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      e.preventDefault();

      const direction = e.key === "ArrowUp" ? 1 : -1;

      const delta = direction * step * (e.shiftKey ? stepMultiplier : 1);

      if (onCommitDelta) {
        onCommitDelta(delta, false);
      } else {
        // NOTE(sedivy): If we don't have onCommitDelta for incremental changes
        // then use the fallback onCommit that sets the full value.
        const float = parseFloat(localValue);
        if (!Number.isNaN(float)) {
          onCommit?.(String(float + delta) + (suffix ?? ""));
        }
      }
    }
  };

  const className = cn(
    "font-mono  placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 items-center h-9 rounded-sm pb-[1px] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:border-[#3D99FF] focus-visible:ring-1 focus-visible:ring-[#3D99FF]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    "px-2",
    transparent ? "bg-transparent" : "bg-muted",
    hasVisualElement &&
      (iconPosition === "left"
        ? isSwatch || iconProp
          ? "pl-6"
          : "pl-5"
        : isSwatch || iconProp
          ? "pr-6"
          : "pr-5"),
    VariableButton && (iconPosition === "left" ? "pr-5" : "pr-6"),

    isSwatch && "select-none cursor-default",
    props.className,
  );

  return (
    <div
      ref={popoverAnchorRef}
      className={cn("relative", wrapperClassName)}
      onMouseEnter={handleOnMouseEnter}
      onMouseLeave={handleOnMouseLeave}
    >
      {hasVisualElement ? Adornment : null}
      {VariableButton}

      {displayVariableName && variable ? (
        <div className={className} onMouseDown={onMouseDown}>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
            {variable.name}
          </span>
        </div>
      ) : readOnly ? (
        <div className={className} onMouseDown={onMouseDown}>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
            {localValue}
          </span>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          data-slot="input"
          className={className}
          disabled={props.disabled}
        />
      )}
    </div>
  );
}
