import type { SceneNode } from "../canvas";
import type { SceneManager } from "../managers";

export function handleGetEditorState(sceneManager: SceneManager): string {
  const selectedNodes = [...sceneManager.selectionManager.selectedNodes];
  const topLevelNodes = sceneManager.scenegraph.getViewportNode().children;
  const totalCount = topLevelNodes.length;

  const reusableComponents: { id: string; name?: string }[] = [];
  const collectReusable = (node: SceneNode) => {
    if (node.reusable) {
      reusableComponents.push({
        id: node.id,
        name: node.properties.name,
      });
    }
    for (const child of node.children) {
      collectReusable(child);
    }
  };
  collectReusable(sceneManager.scenegraph.getViewportNode());

  let message = "";

  if (selectedNodes.length > 0) {
    message = `# Current Editor State \n\n## Selected Elements:\n${selectedNodes.map((n) => `- \`${n.id}\` (${n.type})${n.properties.name ? `: ${n.properties.name}` : ""}`).join("\n")}`;
  } else {
    message = `## Document State:\n`;
    message += `- No nodes are selected.\n`;

    if (totalCount === 0) {
      message += `- The document is empty (no top-level nodes).\n`;
    } else {
      const maxNodes = 10;
      const visible: { id: string; name: string; type: string }[] = [];
      const outside: { id: string; name: string; type: string }[] = [];

      for (const node of topLevelNodes) {
        const info = {
          id: node.id,
          name: node.properties.name || node.id,
          type: node.type,
        };
        if (sceneManager.camera.overlapsBounds(node.getWorldBounds())) {
          visible.push(info);
        } else {
          outside.push(info);
        }
      }

      message += `\n\n### Top-Level Nodes (${totalCount}):\n`;
      const showCount = Math.min(maxNodes, totalCount);
      for (let i = 0; i < showCount; i++) {
        const n = i < visible.length ? visible[i] : outside[i - visible.length];
        const label = i < visible.length ? "user visible" : "outside viewport";
        message += `\n- \`${n.id}\` (${n.type}): ${n.name} [${label}]`;
      }
      if (totalCount > maxNodes) {
        message += `\n- ... +${totalCount - maxNodes} others`;
      }
    }
  }

  message += `\n\n### Reusable Components (${reusableComponents.length}):\n`;
  if (reusableComponents.length > 0) {
    message += reusableComponents
      .map((c) => `- \`${c.id}\`${c.name ? `: ${c.name}` : ""}`)
      .join("\n");
  } else {
    message += `- No reusable components found.`;
  }

  const filePath = sceneManager.scenegraph.documentPath;

  message = filePath
    ? `## Currently active editor\n- \`${filePath}\`\n\n${message}`
    : message;

  return message;
}
