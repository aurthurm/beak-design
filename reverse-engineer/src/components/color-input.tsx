import {
  canonicalizeHexColor,
  clamp,
  colorToHex,
  hexToColor,
  type Value,
  Variable,
} from "@ha/pencil-editor";
import React, { useCallback } from "react";
import { cn } from "../lib/utils";
import { InputIcon } from "./input-icon";

export const ColorInput = React.memo(function ColorInput({
  value,
  resolved,
  onChange,
  className,
}: {
  value: Value<"color">;
  resolved: string;
  disabled?: boolean;
  onChange: (value: Value<"color">) => void;
  className?: string;
}) {
  const isVariable = typeof value === "object" && value instanceof Variable;

  const onCommitColor = useCallback(
    (value: string | Value<"color"> | undefined) => {
      if (typeof value === "string") {
        value = canonicalizeHexColor(value);
      }

      onChange(value ?? resolved);
    },
    [onChange, resolved],
  );

  const onCommitAlpha = useCallback(
    (value: string) => {
      const float = parseFloat(value);
      if (!Number.isNaN(float)) {
        const color = hexToColor(resolved);
        color[3] = clamp(0, float / 100, 1);

        onChange(colorToHex(color));
      }
    },
    [onChange, resolved],
  );

  return (
    <div className={cn("w-36 flex text-xxs", className)}>
      <InputIcon
        wrapperClassName="w-full"
        className={`h-6 text-xxs border border-input ${isVariable ? "rounded-sm" : "rounded-l-sm rounded-r-none"}`}
        isSwatch={true}
        variables="color"
        displayVariableName
        value={{
          value: value,
          resolved: resolved,
        }}
        onCommit={onCommitColor}
      />

      {!isVariable && resolved !== "Mixed" && (
        <InputIcon
          className="h-6 text-xxs w-13 border border-l-0 border-input rounded-r-sm rounded-l-none"
          allowArrowKeysChange
          letter="%"
          iconPosition="right"
          value={Math.round(hexToColor(resolved)[3] * 100)}
          onCommit={onCommitAlpha}
        />
      )}
    </div>
  );
});
