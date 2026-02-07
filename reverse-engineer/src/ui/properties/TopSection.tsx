import {
  Focus,
  Moon,
  Sun,
  DiamondPlus,
  DiamondMinus,
  SquareDashed,
  PlusIcon,
  XIcon,
  PanelRight,
  PanelRightOpen,
  SquareStack,
  CopyIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type SceneNode,
  type ObjectUpdateBlock,
  FrameNode,
  SceneGraph,
} from "@ha/pencil-editor";
import { Button } from "../../components/button";
import { InputIcon } from "../../components/input-icon";
import { cn, getNodeTypeName } from "../../lib/utils";
import { blockUpdate } from "./shared-handlers";
import { useSceneManager } from "@/src/pages/Editor";
import { Textarea } from "@/src/components/textarea";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/src/components/accordion";
import { getNodeIcon } from "@/src/lib/node-icons";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { PopoverPicker } from "@/src/components/popover-picker";
import { logger } from "@ha/shared";

interface TopSectionProps {
  isDarkMode: boolean;
  isCollapsed: boolean;
  metaSelectedNodesLength: number;
  metaLayerName: string;
  context?: string;
  toggleTheme: () => void;
  setIsCollapsed?: (collapsed: boolean) => void;
}

function CollapseToggleButton({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsCollapsed?.(!isCollapsed)}
      className="w-6 h-6 p-0"
    >
      {isCollapsed ? (
        <PanelRightOpen className="h-5 w-4" strokeWidth={1} />
      ) : (
        <PanelRight className="h-5 w-4" strokeWidth={1} />
      )}
    </Button>
  );
}

const TopSection = memo(function TopSection({
  isDarkMode,
  isCollapsed,
  metaSelectedNodesLength,
  metaLayerName,
  context,
  toggleTheme,
  setIsCollapsed,
}: TopSectionProps) {
  const manager = useSceneManager();

  const singleSelectedNodeRef = useRef<SceneNode | undefined>(null);
  const subscribeSelection = useCallback(
    (onChange: () => void) => {
      const listener = () => {
        singleSelectedNodeRef.current = null;
        onChange();
      };
      manager.eventEmitter.on("selectionChangeDebounced", listener);
      return () =>
        manager.eventEmitter.off("selectionChangeDebounced", listener);
    },
    [manager],
  );
  const getSingleSelectedNode = useCallback(() => {
    if (singleSelectedNodeRef.current === null) {
      singleSelectedNodeRef.current =
        manager.selectionManager.getSingleSelectedNode();
    }
    return singleSelectedNodeRef.current;
  }, [manager]);
  const singleSelectedNode = useSyncExternalStore(
    subscribeSelection,
    getSingleSelectedNode,
  );

  const singleSelectedNodeInfoRef = useRef<{
    singleSelectedNode: SceneNode | undefined;
    isInstance: boolean;
    isComponent: boolean;
    isUnique: boolean;
    canBeSlot: boolean;
    slot: SceneNode[] | undefined;
    isSlotInstance: boolean;
    availableComponents: SceneNode[] | undefined;
  }>(undefined);
  const subscribeSingleSelectedNode = useCallback(
    (onChange: () => void) => {
      if (singleSelectedNode) {
        const listener = () => {
          singleSelectedNodeInfoRef.current = undefined;
          onChange();
        };
        manager.eventEmitter.on(
          "selectedNodePropertyChangeDebounced",
          listener,
        );
        return () =>
          manager.eventEmitter.off(
            "selectedNodePropertyChangeDebounced",
            listener,
          );
      } else {
        return () => {};
      }
    },
    [manager, singleSelectedNode],
  );
  const getSingleSelectedNodeInfo = useCallback(() => {
    if (
      !singleSelectedNodeInfoRef.current ||
      singleSelectedNodeInfoRef.current?.singleSelectedNode !==
        singleSelectedNode
    ) {
      const isUnique = singleSelectedNode?.isUnique === true;
      const isInstance =
        singleSelectedNode?.prototype !== undefined && isUnique;
      const isComponent = singleSelectedNode?.reusable === true;

      let isSlotInstance = false;
      let canBeSlot = false;
      let slot: SceneNode[] | undefined;
      let availableComponents: SceneNode[] | undefined;

      if (singleSelectedNode instanceof FrameNode) {
        canBeSlot = singleSelectedNode.canBeSlot;
        isSlotInstance = singleSelectedNode.isSlotInstance;

        // NOTE(zaza): these are the components that would cause
        // circular refs if inserted under `singleSelectedNode`,
        //  so we don't want to offer them on the UI.
        let bannedComponents: Set<SceneNode> | undefined;
        if (isSlotInstance) {
          bannedComponents = new Set();
          const collectBannedComponents = (node: SceneNode) => {
            if (node.reusable) {
              bannedComponents!.add(node);
            }
            if (node.parent) {
              collectBannedComponents(node.parent);
            }
            for (const instance of node.instances) {
              if (!instance.isUnique) {
                continue;
              }
              collectBannedComponents(instance);
            }
          };
          collectBannedComponents(singleSelectedNode);
        }

        for (
          let node: FrameNode | undefined = singleSelectedNode;
          node && !slot;
          node = node.prototype?.node
        ) {
          slot = node.slot
            ?.map((id) => manager.scenegraph.getNodeByPath(id))
            .filter(
              (node) => node?.reusable && bannedComponents?.has(node) !== true,
            ) as SceneNode[] | undefined;
        }
        if (slot && !isSlotInstance) {
          const slotSet = new Set(slot);
          availableComponents = [];
          const collectComponents = (node: SceneNode) => {
            if (node.reusable && !slotSet.has(node)) {
              availableComponents!.push(node);
            }
            node.children.forEach(collectComponents);
          };
          collectComponents(manager.scenegraph.getViewportNode());
          availableComponents.sort((a, b) => {
            const aName = a.properties.resolved.name ?? getNodeTypeName(a.type);
            const bName = b.properties.resolved.name ?? getNodeTypeName(b.type);
            return aName.localeCompare(bName);
          });
        }
      }
      singleSelectedNodeInfoRef.current = {
        singleSelectedNode,
        isInstance,
        isComponent,
        isUnique,
        canBeSlot,
        slot,
        isSlotInstance,
        availableComponents,
      };
    }
    return singleSelectedNodeInfoRef.current;
  }, [manager, singleSelectedNode]);
  const {
    isInstance,
    isComponent,
    isUnique,
    canBeSlot,
    slot,
    isSlotInstance,
    availableComponents,
  } = useSyncExternalStore(
    subscribeSingleSelectedNode,
    getSingleSelectedNodeInfo,
  );
  const isComponentOrInstance = isInstance || isComponent;

  const NodeIcon = singleSelectedNode && getNodeIcon(singleSelectedNode);

  const handleToggleSlot = () => {
    blockUpdate(manager, (block, node) => {
      if (!(node instanceof FrameNode)) {
        logger.error("Must be a frame.");
        return;
      }
      node.setSlot(block.rollback, node.slot ? undefined : []);
    });
  };

  const handleNavigateToComponent = () => {
    const prototypeNode = singleSelectedNode!.prototype!.node;
    manager.selectionManager.setSelection(new Set([prototypeNode]));
    const bounds = prototypeNode.getVisualWorldBounds();
    manager.camera.zoomToBounds(bounds, 40);
    if (manager.camera.zoom > 1) {
      manager.camera.setZoom(1, true);
    }
  };

  const handleCreateComponent = () => {
    blockUpdate(manager, (block, node) => {
      node.setReusable(block.rollback, true);
    });
  };

  const handleDetachComponent = () => {
    blockUpdate(manager, (block, node) => {
      node.setReusable(block.rollback, false);
    });
  };

  const handleDetachInstance = () => {
    blockUpdate(manager, (block, node) => {
      node.ensurePrototypeReusability(block.rollback, 1);
    });
  };

  const handleAddToSlot = (component?: SceneNode) => {
    setSlotPopoverOpen(false);
    if (!component) {
      return;
    }
    blockUpdate(manager, (block, node) => {
      if (!(node instanceof FrameNode)) {
        logger.error("Must be a frame.");
        return;
      }
      node.setSlot(
        block.rollback,
        node.slot!.toSpliced(node.slot!.length, 0, component.id),
      );
    });
  };

  const handleSelectComponent = useCallback(
    (component: SceneNode) => {
      blockUpdate(manager, (block, node) => {
        const createdNode = component.createInstancesFromSubtree();
        createdNode.id = SceneGraph.createUniqueID();
        createdNode.ensurePrototypeReusability(null);
        block.addNode(createdNode, node);
      });
    },
    [manager],
  );

  const handleDeleteComponent = useCallback(
    (component: SceneNode) => {
      blockUpdate(manager, (block, node) => {
        if (!(node instanceof FrameNode)) {
          logger.error("Must be a frame.");
          return;
        }
        node.setSlot(
          block.rollback,
          node.slot!.toSpliced(node.slot!.indexOf(component.id), 1),
        );
      });
    },
    [manager],
  );

  const slotPopoverAnchorRef = useRef<SVGSVGElement>(null!);
  const [slotPopoverOpen, setSlotPopoverOpen] = useState(false);

  return (
    <>
      {metaSelectedNodesLength === 1 ? (
        <div className="flex flex-col items-stretch no-drag">
          <div className="p-2 flex items-center gap-0">
            <InputIcon
              wrapperClassName={cn(
                "flex-1 rounded-[4px] mr-1",
                isComponent && "bg-[#42324b]",
                isInstance &&
                  "border border-[1px] border-dashed border-[#9580FF]",
              )}
              transparent={true}
              draggable={false}
              icon={
                NodeIcon ? (
                  <NodeIcon
                    strokeWidth={1}
                    className={cn(
                      "w-3.5 h-3.5",
                      isInstance && "text-[#9580FF]",
                      isComponent && "text-[#d480ff]",
                      !isComponentOrInstance &&
                        "text-zinc-800 dark:text-zinc-100",
                    )}
                  />
                ) : undefined
              }
              value={metaLayerName}
              onCommit={(value) => {
                blockUpdate(
                  manager,
                  (block: ObjectUpdateBlock, node: SceneNode) => {
                    block.update(node, { name: value });
                  },
                );
              }}
              className={cn(
                "h-6 border-0 shadow-none text-[11px]",
                isInstance && "text-[#9580FF]",
                isComponent && "text-[#d480ff]",
              )}
              iconClassName={
                isComponentOrInstance ? "text-[#d480ff]" : undefined
              }
            />
            {canBeSlot && singleSelectedNode?.children.length === 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-6 h-6 p-0 shrink-0",
                  slot && "bg-[#42324b] text-[#d480ff]",
                )}
                onClick={handleToggleSlot}
                title={slot ? "Remove slot" : "Make slot"}
              >
                <SquareDashed className="w-3.5 h-3.5" strokeWidth={1} />
              </Button>
            )}
            {isInstance && (
              <div className="flex items-center gap-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 p-0 shrink-0"
                  onClick={handleNavigateToComponent}
                  title="Go to component"
                >
                  <Focus className="w-3.5 h-3.5" strokeWidth={1} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 p-0 shrink-0"
                  onClick={handleDetachInstance}
                  title="Detach instance"
                >
                  <DiamondMinus className="w-3.5 h-3.5" strokeWidth={1} />
                </Button>
              </div>
            )}
            {isComponent ? (
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 p-0 shrink-0"
                onClick={handleDetachComponent}
                title="Detach component"
              >
                <DiamondMinus className="w-3.5 h-3.5" strokeWidth={1} />
              </Button>
            ) : (
              isUnique && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 p-0 shrink-0"
                  onClick={handleCreateComponent}
                  title="Create component"
                >
                  <DiamondPlus className="w-3.5 h-3.5" strokeWidth={1} />
                </Button>
              )
            )}
            <CollapseToggleButton
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
            />
          </div>
          {!isCollapsed &&
            slot &&
            (singleSelectedNode!.children.length === 0 ||
              (isSlotInstance &&
                singleSelectedNode!.prototype!.childrenOverridden)) &&
            (!isSlotInstance || slot.length !== 0) && (
              <Section>
                <div className="flex items-center justify-between text-secondary-foreground">
                  <SectionTitle title="Slot" />
                  {!isSlotInstance && availableComponents?.length !== 0 && (
                    <PopoverPicker<SceneNode>
                      values={availableComponents!}
                      valueKey={(node) => node.localID.toString()}
                      valueLabel={(node) =>
                        node.properties.resolved.name ??
                        getNodeTypeName(node.type)
                      }
                      onFilter={(searchTerm, node) =>
                        node.properties.resolved.name
                          ?.toLowerCase()
                          .includes(searchTerm.toLowerCase()) ?? false
                      }
                      onCommit={handleAddToSlot}
                      open={slotPopoverOpen}
                      onOpenChange={setSlotPopoverOpen}
                      anchorRef={slotPopoverAnchorRef}
                    >
                      <PlusIcon
                        ref={slotPopoverAnchorRef}
                        size={14}
                        className="opacity-70"
                      />
                    </PopoverPicker>
                  )}
                </div>
                {isSlotInstance
                  ? slot.map((node) => (
                      <InstanceSlotButton
                        key={node.localID}
                        name={
                          node.properties.resolved.name ??
                          getNodeTypeName(node.type)
                        }
                        onSelect={() => handleSelectComponent(node)}
                      />
                    ))
                  : slot.map((node) => (
                      <ComponentSlotButton
                        key={node.localID}
                        name={
                          node.properties.resolved.name ??
                          getNodeTypeName(node.type)
                        }
                        onDelete={() => handleDeleteComponent(node)}
                      />
                    ))}
              </Section>
            )}
          {!isCollapsed && (
            <Accordion
              className="p-3 border-t"
              key={
                context /* NOTE(zaza): using `key` to force reloading when selection changes */
              }
              type="single"
              defaultValue={
                (context?.length ?? 0) !== 0 ? "context" : undefined
              }
              collapsible
            >
              <AccordionItem value="context">
                <AccordionTrigger className="!text-secondary-foreground text-xxs p-0">
                  Context
                </AccordionTrigger>
                <AccordionContent className="p-0 pt-1">
                  <Textarea
                    className="!text-xxs p-1 field-sizing-content min-h-6 max-h-20"
                    onBlur={(e) => {
                      blockUpdate(
                        manager,
                        (block: ObjectUpdateBlock, node: SceneNode) => {
                          block.update(node, { context: e.target.value });
                        },
                      );
                    }}
                    defaultValue={context}
                    placeholder="Context information"
                  ></Textarea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-stretch">
          {metaSelectedNodesLength > 1 ? (
            <div className="p-2 flex items-center gap-1 justify-between">
              <span
                className="h-6 p-1 text-muted-foreground font-mono align-left flex items-center gap-1"
                style={{ fontSize: "11px" }}
              >
                <CopyIcon className="w-4 h-4 pr-1" strokeWidth={1} />
                {metaSelectedNodesLength} Selected
              </span>
              <CollapseToggleButton
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
              />
            </div>
          ) : (
            <span style={{ fontSize: "11px" }}>&nbsp;</span>
          )}
        </div>
      )}
    </>
  );
});

function ComponentSlotButton({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      className="text-ellipsis overflow-hidden text-nowrap block text-xxs pr-4 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {name}
      <button
        type="button"
        className={cn(
          "hover:text-sidebar-foreground absolute block h-full top-0 right-0",
          !isHovered && "invisible",
        )}
        onClick={onDelete}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

function InstanceSlotButton({
  name,
  onSelect,
}: {
  name: string;
  onSelect: () => void;
}) {
  return (
    <Button
      className="text-left text-ellipsis overflow-hidden text-nowrap block text-xxs"
      variant="ghost"
      size="sm"
      onClick={onSelect}
    >
      {name}
    </Button>
  );
}

export default TopSection;
