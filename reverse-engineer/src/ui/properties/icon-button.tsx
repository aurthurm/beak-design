import * as React from "react";
import { cn } from "../../lib/utils";

export function IconButton({
  onClick,
  icon,
  className,
  ...props
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ElementType;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-1 rounded-sm transition-colors",
        props.disabled && "opacity-50",
        !props.disabled && "hover:bg-zinc-200 dark:hover:bg-zinc-600",
        className,
      )}
      title="Edit corners individually"
      {...props}
    >
      {React.createElement(icon, { size: 14, className: "opacity-70" })}
    </button>
  );
}
