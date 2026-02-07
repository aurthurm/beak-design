import React from "react";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Button } from "./button";

interface AutoLayoutButtonProps {
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const AutoLayoutButton = React.memo(function AutoLayoutButton({
  active = false,
  onClick,
  className,
}: AutoLayoutButtonProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const strokeColor = colorScheme === "dark" ? "#828282" : "black";

  return (
    <Button variant="ghost" size="icon" className={className} onClick={onClick}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{active ? "Auto layout active" : "Enable auto layout"}</title>
        {/* Common base rectangles */}
        <path
          d="M6.28571 2H2.71429C2.3198 2 2 2.29848 2 2.66667V13.3333C2 13.7015 2.3198 14 2.71429 14H6.28571C6.6802 14 7 13.7015 7 13.3333V2.66667C7 2.29848 6.6802 2 6.28571 2Z"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.2857 2H9.71429C9.3198 2 9 2.3198 9 2.71429V6.28571C9 6.6802 9.3198 7 9.71429 7H13.2857C13.6802 7 14 6.6802 14 6.28571V2.71429C14 2.3198 13.6802 2 13.2857 2Z"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Conditional icon: checkmark or plus */}
        {active ? (
          // Checkmark path
          <path
            d="M14 10L10.5625 13.5L9 11.9091"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          // Plus icon
          <>
            <rect
              x="11"
              y="9"
              width="1"
              height="5"
              rx="0.5"
              fill={strokeColor}
            />
            <rect
              x="14"
              y="11"
              width="1"
              height="5"
              rx="0.5"
              transform="rotate(90 14 11)"
              fill={strokeColor}
            />
          </>
        )}
      </svg>
    </Button>
  );
});

export default AutoLayoutButton;
