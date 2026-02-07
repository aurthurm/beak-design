import {
  dragAndDropFeature,
  type ItemInstance,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
  type TreeInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import React, { useEffect, useEffectEvent, useState } from "react";
import { useConfigValue } from "../hooks/use-config-value";
import { useResizable } from "../hooks/use-resizable";
import { getNodeIcon } from "../lib/node-icons";
import { cn, getNodeTypeName } from "../lib/utils";
import { useSceneManager } from "../pages/Editor";
import { platform } from "../platform";
import type { SceneManager, SceneNode } from "@ha/pencil-editor";

const INDENT_PIXELS = 12;

function nodeHasReverseChildOrder(node: SceneNode): boolean {
  if (node.hasLayout()) {
    return false;
  }

  return true;
}

const emptyDraggingPreviewElement = document.createElement("img");
emptyDraggingPreviewElement.src =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

function getIsComponent(node: SceneNode): boolean {
  for (let item: SceneNode | null = node; item; item = item.parent) {
    if (item.reusable) {
      return true;
    }
  }

  return false;
}

function LayerListRow({
  item,
  manager,
  tree,
}: {
  item: ItemInstance<SceneNode>;
  manager: SceneManager;
  tree: TreeInstance<SceneNode>;
}) {
  const node = item.getItemData();

  const isExpanded = item.isExpanded();

  const isComponent = getIsComponent(node);

  const isSelected = manager.selectionManager.selectedNodes.has(node);

  const isParentSelected =
    !isSelected &&
    node.parent &&
    !node.parent.root &&
    manager.selectionManager.isInTheSelectionTree(node.parent);

  const isFolder = item.isFolder();
  const isDrop = item.isDragTarget();
  const isRenaming = item.isRenaming();

  let hideSelectionTopCorners = false;
  let hideSelectionBottomCorners = false;

  if (isParentSelected || isSelected) {
    const nodeAbove = item.getItemAbove()?.getItemData();
    const nodeBelow = item.getItemBelow();

    const isAboveSelected =
      nodeAbove != null &&
      manager.selectionManager.isInTheSelectionTree(nodeAbove);

    const isBelowSelected =
      nodeBelow != null &&
      manager.selectionManager.isInTheSelectionTree(nodeBelow.getItemData());

    hideSelectionTopCorners = isAboveSelected;
    hideSelectionBottomCorners = isBelowSelected;
  }

  const Icon = getNodeIcon(node);
  const isEnabled = node.properties.resolved.enabled !== false;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: false positive
    // biome-ignore lint/a11y/noStaticElementInteractions: false positive
    <div
      key={item.getId()}
      {...item.getProps()}
      onDoubleClick={(e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        item.startRenaming();
      }}
      onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
        if (e.ctrlKey || e.metaKey) {
          item.toggleSelect();
        } else if (e.shiftKey) {
          if (!isSelected) {
            includeSelectionUpTo(tree, item);
          }
        } else {
          if (!isSelected) {
            tree.setSelectedItems([item.getItemMeta().itemId]);
          }
        }
      }}
      onClick={(e) => {
        preventDefaultAndStopPropagation(e);

        if (isSelected && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          tree.setSelectedItems([item.getItemMeta().itemId]);
        }
      }}
      className={cn(
        "flex h-7 group transition-colors relative",
        "before:absolute before:top-0 before:left-[6px] before:h-full before:w-[calc(100%-6px*2)] before:rounded",

        "focus:outline-none focus:ring-0",

        hideSelectionTopCorners && "before:rounded-t-none",
        hideSelectionBottomCorners && "before:rounded-b-none",

        isParentSelected && "before:bg-primary/5",
        isSelected && "before:bg-primary/15",

        isDrop && "before:border before:border-foreground/30",

        !isSelected && "hover:before:bg-muted/50",

        !isEnabled && "opacity-40",
      )}
    >
      <div
        style={{
          paddingLeft: `${item.getItemMeta().level * INDENT_PIXELS + 10}px`,
        }}
      />

      <div
        className={cn(
          "flex flex-w1 text-left text-xxs items-center  rounded relative z-0 whitespace-nowrap min-w-0 w-full",
          isSelected && "text-accent-foreground",
          !isSelected && "text-foreground",
          isFolder && "font-medium",

          isComponent
            ? "text-fuchsia-600 dark:text-[#D480FF]"
            : node.prototype && "text-purple-600 dark:text-[#9580FF]",
        )}
      >
        {isFolder && node.children.length ? (
          <button
            type="button"
            onDoubleClick={preventDefaultAndStopPropagation}
            onMouseDown={(e) => {
              preventDefaultAndStopPropagation(e);

              if (isExpanded) {
                item.collapse();
              } else {
                item.expand();
              }
            }}
            className="flex items-center justify-center px-1 h-full flex-shrink-0 relative"
          >
            <Icon className="w-3.5 h-3.5 group-hover:opacity-0" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-foreground/20 flex items-center justify-center">
                <ChevronRight
                  className={cn(
                    "w-3 h-3 text-foreground",
                    isExpanded && "rotate-90",
                  )}
                />
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center justify-center px-1 h-full flex-shrink-0 relative">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}

        {isRenaming ? (
          <input
            ref={(r: HTMLInputElement) => {
              if (r) {
                r.focus();
              }
            }}
            onFocus={(e) => {
              e.target.select();
            }}
            onBlur={() => {
              tree.completeRenaming();
            }}
            value={tree.getRenamingValue()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              tree.applySubStateUpdate("renamingValue", e.target?.value);
            }}
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                preventDefaultAndStopPropagation(e);
                tree.completeRenaming();
                return;
              }

              if (e.key === "Escape") {
                preventDefaultAndStopPropagation(e);
                tree.abortRenaming();
                return;
              }
            }}
            className="bg-card outline-none rounded border text-xxs border-blue-400 px-1 h-full leading-[28px]"
          />
        ) : (
          <div className="border border-transparent px-1 text-xxs h-[28px] leading-[28px]">
            {item.getItemName()}
          </div>
        )}
      </div>

      {isRenaming ? null : (
        <div className="sticky w-0 right-0 flex justify-end">
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              const block = manager.scenegraph.beginUpdate();
              block.update(node, {
                enabled: !node.properties.resolved.enabled,
              });
              manager.scenegraph.commitBlock(block, { undo: true });
            }}
            className={cn(
              "flex items-center justify-center h-7 px-2 rounded transition-opacity bg-muted hover:bg-accent",
              "opacity-0 group-hover:opacity-100",
            )}
          >
            {node.properties.resolved.enabled !== false ? (
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

const LayerList = React.memo(() => {
  const manager = useSceneManager();

  const [selection, setSelection] = useState<string[]>(() =>
    Array.from(manager.selectionManager.selectedNodes).map((n) =>
      String(n.localID),
    ),
  );

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const tree = useTree<SceneNode>({
    indent: INDENT_PIXELS,
    rootItemId: "root",
    canReorder: true,

    initialState: {
      selectedItems: selection,
      expandedItems: expandedItems,
    },

    state: {
      selectedItems: selection,
      expandedItems: expandedItems,
    },

    setSelectedItems: (items) => {
      const selection = new Set<SceneNode>();

      for (const item of items as string[]) {
        const node = manager.scenegraph.nodeByLocalID.get(Number(item));
        if (node) {
          selection.add(node);
        }
      }

      manager.selectionManager.setSelection(selection);
    },

    setExpandedItems: (items) => {
      setExpandedItems(items);
    },

    getItemName: (item) => {
      const node = item.getItemData();

      if (node.properties.resolved.name) {
        return node.properties.resolved.name;
      }

      if (node.type === "text") {
        const content = node.properties.resolved.textContent;
        if (content) {
          return content;
        }
      }

      return getNodeTypeName(node.type);
    },

    isItemFolder: (item) => {
      const node = item.getItemData();

      return node.type === "frame" || node.type === "group";
    },

    setDragImage: () => {
      return {
        imgElement: emptyDraggingPreviewElement,
      };
    },

    onRename: (item, value) => {
      const block = manager.scenegraph.beginUpdate();

      const node = item.getItemData();
      block.update(node, {
        name: value,
      });

      manager.scenegraph.commitBlock(block, { undo: true });
    },

    canDrag(items) {
      return items.some((item) => {
        const node = item.getItemData();
        return (
          node.parent?.prototype === undefined ||
          node.parent.prototype.childrenOverridden
        );
      });
    },

    canDrop(_items, target) {
      return target.item.getItemData().canAcceptChildren();
    },

    onDrop(items, target) {
      const block = manager.scenegraph.beginUpdate();

      const parent = target.item.getItemData();

      const visualIndex = (target as any).childIndex as number | undefined;

      const reverse = nodeHasReverseChildOrder(parent);

      let insertIndex = visualIndex;

      items.sort((a, b) => {
        const aIndex = a.getItemMeta().index;
        const bIndex = b.getItemMeta().index;

        if (reverse) {
          return aIndex - bIndex;
        }

        return bIndex - aIndex;
      });

      if (reverse) {
        if (insertIndex != null) {
          insertIndex = parent.children.length - insertIndex;
        }
      }

      for (const item of items) {
        const node = item.getItemData();

        const position = node.getGlobalPosition();

        if (node.parent && node.parent === parent) {
          const currentIndex = node.parent.childIndex(node);
          if (insertIndex != null && currentIndex < insertIndex) {
            insertIndex -= 1;
          }
        }

        block.changeParent(node, parent, insertIndex);

        if (node.parent) {
          const local = node.parent.toLocal(position.x, position.y);
          block.update(node, {
            x: local.x,
            y: local.y,
          });
        }
      }

      manager.scenegraph.commitBlock(block, { undo: true });
    },

    dataLoader: {
      getItem(id) {
        const node =
          id === "root"
            ? manager.scenegraph.getViewportNode()
            : manager.scenegraph.nodeByLocalID.get(Number(id));

        if (!node) {
          throw new Error(`Node not found: ${id}`);
        }

        return node;
      },

      getChildren: (id) => {
        const node =
          id === "root"
            ? manager.scenegraph.getViewportNode()
            : manager.scenegraph.nodeByLocalID.get(Number(id));
        if (!node) {
          throw new Error(`Node not found: ${id}`);
        }

        const list = [];

        for (const child of node.children) {
          if (!child.destroyed) {
            list.push(String(child.localID));
          }
        }

        if (nodeHasReverseChildOrder(node)) {
          list.reverse();
        }

        return list;
      },
    },

    features: [
      syncDataLoaderFeature,
      selectionFeature,
      dragAndDropFeature,
      renamingFeature,
    ],
  });

  const rebuildTree = useEffectEvent((updateSelection: boolean) => {
    if (updateSelection) {
      const newSelection = [];
      const newExpandedItems = new Set(tree.getState().expandedItems);

      // NOTE(sedivy): Auto expand any folders that include selected items.
      for (const node of manager.selectionManager.selectedNodes) {
        newSelection.push(String(node.localID));

        for (
          let parent = node.parent;
          parent && !parent.root;
          parent = parent.parent
        ) {
          newExpandedItems.add(String(parent.localID));
        }
      }

      // NOTE(sedivy): Auto scroll to first selected item.
      const first = newSelection.length > 0 && newSelection[0];
      if (first) {
        const item = tree.getItemInstance(first);

        item.scrollTo({
          behavior: "instant",
          block: "nearest",
        });
      }

      setSelection(newSelection);
      setExpandedItems(Array.from(newExpandedItems));
    }

    tree.rebuildTree();
  });

  useEffect(() => {
    rebuildTree(true);

    function onSelectionChange() {
      rebuildTree(true);
    }

    function onNodeChange() {
      rebuildTree(false);
    }

    function onPropertyChange() {
      rebuildTree(false);
    }

    manager.eventEmitter.on("selectionChange", onSelectionChange);

    manager.scenegraph.on("nodePropertyChange", onPropertyChange);
    manager.scenegraph.on("nodeAdded", onNodeChange);
    manager.scenegraph.on("nodeRemoved", onNodeChange);

    return () => {
      manager.eventEmitter.removeListener("selectionChange", onSelectionChange);
      manager.scenegraph.removeListener("nodePropertyChange", onPropertyChange);
      manager.scenegraph.removeListener("nodeAdded", onNodeChange);
      manager.scenegraph.removeListener("nodeRemoved", onNodeChange);
    };
  }, [manager]);

  return (
    <div className="bg-card relative flex-1 min-h-0 overflow-x-clip">
      <div
        {...tree.getContainerProps()}
        className="py-1 overflow-y-auto h-full"
      >
        <div className="grid">
          {/* TODO(sedivy): Add virtualization */}
          {tree.getItems().map((item) => {
            return (
              <LayerListRow
                key={item.getId()}
                item={item}
                manager={manager}
                tree={tree}
              />
            );
          })}
        </div>
      </div>
      <div
        style={tree.getDragLineStyle()}
        className="h-[1px] bg-foreground rounded"
      />
    </div>
  );
});

export function LayerListPanel() {
  const [width, setWidth] = useConfigValue("leftPanelWidth");

  const getHandleProps = useResizable(
    width,
    { min: 150, max: 400, default: 200 },
    setWidth,
  );

  return (
    <div
      className="bg-card text-card-foreground border relative select-none shadow-none z-10 h-full rounded-none border-l border-t-0 border-r-1 border-border border-b-0 antialiased flex flex-col"
      style={{
        width,
        paddingTop: platform.isElectronMac ? 39 : 0,
      }}
    >
      <div className="bg-card px-3 py-2 border-b flex-shrink-0 border-t-1">
        <h2 className="text-xxs font-medium text-secondary-foreground">
          Layers
        </h2>
      </div>

      <LayerList />

      <div
        className="absolute top-0 right-[-6px] w-[6px] h-full cursor-ew-resize"
        {...getHandleProps()}
      />
    </div>
  );
}

function preventDefaultAndStopPropagation(e: React.UIEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function includeSelectionUpTo(
  tree: TreeInstance<SceneNode>,
  item: ItemInstance<SceneNode>,
) {
  const currentSelection = tree.getSelectedItems();

  const firstSelectedItem = currentSelection[0];

  if (firstSelectedItem == null) {
    tree.setSelectedItems([item.getItemMeta().itemId]);
    return;
  }

  const indexA = item.getItemMeta().index;
  const indexB = firstSelectedItem.getItemMeta().index;

  const startIndex = Math.min(indexA, indexB);
  const endIndex = Math.max(indexA, indexB);

  const selection = new Set<string>();

  const items = tree.getItems();

  for (let i = startIndex; i <= endIndex; i++) {
    const treeItem = items[i];
    selection.add(treeItem.getItemMeta().itemId);
  }

  for (const selectedItem of currentSelection) {
    selection.add(selectedItem.getItemMeta().itemId);
  }

  tree.setSelectedItems(Array.from(selection));
}
