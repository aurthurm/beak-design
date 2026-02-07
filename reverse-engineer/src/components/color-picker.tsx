import { Pipette } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import { RgbaColorPicker } from "react-colorful";
import { cn } from "../lib/utils";
import {
  cssToRgba,
  type HsbColor,
  type HslColor,
  hexToRgba,
  hsbToRgba,
  hslToRgba,
  type RgbaColor,
  rgbaToCss,
  rgbaToHex,
  rgbaToHsb,
  rgbaToHsl,
} from "../utils/color-utils";
import { clamp } from "@ha/pencil-editor";
import { InputIcon } from "./input-icon";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface ColorPickerProps {
  value: string | null | "Mixed";
  onCommit?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

// NOTE(sedivy): The values are persisted in localStorage. Do not change them.
export enum ColorFormat {
  Rgba = 1,
  Hex = 2,
  Css = 3,
  Hsl = 4,
  Hsb = 5,
}

function getPreferredColorFormat(): ColorFormat {
  const saved = localStorage.getItem("color-picker-format");
  if (saved) {
    const parsed = Number(saved);
    if (Object.values(ColorFormat).includes(parsed)) {
      return parsed as ColorFormat;
    }
  }

  return ColorFormat.Rgba;
}

function setPreferredColorFormat(format: ColorFormat) {
  localStorage.setItem("color-picker-format", format.toString());
}

export interface ColorPickerControlsProps {
  value: string;
  onChange: (value: string) => void;
  size?: number;
}

export function ColorPickerControls({
  value,
  onChange,
  size = 200,
}: ColorPickerControlsProps) {
  const [rgbaColor, setRgbaColor] = useState(hexToRgba(value));
  const [colorFormat, setColorFormat] = useState<ColorFormat>(
    getPreferredColorFormat(),
  );

  useEffect(() => {
    setRgbaColor(hexToRgba(value));
  }, [value]);

  const handleRgbaChange = (newRgba: RgbaColor) => {
    const newValue = rgbaToHex(newRgba, true);
    setRgbaColor(newRgba);
    onChange(newValue);
  };

  const handleInputChange = (component: keyof RgbaColor, value: string) => {
    const number = parseInt(value, 10);
    if (!Number.isNaN(number)) {
      handleRgbaChange({ ...rgbaColor, [component]: clamp(0, number, 255) });
    }
  };

  const handleAlphaChange = (value: string) => {
    const number = parseFloat(value);
    if (!Number.isNaN(number)) {
      handleRgbaChange({ ...rgbaColor, a: clamp(0, number, 1) });
    }
  };

  const handleHexChange = (value: string) => {
    const hex = value.startsWith("#") ? value : `#${value}`;
    handleRgbaChange(hexToRgba(hex));
  };

  const handleCssChange = (value: string) => {
    handleRgbaChange(cssToRgba(value));
  };

  const handleHslChange = (component: keyof HslColor, value: string) => {
    const hsl = rgbaToHsl(rgbaColor);
    const numValue = parseFloat(value) || 0;
    let clampedValue = numValue;

    if (component === "h") {
      clampedValue = Math.max(0, Math.min(360, numValue));
    } else if (component === "s" || component === "l") {
      clampedValue = Math.max(0, Math.min(100, numValue));
    } else if (component === "a") {
      clampedValue = Math.max(0, Math.min(1, numValue));
    }

    const newHsl = { ...hsl, [component]: clampedValue };
    const newRgba = hslToRgba(newHsl);
    handleRgbaChange(newRgba);
  };

  const handleHsbChange = (component: keyof HsbColor, value: string) => {
    const hsb = rgbaToHsb(rgbaColor);
    const numValue = parseFloat(value) || 0;
    let clampedValue = numValue;

    if (component === "h") {
      clampedValue = Math.max(0, Math.min(360, numValue));
    } else if (component === "s" || component === "b") {
      clampedValue = Math.max(0, Math.min(100, numValue));
    } else if (component === "a") {
      clampedValue = Math.max(0, Math.min(1, numValue));
    }

    const newHsb = { ...hsb, [component]: clampedValue };
    const newRgba = hsbToRgba(newHsb);
    handleRgbaChange(newRgba);
  };

  const handleEyeDropper = async () => {
    try {
      if ("EyeDropper" in window) {
        const EyeDropperConstructor = (
          window as unknown as {
            EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
          }
        ).EyeDropper;
        const eyeDropper = new EyeDropperConstructor();
        const result = await eyeDropper.open();
        const newRgba = hexToRgba(result.sRGBHex);
        handleRgbaChange(newRgba);
      } else {
        console.warn("EyeDropper API not supported in this browser");
      }
    } catch (error) {
      console.error("EyeDropper error:", error);
    }
  };

  const renderInputFields = () => {
    switch (colorFormat) {
      case ColorFormat.Rgba:
        return (
          <div className="grid grid-cols-4 gap-[2px]">
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={rgbaColor.r}
                onCommit={(value) => handleInputChange("r", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={rgbaColor.g}
                onCommit={(value) => handleInputChange("g", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={rgbaColor.b}
                onCommit={(value) => handleInputChange("b", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                step={0.01}
                value={rgbaColor.a}
                onCommit={(value) => handleAlphaChange(value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
          </div>
        );

      case ColorFormat.Hex:
        return (
          <div className="flex flex-col gap-1">
            <InputIcon
              value={rgbaToHex(rgbaColor, rgbaColor.a < 1)}
              onCommit={(value) => handleHexChange(value)}
              className="w-20 h-6 text-xxs font-mono"
            />
          </div>
        );

      case ColorFormat.Css:
        return (
          <div className="flex flex-col gap-1">
            <InputIcon
              value={rgbaToCss(rgbaColor)}
              onCommit={(value) => handleCssChange(value)}
              className="w-42 h-6 text-xxs font-mono"
            />
          </div>
        );

      case ColorFormat.Hsl: {
        const hslColor = rgbaToHsl(rgbaColor);
        return (
          <div className="grid grid-cols-4 gap-[2px]">
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hslColor.h}
                onCommit={(value) => handleHslChange("h", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hslColor.s}
                onCommit={(value) => handleHslChange("s", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hslColor.l}
                onCommit={(value) => handleHslChange("l", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                step={0.01}
                value={hslColor.a}
                onCommit={(value) => handleHslChange("a", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
          </div>
        );
      }

      case ColorFormat.Hsb: {
        const hsbColor = rgbaToHsb(rgbaColor);
        return (
          <div className="grid grid-cols-4 gap-[2px]">
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hsbColor.h}
                onCommit={(value) => handleHsbChange("h", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hsbColor.s}
                onCommit={(value) => handleHsbChange("s", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                value={hsbColor.b}
                onCommit={(value) => handleHsbChange("b", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <InputIcon
                allowArrowKeysChange
                step={0.01}
                value={hsbColor.a}
                onCommit={(value) => handleHsbChange("a", value)}
                className="w-12 h-6 text-xxs"
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <style>{`
        .custom-picker .react-colorful {
          width: ${size}px;
          height: ${size}px;
        }

        .custom-picker .react-colorful__saturation-pointer {
          width: 14px;
          height: 14px;
          border-width:3px;
        }
        .custom-picker .react-colorful {
          border-radius: 4px;
        }

        .custom-picker .react-colorful__hue {
          margin-bottom: 6px;
        }

        .custom-picker .react-colorful__saturation {
          margin-bottom: 6px;
          border-radius: 6px;
          border-bottom: none;
        }
        .custom-picker .react-colorful__hue,
        .custom-picker .react-colorful__alpha {
          height: 16px;
          border-radius: 10px;
        }

        .custom-picker .react-colorful__hue-pointer,
        .custom-picker .react-colorful__alpha-pointer {
          width: 14px;
          height: 14px;
          border-width:3px;
        }
      `}</style>
      <div className="flex flex-col gap-3">
        <div className="custom-picker">
          <RgbaColorPicker
            color={rgbaColor}
            onChange={(value) => {
              handleRgbaChange(value);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEyeDropper}
            className="flex items-center justify-center w-6 h-6 rounded-sm border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Pick color from screen"
          >
            <Pipette className="w-3 h-3" />
          </button>
          <Select
            value={colorFormat.toString()}
            onValueChange={(value: string) => {
              const format = Number(value) as ColorFormat;
              setColorFormat(format);
              setPreferredColorFormat(format);
            }}
          >
            <SelectTrigger className="w-15 m-0 gap-0 h-6 text-xxs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ColorFormat.Rgba.toString()}>RGBA</SelectItem>
              <SelectItem value={ColorFormat.Hex.toString()}>HEX</SelectItem>
              <SelectItem value={ColorFormat.Css.toString()}>CSS</SelectItem>
              <SelectItem value={ColorFormat.Hsl.toString()}>HSL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-left">{renderInputFields()}</div>
      </div>
    </>
  );
}

export const ColorPicker = React.forwardRef<
  HTMLButtonElement,
  ColorPickerProps
>(({ value: initialValue, onCommit, children, className }, ref) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const effectiveValue =
    initialValue == null || initialValue === "Mixed"
      ? "#000000ff"
      : initialValue;

  return (
    <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          tabIndex={-1}
          className={cn("pointer-events-auto", className)}
          data-slot="visual-adornment"
          onClick={() => setIsPickerOpen(true)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 border-1 shadow-lg bg-popover rounded-lg">
        <ColorPickerControls
          value={effectiveValue}
          onChange={(value) => onCommit?.(value)}
        />
      </PopoverContent>
    </Popover>
  );
});
ColorPicker.displayName = "ColorPicker";
