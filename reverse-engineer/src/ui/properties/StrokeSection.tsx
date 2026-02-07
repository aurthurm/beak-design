import { Plus, Square } from "lucide-react";
import React, { useState } from "react";
import {
  BoxLineBottom,
  BoxLineLeft,
  BoxLineRight,
  BoxLineTop,
} from "@/src/components/icons";
import { InputIcon } from "../../components/input-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { FillList } from "./FillSection";
import { IconButton } from "./icon-button";
import {
  blockUpdate,
  useNumericInputHandlers,
  useSelectHandler,
} from "./shared-handlers";
import { useSceneManager } from "@/src/pages/Editor";
import type { ValueWithResolved } from "./properties-compute";
import {
  type ObjectUpdateBlock,
  type SceneNode,
  type NodeProperties,
  StrokeAlignment,
  FillType,
  type Fill,
  type Value,
  type SceneManager,
} from "@ha/pencil-editor";

interface StrokeSectionProps {
  fills: ValueWithResolved<ReadonlyArray<Fill>> | undefined | "Mixed";
  width:
    | ValueWithResolved<
        readonly [
          Value<"number">,
          Value<"number">,
          Value<"number">,
          Value<"number">,
        ]
      >
    | "Mixed"
    | null;
  alignment?: StrokeAlignment | "Mixed";
}

function alignmentToString(val: StrokeAlignment | "Mixed"): string {
  if (val === "Mixed") return "Mixed";

  switch (val) {
    case StrokeAlignment.Outside:
      return "Outside";
    case StrokeAlignment.Center:
      return "Center";
    case StrokeAlignment.Inside:
      return "Inside";
  }
}

function getSideValue(
  values: StrokeSectionProps["width"],
  index: number,
): ValueWithResolved<Value<"number">> | "Mixed" {
  if (values === "Mixed") {
    return "Mixed";
  }

  if (values === null) {
    return { value: 0, resolved: 0 };
  }

  if (index === -1) {
    if (
      values.value[0] === values.value[1] &&
      values.value[0] === values.value[2] &&
      values.value[0] === values.value[3]
    ) {
      return { value: values.value[0], resolved: values.resolved[0] };
    } else {
      return "Mixed";
    }
  }

  return { value: values.value[index], resolved: values.resolved[index] };
}

function commitStrokeFills(manager: SceneManager, fills: ReadonlyArray<Fill>) {
  blockUpdate(manager, (block: ObjectUpdateBlock, node: SceneNode) => {
    const update: Pick<
      NodeProperties,
      "strokeFills" | "strokeWidth" | "strokeAlignment"
    > = {
      strokeFills: fills,
    };

    if (
      node.properties.resolved.strokeFills == null ||
      node.properties.resolved.strokeFills.length === 0
    ) {
      update.strokeWidth = [1, 1, 1, 1];
      update.strokeAlignment = StrokeAlignment.Inside;
    }

    block.update(node, update);
  });
}

export const StrokeSection = React.memo(function StrokeSection({
  fills,
  width,
  alignment,
}: StrokeSectionProps): React.ReactElement | null {
  const manager = useSceneManager();

  const [expandStrokeSide, setExpandStrokeSide] = useState(false);

  const handleCommitWidths = useNumericInputHandlers(
    manager,
    "strokeWidths",
    0,
  );
  const handleCommitWidthTop = useNumericInputHandlers(
    manager,
    "strokeWidthTop",
    0,
  );
  const handleCommitWidthRight = useNumericInputHandlers(
    manager,
    "strokeWidthRight",
    0,
  );
  const handleCommitWidthBottom = useNumericInputHandlers(
    manager,
    "strokeWidthBottom",
    0,
  );
  const handleCommitWidthLeft = useNumericInputHandlers(
    manager,
    "strokeWidthLeft",
    0,
  );

  const handleCommitAlignment = useSelectHandler(
    manager,
    "strokeAlignment",
    (value: string) => parseInt(value, 10), // Transform string to number
  );

  const isStrokeEnabled =
    fills && (fills === "Mixed" || fills.value.length > 0);

  return (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle title="Stroke" />
        <IconButton
          icon={Plus}
          onClick={() => {
            const cloned: Fill[] =
              fills === "Mixed" || fills == null ? [] : [...fills.value];

            cloned.push({
              type: FillType.Color,
              enabled: true,
              color:
                // TODO(sedivy): When changing fills for "Mixed" we should probably
                // use the first selected node for the common fill.
                fills === "Mixed" || cloned.length === 0
                  ? "#000000ff"
                  : "#00000033",
            });

            commitStrokeFills(manager, cloned);
          }}
        />
      </div>

      {isStrokeEnabled && (
        <div className="grid gap-1.5">
          <FillList
            fills={fills === "Mixed" ? "Mixed" : fills}
            onCommit={(fills) => {
              commitStrokeFills(manager, fills);
            }}
          />

          <div className="flex gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Select
                value={String(alignment ?? "Mixed")}
                onValueChange={handleCommitAlignment}
              >
                <SelectTrigger className="h-6 text-xxs gap-0" size="sm">
                  <SelectValue placeholder="Alignment">
                    {alignmentToString(alignment ?? "Mixed")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value={StrokeAlignment.Center.toString()}
                    className="text-xs"
                  >
                    Center
                  </SelectItem>
                  <SelectItem
                    value={StrokeAlignment.Inside.toString()}
                    className="text-xs"
                  >
                    Inside
                  </SelectItem>
                  <SelectItem
                    value={StrokeAlignment.Outside.toString()}
                    className="text-xs"
                  >
                    Outside
                  </SelectItem>
                </SelectContent>
              </Select>

              <InputIcon
                allowArrowKeysChange
                letter="W"
                variables={"number"}
                value={getSideValue(width, -1)}
                onCommit={handleCommitWidths}
                className="h-6 text-xxs"
              />

              {expandStrokeSide ? (
                <>
                  <InputIcon
                    allowArrowKeysChange
                    icon={<BoxLineLeft className="w-3 h-3 opacity-70" />}
                    variables={"number"}
                    value={getSideValue(width, 3)}
                    onCommit={handleCommitWidthLeft}
                    className="h-6 text-xxs"
                  />
                  <InputIcon
                    allowArrowKeysChange
                    icon={<BoxLineTop className="w-3 h-3 opacity-70" />}
                    variables={"number"}
                    value={getSideValue(width, 0)}
                    onCommit={handleCommitWidthTop}
                    className="h-6 text-xxs"
                  />
                  <InputIcon
                    allowArrowKeysChange
                    icon={<BoxLineRight className="w-3 h-3 opacity-70" />}
                    variables={"number"}
                    value={getSideValue(width, 1)}
                    onCommit={handleCommitWidthRight}
                    className="h-6 text-xxs"
                  />
                  <InputIcon
                    allowArrowKeysChange
                    icon={<BoxLineBottom className="w-3 h-3 opacity-70" />}
                    variables={"number"}
                    value={getSideValue(width, 2)}
                    onCommit={handleCommitWidthBottom}
                    className="h-6 text-xxs"
                  />
                </>
              ) : undefined}
            </div>
            <div>
              <IconButton
                className="h-6"
                icon={Square}
                onClick={() => {
                  setExpandStrokeSide(!expandStrokeSide);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
});

export default StrokeSection;
