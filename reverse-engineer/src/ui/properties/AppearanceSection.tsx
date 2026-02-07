import { Scan } from "lucide-react";
import React, { useCallback, useState } from "react";
import {
  ScanBottomLeft,
  ScanBottomRight,
  ScanTopleft,
  ScanTopRight,
} from "@/src/components/icons";
import { clamp, type Value } from "@ha/pencil-editor";
import { InputIcon } from "../../components/input-icon";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { IconButton } from "./icon-button";
import { blockUpdate, useNumericInputHandlers } from "./shared-handlers";
import { useSceneManager } from "@/src/pages/Editor";
import type { ValueWithResolved } from "./properties-compute";

interface AppearanceSectionProps {
  opacity: ValueWithResolved<Value<"number">> | "Mixed";
  cornerRadii:
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
  shouldShowCornerRadius: boolean;
}

function getCornerValue(
  values:
    | ValueWithResolved<
        readonly [
          Value<"number">,
          Value<"number">,
          Value<"number">,
          Value<"number">,
        ]
      >
    | "Mixed"
    | null,
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

export const AppearanceSection = React.memo(function AppearanceSection({
  opacity,
  cornerRadii,
  shouldShowCornerRadius,
}: AppearanceSectionProps): React.ReactElement {
  const manager = useSceneManager();

  const [isCornerRadiiExpanded, setIsCornerRadiiExpanded] =
    useState<boolean>(false);

  const handleToggleCornerRadiiExpanded = useCallback(() => {
    // Button is kept for visual consistency but does nothing
    setIsCornerRadiiExpanded(!isCornerRadiiExpanded);
  }, [isCornerRadiiExpanded]);

  const cornerRadiiHandler = useNumericInputHandlers(manager, "cornerRadii", 0);
  const cornerRadius0Handler = useNumericInputHandlers(
    manager,
    "cornerRadius0",
    0,
  );
  const cornerRadius1Handler = useNumericInputHandlers(
    manager,
    "cornerRadius1",
    0,
  );
  const cornerRadius2Handler = useNumericInputHandlers(
    manager,
    "cornerRadius2",
    0,
  );
  const cornerRadius3Handler = useNumericInputHandlers(
    manager,
    "cornerRadius3",
    0,
  );
  const opacityHandler = useNumericInputHandlers(
    manager,
    "opacity",
    0,
    100,
    (opacity) => opacity / 100,
  );

  return (
    <Section>
      <SectionTitle title="Appearance" />
      <div className="flex gap-1.5">
        <div className="grid gap-1.5 grid-cols-2">
          {/* First row: Opacity and unified corner radius */}
          <InputIcon
            letter="%"
            allowArrowKeysChange
            stepDistance={40}
            variables={"number"}
            value={
              opacity === "Mixed"
                ? opacity
                : {
                    value:
                      typeof opacity.value === "number"
                        ? opacity.value * 100
                        : opacity.value,
                    resolved: opacity.resolved * 100,
                  }
            }
            onCommit={opacityHandler}
            onCommitDelta={(delta) => {
              blockUpdate(manager, (block, node) => {
                block.update(node, {
                  opacity: clamp(
                    0,
                    (node.properties.resolved.opacity ?? 1) + delta / 100,
                    1,
                  ),
                });
              });
            }}
            className="h-6 text-xxs"
          />
          <InputIcon
            disabled={!shouldShowCornerRadius}
            allowArrowKeysChange
            icon={<Scan className="w-3 h-3" />}
            variables={"number"}
            value={getCornerValue(cornerRadii, -1)}
            onCommit={cornerRadiiHandler}
            className="h-6 text-xxs"
          />

          {shouldShowCornerRadius && isCornerRadiiExpanded && (
            <>
              <InputIcon
                allowArrowKeysChange
                icon={<ScanTopleft className="w-3 h-3 opacity-50" />}
                variables={"number"}
                value={getCornerValue(cornerRadii, 0)}
                onCommit={cornerRadius0Handler}
                className="h-6 text-xxs w-full"
              />
              <InputIcon
                value={getCornerValue(cornerRadii, 1)}
                icon={<ScanTopRight className="w-3 h-3 opacity-50" />}
                variables={"number"}
                onCommit={cornerRadius1Handler}
                className="h-6 text-xxs w-full"
              />
              <InputIcon
                allowArrowKeysChange
                icon={<ScanBottomLeft className="w-3 h-3 opacity-50" />}
                variables={"number"}
                value={getCornerValue(cornerRadii, 3)}
                onCommit={cornerRadius3Handler}
                className="h-6 text-xxs w-full"
              />
              <InputIcon
                allowArrowKeysChange
                icon={<ScanBottomRight className="w-3 h-3 opacity-50" />}
                variables={"number"}
                value={getCornerValue(cornerRadii, 2)}
                onCommit={cornerRadius2Handler}
                className="h-6 text-xxs w-full"
              />
            </>
          )}
        </div>
        {shouldShowCornerRadius && (
          <div>
            <IconButton
              className="h-6"
              icon={Scan}
              onClick={handleToggleCornerRadiiExpanded}
            />
          </div>
        )}
      </div>
    </Section>
  );
});

export default AppearanceSection;
