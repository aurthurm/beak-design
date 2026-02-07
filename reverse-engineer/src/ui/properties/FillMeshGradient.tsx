import {
  clamp,
  type Fill,
  hexColorEquals,
  IdleState,
  MeshGradientEditorState,
  type MeshGradientFill,
} from "@ha/pencil-editor";
import { useCallback, useEffect, useState } from "react";
import { ColorInput } from "@/src/components/color-input";
import { GridPreview } from "@/src/components/grid-preview";
import {
  BezierCurveAsymmetric,
  BezierCurveSymmetric,
} from "@/src/components/icons";
import { Label } from "@/src/components/label";
import { cn } from "@/src/lib/utils";
import { useSceneManager } from "@/src/pages/Editor";
import { SectionTitle } from "../section-title";
import { createDefaultMeshGradientPoints } from "./FillEditor";
import {
  compareValuesWithResolved,
  type ValueWithResolved,
} from "./properties-compute";

const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 5;

function MixedColorInput({
  selection,
  fill,
  onChange,
}: {
  selection: Set<number>;
  fill: ValueWithResolved<MeshGradientFill>;
  onChange: (fill: Fill) => void;
}) {
  let commonColor;
  let mixed = false;
  let initialized = true;

  for (const index of selection) {
    if (index < 0 || index >= fill.resolved.points.length) {
      continue;
    }

    const color = {
      value: fill.value.points[index].color,
      resolved: fill.resolved.points[index].color,
    };

    if (commonColor == null) {
      commonColor = color;
      initialized = true;
    } else if (!compareValuesWithResolved(commonColor, color, hexColorEquals)) {
      mixed = true;
      break;
    }
  }

  if (!initialized) {
    return null;
  }

  return (
    <ColorInput
      className="w-full h-6 flex"
      value={commonColor == null || mixed ? "Mixed" : commonColor.value}
      resolved={commonColor == null || mixed ? "Mixed" : commonColor.resolved}
      onChange={(newColor) => {
        const newPoints = [...fill.value.points];

        for (const index of selection) {
          if (index < 0 || index >= fill.resolved.points.length) {
            continue;
          }

          newPoints[index] = {
            ...newPoints[index],
            color: newColor,
          };
        }

        onChange({ ...fill.value, points: newPoints });
      }}
    />
  );
}

export function FillMeshGradient({
  fill,
  onChange,
}: {
  fill: ValueWithResolved<MeshGradientFill>;
  onChange: (fill: Fill) => void;
}) {
  const sceneManager = useSceneManager();

  const [selection, setSelection] = useState<Set<number>>(new Set());

  const [symmetricMode, setSymmetricMode] = useState(true);
  const [showOutline, setShowOutline] = useState(true);

  const columns = fill.resolved.columns;
  const rows = fill.resolved.rows;

  useEffect(() => {
    const node = sceneManager.selectionManager.getSingleSelectedNode();
    if (!node) {
      return;
    }

    let state: MeshGradientEditorState;

    if (sceneManager.stateManager.state instanceof MeshGradientEditorState) {
      sceneManager.stateManager.state.editFill(node, fill, onChange);
      state = sceneManager.stateManager.state;
    } else {
      state = new MeshGradientEditorState(sceneManager, node, fill, onChange);
      sceneManager.stateManager.transitionTo(state);
    }

    setSelection(state.selectedPoints);
    setSymmetricMode(state.symmetricMode);
    setShowOutline(state.showOutline);

    state.setSelectionCallback(() => {
      setSelection(state.selectedPoints);
    });

    return () => {
      state.setSelectionCallback(undefined);
    };
  }, [sceneManager, fill, onChange]);

  // NOTE(sedivy): Exit MeshGradientEditorState on unmount
  useEffect(() => {
    return () => {
      if (sceneManager.stateManager.state instanceof MeshGradientEditorState) {
        sceneManager.stateManager.transitionTo(new IdleState(sceneManager));
      }
    };
  }, [sceneManager]);

  const handleSetSymmetricMode = useCallback(
    (value: boolean) => {
      setSymmetricMode(value);

      if (sceneManager.stateManager.state instanceof MeshGradientEditorState) {
        sceneManager.stateManager.state.symmetricMode = value;
      }
    },
    [sceneManager],
  );

  const handleSetShowOutline = useCallback(
    (value: boolean) => {
      setShowOutline(value);

      if (sceneManager.stateManager.state instanceof MeshGradientEditorState) {
        sceneManager.stateManager.state.showOutline = value;
        sceneManager.requestFrame();
      }
    },
    [sceneManager],
  );

  const handleSelectGridSize = useCallback(
    (width: number, height: number) => {
      const newColumns = clamp(MIN_GRID_SIZE, width, MAX_GRID_SIZE) + 1;
      const newRows = clamp(MIN_GRID_SIZE, height, MAX_GRID_SIZE) + 1;

      if (newColumns === columns && newRows === rows) {
        return;
      }

      const newPoints = createDefaultMeshGradientPoints(
        newColumns,
        newRows,
        fill.value.points.map((p) => p.color),
      );

      onChange({
        ...fill.value,
        columns: newColumns,
        rows: newRows,
        points: newPoints,
      });

      if (sceneManager.stateManager.state instanceof MeshGradientEditorState) {
        sceneManager.stateManager.state.setSelection(new Set());
      }
    },
    [sceneManager, fill, onChange, columns, rows],
  );

  const handleResetTangents = useCallback(() => {
    const newPoints = [...fill.value.points];

    for (const index of selection) {
      if (index < 0 || index >= fill.resolved.points.length) {
        continue;
      }

      const tangentScaleX = 0.25 / Math.max(columns - 1, 1);
      const tangentScaleY = 0.25 / Math.max(rows - 1, 1);

      newPoints[index] = {
        ...newPoints[index],
        leftHandle: [-tangentScaleX, 0] as [number, number],
        rightHandle: [tangentScaleX, 0] as [number, number],
        topHandle: [0, -tangentScaleY] as [number, number],
        bottomHandle: [0, tangentScaleY] as [number, number],
      };
    }

    onChange({ ...fill.value, points: newPoints });
  }, [fill, columns, rows, selection, onChange]);

  const handleResetPosition = useCallback(() => {
    const newPoints = [...fill.value.points];

    for (const index of selection) {
      if (index < 0 || index >= fill.resolved.points.length) {
        continue;
      }

      const row = Math.floor(index / columns);
      const col = index % columns;

      const x = col / Math.max(columns - 1, 1);
      const y = row / Math.max(rows - 1, 1);

      newPoints[index] = {
        ...newPoints[index],
        position: [x, y] as [number, number],
      };
    }

    onChange({ ...fill.value, points: newPoints });
  }, [fill, columns, rows, selection, onChange]);

  const handleShuffleColors = useCallback(() => {
    const indices =
      selection.size > 0
        ? Array.from(selection)
        : fill.value.points.map((_, i) => i);

    const colors = indices.map((i) => fill.value.points[i].color);

    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }

    const newPoints = [...fill.value.points];
    for (let i = 0; i < indices.length; i++) {
      newPoints[indices[i]] = { ...newPoints[indices[i]], color: colors[i] };
    }

    onChange({ ...fill.value, points: newPoints });
  }, [fill, selection, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <SectionTitle title="Grid" />
          <div className="flex-1">
            <GridPreview
              max={MAX_GRID_SIZE}
              columns={columns - 1}
              rows={rows - 1}
              onSelect={handleSelectGridSize}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <SectionTitle title="Mirroring" />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleSetSymmetricMode(true)}
                className={`flex-1 h-6 flex items-center justify-center rounded-[4px] transition-all ${
                  symmetricMode ? "bg-primary/20" : "hover:bg-muted"
                }`}
              >
                <BezierCurveSymmetric className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetSymmetricMode(false)}
                className={`flex-1 h-6 flex items-center justify-center rounded-[4px] transition-all ${
                  !symmetricMode ? "bg-primary/20" : "hover:bg-muted"
                }`}
              >
                <BezierCurveAsymmetric className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <SectionTitle title="Outline" />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleSetShowOutline(false)}
                className={`flex-1 h-6 flex items-center justify-center rounded-[4px] text-xxs transition-all ${
                  !showOutline ? "bg-primary/20" : "hover:bg-muted"
                }`}
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => handleSetShowOutline(true)}
                className={`flex-1 h-6 flex items-center justify-center rounded-[4px] text-xxs transition-all ${
                  showOutline ? "bg-primary/20" : "hover:bg-muted"
                }`}
              >
                On
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1">
          <SectionTitle title="Colors" />

          <div className="flex flex-col gap-0.5">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: It's a grid
              <div key={rowIndex} className="flex-1 flex gap-0.5">
                {Array.from({ length: columns }).map((_, colIndex) => {
                  const index = rowIndex * columns + colIndex;
                  const point = fill.resolved.points[index];

                  const isSelected = selection.has(index);

                  return (
                    <button
                      type="button"
                      // biome-ignore lint/suspicious/noArrayIndexKey: There is no stable ID
                      key={colIndex}
                      className={cn(
                        "w-6 aspect-square rounded border border-input outline-none cursor-pointer hover:border-foreground",
                        isSelected && "ring-2 ring-primary",
                      )}
                      style={{ backgroundColor: point.color }}
                      onMouseDown={(e: React.MouseEvent) => {
                        const state = sceneManager.stateManager.state;
                        if (state instanceof MeshGradientEditorState) {
                          if (e.shiftKey) {
                            const newSelection = new Set(state.selectedPoints);

                            if (isSelected) {
                              newSelection.delete(index);
                            } else {
                              newSelection.add(index);
                            }

                            state.setSelection(newSelection);
                          } else {
                            state.setSelection(new Set([index]));
                          }
                        }
                      }}
                    ></button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleShuffleColors}
          className="h-6 px-2 text-xxs border border-input rounded bg-background hover:bg-muted"
        >
          {selection.size > 0 ? "Shuffle Selected Colors" : "Shuffle Colors"}
        </button>
      </div>

      {selection.size > 0 ? (
        <div className="flex flex-col gap-1.5">
          <SectionTitle
            title={`Selected Point${selection.size > 1 ? "s" : ""}`}
          />

          <div className="grid gap-2 grid-cols-[min-content_1fr] text-xxs">
            <Label className="text-xxs">Point</Label>
            <button
              type="button"
              onClick={handleResetPosition}
              className="h-6 px-2 text-xxs border border-input rounded bg-background hover:bg-muted"
            >
              Reset Position
            </button>

            <Label className="text-xxs">Handles</Label>
            <button
              type="button"
              onClick={handleResetTangents}
              className="h-6 px-2 text-xxs border border-input rounded bg-background hover:bg-muted"
            >
              Reset Curve
            </button>

            <Label className="text-xxs">Color</Label>
            <div className="flex gap-1">
              <MixedColorInput
                selection={selection}
                fill={fill}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
      ) : undefined}
    </div>
  );
}
