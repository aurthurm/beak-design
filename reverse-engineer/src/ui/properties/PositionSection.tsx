import React from "react";
import {
  type ObjectUpdateBlock,
  type SceneNode,
  type SceneManager,
  angleDifference,
  degToRad,
  radToDeg,
  roundToMultiple,
} from "@ha/pencil-editor";
import { InputIcon } from "../../components/input-icon";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { blockUpdate } from "./shared-handlers";
import { useSceneManager } from "@/src/pages/Editor";

interface PositionSectionProps {
  x: number | "Mixed";
  y: number | "Mixed";
  rotation: number | "Mixed";
}

function translateNode(
  block: ObjectUpdateBlock,
  node: SceneNode,
  delta: [number, number],
) {
  const position = node.getGlobalPosition();

  const target = node.toLocalPointFromParent(
    position.x + delta[0],
    position.y + delta[1],
  );

  block.update(node, {
    x: target.x,
    y: target.y,
  });
}

function translateSelection(manager: SceneManager, delta: [number, number]) {
  blockUpdate(manager, (block: ObjectUpdateBlock, node: SceneNode) => {
    translateNode(block, node, delta);
  });
}

export const PositionSection = React.memo(function PositionSection({
  x,
  y,
  rotation,
}: PositionSectionProps): React.ReactElement {
  const manager = useSceneManager();
  return (
    <Section>
      <SectionTitle title="Position" />
      <div className="grid grid-cols-2 gap-1.5">
        {/* X */}
        <InputIcon
          letter="X"
          value={x}
          onCommit={(value) => {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              blockUpdate(
                manager,
                (block: ObjectUpdateBlock, node: SceneNode) => {
                  let newPosition = float;

                  const parent = node.parent;
                  if (parent && !parent.root) {
                    newPosition += parent.getWorldBounds().left;
                  }

                  translateNode(block, node, [
                    newPosition - node.getWorldBounds().left,
                    0,
                  ]);
                },
              );
            }
          }}
          onCommitDelta={(delta) => {
            translateSelection(manager, [delta, 0]);
          }}
          className="h-6 text-xxs"
          allowArrowKeysChange
        />
        {/* Y */}
        <InputIcon
          letter="Y"
          value={y}
          onCommit={(value) => {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              blockUpdate(
                manager,
                (block: ObjectUpdateBlock, node: SceneNode) => {
                  let newPosition = float;

                  const parent = node.parent;
                  if (parent && !parent.root) {
                    newPosition += parent.getWorldBounds().top;
                  }

                  translateNode(block, node, [
                    0,
                    newPosition - node.getWorldBounds().top,
                  ]);
                },
              );
            }
          }}
          onCommitDelta={(delta) => {
            translateSelection(manager, [0, delta]);
          }}
          className="h-6 text-xxs"
          allowArrowKeysChange
        />
        {/* R (deg) */}
        <InputIcon
          letter="R"
          suffix="°"
          stepMultiplier={15}
          stepDistance={40}
          value={rotation === "Mixed" ? rotation : radToDeg(rotation * -1)}
          onCommit={(value: string) => {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              const targetRotation = degToRad(float * -1);

              blockUpdate(manager, (block, node) => {
                const originalBounds = node.getTransformedLocalBounds();
                const centerX = originalBounds.centerX;
                const centerY = originalBounds.centerY;

                // NOTE(sedivy): The properties panel is changing the world rotation.
                // We need to convert it to local rotation.
                const worldTransform = node.getWorldMatrix();
                const currentRotation = Math.atan2(
                  worldTransform.b,
                  worldTransform.a,
                );
                const delta = angleDifference(currentRotation, targetRotation);

                block.update(node, {
                  rotation: (node.properties.resolved.rotation ?? 0) + delta,
                });

                // NOTE(sedivy): Keep the center the same after the rotation.
                const bounds = node.getTransformedLocalBounds();
                block.update(node, {
                  x: node.properties.resolved.x + (centerX - bounds.centerX),
                  y: node.properties.resolved.y + (centerY - bounds.centerY),
                });
              });
            }
          }}
          onCommitDelta={(delta: number, round: boolean) => {
            const radians = degToRad(delta);

            blockUpdate(manager, (block, node) => {
              const originalBounds = node.getTransformedLocalBounds();
              const centerX = originalBounds.centerX;
              const centerY = originalBounds.centerY;

              let rotation = (node.properties.resolved.rotation ?? 0) + radians;
              if (round) {
                rotation = roundToMultiple(rotation, degToRad(15));
              }

              block.update(node, {
                rotation: rotation,
              });

              // NOTE(sedivy): Keep the center the same after the rotation.
              const bounds = node.getTransformedLocalBounds();
              block.update(node, {
                x: node.properties.resolved.x + (centerX - bounds.centerX),
                y: node.properties.resolved.y + (centerY - bounds.centerY),
              });
            });
          }}
          className="h-6 text-xxs"
          allowArrowKeysChange
        />
      </div>
    </Section>
  );
});

export default PositionSection;
