import type React from "react";

interface KeyboardShortcutProps {
  keys: string | string[];
  className?: string;
}

export const KeyboardShortcut: React.FC<KeyboardShortcutProps> = ({
  keys,
  className = "",
}) => {
  const keyArray = Array.isArray(keys) ? keys : [keys];

  return (
    <>
      {keyArray.map((key) => (
        <span
          key={key}
          className={`rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground ${className}`}
        >
          {key}
        </span>
      ))}
    </>
  );
};
