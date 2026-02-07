import type { ObjectUpdateBlock, SceneNode } from "@ha/pencil-editor";
import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import { Minus } from "lucide-react";
import React, { useCallback } from "react";
import { useSceneManager } from "@/src/pages/Editor";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { IconButton } from "./icon-button";
import { blockUpdate } from "./shared-handlers";

function MetadataDisplay({
  metadata,
}: {
  metadata: NonNullable<Schema.Entity["metadata"]>;
}) {
  const type = metadata.type;
  switch (type) {
    case "unsplash": {
      const link = metadata.link;
      const author = metadata.author;

      if (link == null || author == null) {
        return;
      }

      return (
        <a
          href={`https://unsplash.com/@${metadata.username}?utm_source=pencil&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xxs !text-foreground no-underline hover:underline"
        >
          Unsplash: {metadata.author}
        </a>
      );
    }

    default: {
      logger.warn(`Unhandled metadata type in display: ${metadata.type}`);
    }
  }
}

export const MetadataSection = React.memo(function MetadataSection({
  metadata,
}: {
  metadata: NonNullable<Schema.Entity["metadata"]>;
}): React.ReactElement | undefined {
  const manager = useSceneManager();

  const removeMetadata = useCallback(() => {
    blockUpdate(manager, (block: ObjectUpdateBlock, node: SceneNode) => {
      block.update(node, {
        metadata: undefined,
      });
    });
  }, [manager]);

  return (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle title="Metadata" />
      </div>

      <div className="flex items-center justify-between">
        <MetadataDisplay metadata={metadata} />
        <IconButton icon={Minus} onClick={removeMetadata} />
      </div>
    </Section>
  );
});

export default MetadataSection;
