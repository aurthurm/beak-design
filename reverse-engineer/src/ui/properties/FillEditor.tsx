import {
  type ColorFill,
  type ColorStop,
  clamp,
  colorToHex,
  type Fill,
  FillType,
  type GradientFill,
  hexToColor,
  type ImageFill,
  inverseLerp,
  lerp,
  type MeshGradientFill,
  type MeshGradientPoint,
  type Resolved,
  remap,
  StretchMode,
  type Value,
  type Variable,
} from "@ha/pencil-editor";
import { logger } from "@ha/shared";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Minus, Plus } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { ColorInput } from "@/src/components/color-input";
import {
  ColorFillIcon,
  GradientFillIcon,
  ImageFillIcon,
} from "@/src/components/icons";
import { ColorPickerControls } from "../../components/color-picker";
import { InputIcon } from "../../components/input-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/tooltip";
import { getIPC } from "../../lib/ipc-singleton";
import { imageFilePicker } from "../../lib/utils";
import { SectionTitle } from "../section-title";
import { FillMeshGradient } from "./FillMeshGradient";
import { IconButton } from "./icon-button";
import type { ValueWithResolved } from "./properties-compute";

function createColorStopForPosition(
  stops: Resolved<ReadonlyArray<ColorStop>>,
  position: number,
): ColorStop {
  const sortedStops = stops.toSorted((a, b) => a.position - b.position);

  let interpolatedColor = "#000000ff";

  if (sortedStops.length === 1) {
    const existing = sortedStops[0];
    const color = hexToColor(existing.color);
    const mode = Math.max(color[0], color[1], color[2]) > 0.5 ? -1 : 1;
    const amount = (mode * 150) / 255;
    const adjustedColor: [number, number, number, number] = [
      clamp(0, color[0] + amount, 1),
      clamp(0, color[1] + amount, 1),
      clamp(0, color[2] + amount, 1),
      color[3],
    ];

    interpolatedColor = colorToHex(adjustedColor);
  }

  if (sortedStops.length >= 2) {
    if (position < sortedStops[0].position) {
      interpolatedColor = sortedStops[0].color;
    } else if (position > sortedStops[sortedStops.length - 1].position) {
      interpolatedColor = sortedStops[sortedStops.length - 1].color;
    } else {
      for (let i = 0; i < sortedStops.length - 1; i++) {
        const a = sortedStops[i];
        const b = sortedStops[i + 1];

        if (position >= a.position && position <= b.position) {
          const t = inverseLerp(a.position, b.position, position);
          const aColor = hexToColor(a.color);
          const bColor = hexToColor(b.color);

          interpolatedColor = colorToHex([
            lerp(aColor[0], bColor[0], t),
            lerp(aColor[1], bColor[1], t),
            lerp(aColor[2], bColor[2], t),
            lerp(aColor[3], bColor[3], t),
          ]);
          break;
        }
      }
    }
  }

  return { position, color: interpolatedColor };
}

function GradientBar({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<GradientFill>;
  onChange: (fill: Fill) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggedIndex(index);
    },
    [],
  );

  const handleMouseMove = useEffectEvent((e: MouseEvent) => {
    if (draggedIndex == null || draggedIndex >= fill.value.stops.length) {
      return;
    }

    const bar = barRef.current;
    if (!bar) {
      return;
    }

    const rect = bar.getBoundingClientRect();

    const position =
      Math.round(
        clamp(0, remap(e.clientX - rect.left, 0, rect.width, 0, 1), 1) * 100,
      ) / 100;

    const stops = [...fill.value.stops];

    stops[draggedIndex] = {
      ...stops[draggedIndex],
      position,
    };

    onChange({ ...fill.value, stops });
  });

  const handleMouseUp = useEffectEvent(() => {
    setDraggedIndex(null);
  });

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      const bar = e.currentTarget;
      const rect = bar.getBoundingClientRect();

      const position =
        Math.round(
          clamp(0, remap(e.clientX - rect.left, 0, rect.width, 0, 1), 1) * 100,
        ) / 100;

      const stop = createColorStopForPosition(fill.resolved.stops, position);

      const stops = [...fill.value.stops, stop];

      onChange({ ...fill.value, stops });
      setDraggedIndex(stops.indexOf(stop));
    },
    [fill, onChange],
  );

  useEffect(() => {
    if (draggedIndex !== null) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggedIndex]);

  const gradientStyle = useMemo(() => {
    const stops = fill.resolved.stops
      .toSorted((a, b) => a.position - b.position)
      .map((stop) => `${stop.color} ${(stop.position * 100).toFixed(1)}%`)
      .join(", ");

    return {
      backgroundImage: `linear-gradient(to right, ${stops}), linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
      backgroundSize: `100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px`,
      backgroundPosition: `0 0, 0 0, 0 4px, 4px -4px, -4px 0`,
      backgroundColor: "#fff",
    };
  }, [fill.resolved.stops]);

  return (
    <div className="relative pt-3">
      <div
        ref={barRef}
        className="relative h-6 rounded border border-input"
        style={gradientStyle}
        onMouseDown={handleBarMouseDown}
      />
      {fill.resolved.stops.map((stop, index) => (
        <div
          key={index}
          className="absolute"
          style={{
            left: `${stop.position * 100}%`,
            top: "0",
            transform: "translateX(-50%)",
          }}
          onMouseDown={handleMouseDown(index)}
        >
          <div
            className="w-5 h-5 rounded border-2 border-border"
            style={{
              backgroundColor: "#fff",
              backgroundImage: `linear-gradient(to right, ${stop.color}, ${stop.color}), linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
              backgroundSize: `100% 100%, 4px 4px, 4px 4px, 4px 4px, 4px 4px`,
              backgroundPosition: `0 0, 0 0, 0 2px, 2px -2px, -2px 0`,
            }}
          />
          <div className="w-0 h-0 mx-auto border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-border" />
        </div>
      ))}
    </div>
  );
}

function ColorStopList({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<GradientFill>;
  onChange: (fill: Fill) => void;
}) {
  // NOTE(sedivy): We have two parallel arrays as an input (value and resolved).
  // In order to display and modify a sorted list we need these two parallel
  // arrays to be sorted in the same way. There is no way to sort two parallel
  // arrays in javascript and we can't directly sort the .value array because it
  // contains variable references. So in order to achieve a sortd list we create
  // an array of indices that represent the sorted order of the stops based on the
  // resolved positions.
  const stopIndices = useMemo(() => {
    const indices = new Array(fill.resolved.stops.length)
      .fill(0)
      .map((_, i) => i);

    indices.sort((a, b) => {
      const stopA = fill.resolved.stops[a];
      const stopB = fill.resolved.stops[b];

      return stopA.position - stopB.position;
    });

    return indices;
  }, [fill.resolved]);

  function renderColorRow(index: number) {
    const value = fill.value.stops[index];
    const resolved = fill.resolved.stops[index];

    return (
      <div key={index} className="flex justify-between">
        <InputIcon
          className="w-12 h-6 text-xxs border border-input"
          stepDistance={40}
          suffix="%"
          variables="number"
          value={{
            value:
              typeof value.position === "number"
                ? value.position * 100
                : value.position,

            resolved: resolved.position * 100,
          }}
          onCommit={(input) => {
            let value;

            if (typeof input === "string") {
              value = parseFloat(input);
              value = Number.isNaN(value) ? 0 : value / 100;
              value = clamp(0, value, 1);
            } else {
              value = input ?? fill.resolved.stops[index].position;
            }

            const newStops = [...fill.value.stops];
            newStops[index] = {
              ...newStops[index],
              position: value,
            };

            onChange({ ...fill.value, stops: newStops });
          }}
        />

        <ColorInput
          value={value.color}
          resolved={resolved.color}
          onChange={(newColor) => {
            const newStops = [...fill.value.stops];

            newStops[index] = {
              ...newStops[index],
              color: newColor,
            };

            onChange({ ...fill.value, stops: newStops });
          }}
        />

        <IconButton
          className={fill.resolved.stops.length <= 1 ? "opacity-0" : ""}
          disabled={fill.resolved.stops.length <= 1}
          icon={Minus}
          onClick={() => {
            const newStops = fill.value.stops.filter((_, i) => i !== index);
            onChange({ ...fill.value, stops: newStops });
          }}
        />
      </div>
    );
  }

  return <>{stopIndices.map(renderColorRow)}</>;
}

function SimpleGradient({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<GradientFill>;
  onChange: (fill: Fill) => void;
}) {
  return (
    <>
      <GradientBar fill={fill} onChange={onChange} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-secondary-foreground">
          <SectionTitle title="Stops" />
          <IconButton
            icon={Plus}
            onClick={() => {
              let stop: ColorStop;

              const existing = fill.resolved.stops;

              if (existing.length === 0) {
                // NOTE(sedivy): No existing stops, add one at position 0.
                stop = { position: 0, color: "#000000ff" };
              } else if (existing.length === 1) {
                // NOTE(sedivy): One existing stop, add one at opposite end.
                const position = existing[0].position <= 0.5 ? 1 : 0;

                stop = createColorStopForPosition(existing, position);
              } else {
                // NOTE(sedivy): Multiple existing stops, add one in the middle
                // of the last two stops.
                const sortedStops = existing.toSorted(
                  (a, b) => a.position - b.position,
                );
                const a = sortedStops[sortedStops.length - 2];
                const b = sortedStops[sortedStops.length - 1];
                const middlePosition =
                  Math.round(lerp(a.position, b.position, 0.5) * 100) / 100;
                stop = createColorStopForPosition(existing, middlePosition);
              }

              const newStops = [...fill.value.stops, stop];

              onChange({ ...fill.value, stops: newStops });
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <ColorStopList fill={fill} onChange={onChange} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <SectionTitle title="Center" />
        <div className="grid gap-1.5 grid-cols-2">
          <InputIcon
            className="h-6 text-xxs border border-input"
            letter="X"
            allowArrowKeysChange
            stepDistance={40}
            suffix="%"
            variables="number"
            value={{
              value:
                typeof fill.value.center[0] === "number"
                  ? fill.value.center[0] * 100
                  : fill.value.center[0],
              resolved: fill.resolved.center[0] * 100,
            }}
            onCommit={(input) => {
              let value;
              if (typeof input === "string") {
                value = parseFloat(input);
                value = Number.isNaN(value) ? 0.5 : value / 100;
              } else {
                value = input ?? fill.resolved.center[0];
              }
              const center = [value, fill.value.center[1]] as [number, number];
              onChange({ ...fill.value, center });
            }}
          />
          <InputIcon
            className="h-6 text-xxs border border-input"
            letter="Y"
            allowArrowKeysChange
            stepDistance={40}
            suffix="%"
            variables="number"
            value={{
              value:
                typeof fill.value.center[1] === "number"
                  ? fill.value.center[1] * 100
                  : fill.value.center[1],
              resolved: fill.resolved.center[1] * 100,
            }}
            onCommit={(input) => {
              let value;
              if (typeof input === "string") {
                value = parseFloat(input);
                value = Number.isNaN(value) ? 0 : value / 100;
              } else {
                value = input ?? fill.resolved.center[1];
              }
              const center = [fill.value.center[0], value] as [number, number];
              onChange({ ...fill.value, center });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <SectionTitle title="Size" />

        <div
          className={`grid gap-1.5 ${fill.resolved.type === FillType.LinearGradient ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {["W", "H"].map((letter, axis) => {
            if (
              letter === "W" &&
              fill.resolved.type === FillType.LinearGradient
            ) {
              // NOTE(sedivy): Don't show width for linear gradients.
              return null;
            }

            return (
              <InputIcon
                key={letter}
                className="h-6 text-xxs border border-input"
                letter={letter}
                allowArrowKeysChange
                stepDistance={40}
                suffix="%"
                variables="number"
                value={{
                  value:
                    typeof fill.value.size[axis] === "number"
                      ? fill.value.size[axis] * 100
                      : fill.value.size[axis],
                  resolved: fill.resolved.size[axis] * 100,
                }}
                onCommit={(input) => {
                  let value;
                  if (typeof input === "string") {
                    value = parseFloat(input);
                    value = Number.isNaN(value) ? 1 : value / 100;
                  } else {
                    value = input ?? fill.resolved.size[axis];
                  }

                  const size: [Value<"number">, Value<"number">] = [
                    ...fill.value.size,
                  ];
                  size[axis] = value;

                  onChange({ ...fill.value, size });
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <SectionTitle title="Rotation" />
        <InputIcon
          className="h-6 text-xxs border border-input"
          letter="R"
          allowArrowKeysChange
          stepDistance={40}
          suffix="°"
          variables="number"
          value={{
            value: fill.value.rotationDegrees,
            resolved: fill.resolved.rotationDegrees,
          }}
          onCommit={(input) => {
            let value;
            if (typeof input === "string") {
              value = parseFloat(input);
              value = Number.isNaN(value) ? 0 : value;
            } else {
              value = input ?? fill.resolved.rotationDegrees;
            }
            onChange({ ...fill.value, rotationDegrees: value });
          }}
        />
      </div>
    </>
  );
}

enum GradientCategory {
  Simple = 1,
  Mesh = 2,
}

function getGradientCategory(type: FillType): GradientCategory {
  switch (type) {
    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
      return GradientCategory.Simple;
    case FillType.MeshGradient:
      return GradientCategory.Mesh;
  }

  return GradientCategory.Simple;
}

function createDefaultSimpleGradient(): GradientFill {
  return {
    type: FillType.LinearGradient,
    enabled: true,
    opacityPercent: 100,
    rotationDegrees: 0,
    center: [0.5, 0.5],
    size: [1, 1],
    stops: [
      { position: 0, color: "#000000ff" },
      { position: 1, color: "#ffffffff" },
    ],
  };
}

function createDefaultMeshGradient(): MeshGradientFill {
  return {
    type: FillType.MeshGradient,
    enabled: true,
    opacityPercent: 100,
    columns: 3,
    rows: 3,
    points: createDefaultMeshGradientPoints(3, 3),
  };
}

function FillGradient({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<GradientFill> | ValueWithResolved<MeshGradientFill>;
  onChange: (fill: Fill) => void;
}) {
  // NOTE(sedivy): Store the last gradient of each type so switching between them
  // doesn't lose the previous configuration.
  const [lastGradients, setLastGradients] = useState<
    Record<GradientCategory, GradientFill | MeshGradientFill>
  >(() => {
    return {
      [GradientCategory.Simple]: createDefaultSimpleGradient(),
      [GradientCategory.Mesh]: createDefaultMeshGradient(),
    };
  });

  useEffect(() => {
    setLastGradients((prev) => ({
      ...prev,
      [getGradientCategory(fill.value.type)]: fill.value,
    }));
  }, [fill.value]);

  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = Number(value) as
        | FillType.LinearGradient
        | FillType.RadialGradient
        | FillType.AngularGradient
        | FillType.MeshGradient;

      onChange({
        ...lastGradients[getGradientCategory(newType)],
        type: newType,
      } as Fill);
    },
    [lastGradients, onChange],
  );

  let editor;

  const category = getGradientCategory(fill.value.type);
  switch (category) {
    case GradientCategory.Mesh: {
      editor = (
        <FillMeshGradient
          fill={fill as ValueWithResolved<MeshGradientFill>}
          onChange={onChange}
        />
      );
      break;
    }
    case GradientCategory.Simple: {
      editor = (
        <SimpleGradient
          fill={fill as ValueWithResolved<GradientFill>}
          onChange={onChange}
        />
      );
      break;
    }
    default: {
      const missing: never = category;
      logger.error(`Unknown gradient category: ${missing}`);
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Select
        value={fill.resolved.type.toString()}
        onValueChange={handleTypeChange}
      >
        <SelectTrigger className="h-6 text-xxs gap-0" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FillType.LinearGradient.toString()}>
            Linear
          </SelectItem>
          <SelectItem value={FillType.RadialGradient.toString()}>
            Radial
          </SelectItem>
          <SelectItem value={FillType.AngularGradient.toString()}>
            Angular
          </SelectItem>
          <SelectItem value={FillType.MeshGradient.toString()}>Mesh</SelectItem>
        </SelectContent>
      </Select>

      {editor}
    </div>
  );
}

function FillImage({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<ImageFill>;
  onChange: (fill: Fill) => void;
}) {
  const handleSelectImage = useCallback(async () => {
    const files = await imageFilePicker({ multiple: false });
    const file = files?.[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const ipc = getIPC();

      const filePath = window.electronAPI
        ? window.electronAPI.resolveFilePath(file)
        : file.name;

      const response = await ipc.request<
        { fileName: string; fileContents: ArrayBuffer },
        { filePath: string }
      >("import-file", {
        fileName: filePath,
        fileContents: arrayBuffer,
      });

      onChange({ ...fill.value, url: response.filePath });
    }
  }, [fill, onChange]);

  const handleURLChange = useCallback(
    (url: string | Variable<"string"> | undefined) => {
      onChange({ ...fill.value, url: url ?? "" });
    },
    [fill, onChange],
  );

  const url = useMemo(() => {
    return { value: fill.value.url, resolved: fill.resolved.url };
  }, [fill]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <Select
        value={fill.resolved.mode.toString()}
        onValueChange={(value: string) => {
          const mode = Number(value) as StretchMode;
          onChange({ ...fill.value, mode });
        }}
      >
        <SelectTrigger className="h-6 text-xxs gap-0" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={StretchMode.Stretch.toString()}>
            Stretch
          </SelectItem>
          <SelectItem value={StretchMode.Fill.toString()}>Fill</SelectItem>
          <SelectItem value={StretchMode.Fit.toString()}>Fit</SelectItem>
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={handleSelectImage}
        className="h-6 px-2 text-xxs border border-input rounded-md bg-background hover:bg-muted"
      >
        Import image file
      </button>

      <InputIcon
        variables={"string"}
        value={url}
        onCommit={handleURLChange}
        className="h-6 text-xxs border border-input"
        placeholder="Image path or URL"
      />
    </div>
  );
}

function FillColor({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<ColorFill>;
  onChange: (fill: Fill) => void;
}) {
  return (
    <ColorPickerControls
      size={224}
      value={fill.resolved.color}
      onChange={(value) => {
        onChange({ ...fill.value, color: value });
      }}
    />
  );
}

const DEFAULT_MESH_GRADIENT_COLOR_PALETTE: Value<"color">[] = [
  "#fa8f73",
  "#8c5cd9",
  "#47bad9",
  "#f2c76b",
];

export function createDefaultMeshGradientPoints(
  columns: number,
  rows: number,
  colors: Value<"color">[] = DEFAULT_MESH_GRADIENT_COLOR_PALETTE,
): MeshGradientPoint[] {
  const points: MeshGradientPoint[] = [];

  const tangentScaleX = 0.25 / Math.max(columns - 1, 1);
  const tangentScaleY = 0.25 / Math.max(rows - 1, 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col / (columns - 1);
      const y = row / (rows - 1);

      const colorIndex = (row * columns + col) % colors.length;

      points.push({
        position: [x, y],
        color: colors[colorIndex],
        leftHandle: [-tangentScaleX, 0],
        rightHandle: [tangentScaleX, 0],
        topHandle: [0, -tangentScaleY],
        bottomHandle: [0, tangentScaleY],
      });
    }
  }
  return points;
}

enum FillModalSection {
  Color = 1,
  Gradient = 2,
  Image = 3,
}

const Sections = [
  { type: FillModalSection.Color, label: "Color", icon: ColorFillIcon },
  {
    type: FillModalSection.Gradient,
    label: "Gradient",
    icon: GradientFillIcon,
  },
  { type: FillModalSection.Image, label: "Image", icon: ImageFillIcon },
];

export const FillEditor = React.memo(function FillEditor({
  fill,
  onCommit,
}: {
  fill: ValueWithResolved<Fill>;
  onCommit: (fill: Fill) => void;
}) {
  // NOTE(sedivy): Convert the incoming fill type to active section
  let activeSection;
  const type = fill.resolved.type;
  switch (type) {
    case FillType.Color:
      activeSection = FillModalSection.Color;
      break;
    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
    case FillType.MeshGradient:
      activeSection = FillModalSection.Gradient;
      break;
    case FillType.Image:
      activeSection = FillModalSection.Image;
      break;
    default: {
      const missing: never = type;
      logger.error(`Unknown fill type: "${missing}"`);
      activeSection = FillModalSection.Color;
      break;
    }
  }

  // NOTE(sedivy): Keep track of the fill state for each section so switching
  // between them preserves the last state.
  const [fillTypeStates, setFillTypeStates] = useState(() => ({
    [FillModalSection.Color]: {
      type: FillType.Color,
      enabled: true,
      color: "#d9d9d9ff",
    } as ColorFill,

    [FillModalSection.Gradient]: {
      type: FillType.LinearGradient,
      enabled: true,
      opacityPercent: 100,
      rotationDegrees: 0,
      center: [0.5, 0.5],
      size: [1, 1],
      stops: [
        { position: 0, color: "#000000ff" },
        { position: 1, color: "#ffffffff" },
      ],
    } as GradientFill | MeshGradientFill,

    [FillModalSection.Image]: {
      type: FillType.Image,
      enabled: true,
      opacityPercent: 100,
      url: "",
      mode: StretchMode.Fill,
    } as ImageFill,
  }));

  // NOTE(sedivy): Use the incoming fill to set the initial section fill state.
  useEffect(() => {
    const type = fill.resolved.type;
    switch (type) {
      case FillType.Color: {
        setFillTypeStates((prev) => ({
          ...prev,
          [FillModalSection.Color]: fill.value as ColorFill,
        }));
        break;
      }

      case FillType.LinearGradient:
      case FillType.RadialGradient:
      case FillType.AngularGradient: {
        setFillTypeStates((prev) => ({
          ...prev,
          [FillModalSection.Gradient]: fill.value as GradientFill,
        }));
        break;
      }

      case FillType.MeshGradient: {
        setFillTypeStates((prev) => ({
          ...prev,
          [FillModalSection.Gradient]: fill.value as MeshGradientFill,
        }));
        break;
      }

      case FillType.Image: {
        setFillTypeStates((prev) => ({
          ...prev,
          [FillModalSection.Image]: fill.value as ImageFill,
        }));
        break;
      }

      default: {
        const missing: never = type;
        logger.error(`Unknown fill type: "${missing}"`);
        break;
      }
    }
  }, [fill]);

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 border-b border-border p-3">
        <TooltipProvider delayDuration={700}>
          <div className="flex flex-1 gap-[1px] bg-card p-[1px] rounded-[5px]">
            {Sections.map((section) => (
              <TooltipPrimitive.Root key={section.type}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`flex-1 h-6 flex items-center justify-center rounded-[4px] transition-all ${
                      activeSection === section.type
                        ? "bg-primary/20"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => {
                      onCommit(fillTypeStates[section.type]);
                    }}
                  >
                    {React.createElement(section.icon)}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{section.label}</TooltipContent>
              </TooltipPrimitive.Root>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex gap-1 p-3">
        <FillEditorInner fill={fill} onChange={onCommit} />
      </div>
    </div>
  );
});

function FillEditorInner({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<Fill>;
  onChange: (fill: Fill) => void;
}) {
  const type = fill.resolved.type;
  switch (type) {
    case FillType.Color:
      return (
        <FillColor
          fill={fill as ValueWithResolved<ColorFill>}
          onChange={onChange}
        />
      );

    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
    case FillType.MeshGradient:
      return (
        <FillGradient
          fill={
            fill as
              | ValueWithResolved<GradientFill>
              | ValueWithResolved<MeshGradientFill>
          }
          onChange={onChange}
        />
      );

    case FillType.Image:
      return (
        <FillImage
          fill={fill as ValueWithResolved<ImageFill>}
          onChange={onChange}
        />
      );

    default: {
      const missing: never = type;
      logger.error(`Unknown fill section: "${missing}"`);
      return null;
    }
  }
}
