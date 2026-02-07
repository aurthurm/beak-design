import { useStore } from '@tanstack/react-store'
import { useState, useRef, useEffect } from 'react'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, FileText, Layers, Frame, Square, Circle, Minus, Type, Image, GripVertical, Edit2, Trash2, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { NavUser } from '@/components/nav-user'
import type { PageId, Document, FrameId, LayerId } from '@/lib/schema'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { idGenerator } from '@/lib/db/id-generator'

interface PageItemProps {
  page: { id: PageId; name: string }
  isActive: boolean
  onSelect: () => void
}

function PageItem({ page, isActive, onSelect }: PageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(page.name)
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(page.name)
  }, [page.name])

  const handleEdit = () => {
    setIsEditing(true)
    setEditValue(page.name)
  }

  const handleSave = () => {
    if (editValue.trim() && editValue !== page.name) {
      canvasActions.updatePageName(page.id, editValue.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(page.name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleDelete = () => {
    canvasActions.deletePage(page.id)
    setIsDeleteDialogOpen(false)
  }

  const handleBlur = () => {
    handleSave()
  }

  return (
    <SidebarMenuItem
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative group w-full">
        <SidebarMenuButton
          onClick={(e) => {
            if (!isEditing) {
              onSelect()
            }
          }}
          isActive={isActive}
          className="px-2.5 md:px-2 pr-8"
        >
          <FileText className="size-4" />
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="h-6 px-1 text-sm"
            />
          ) : (
            <span className="truncate">{page.name}</span>
          )}
        </SidebarMenuButton>
        {!isEditing && isHovered && (
          <div 
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-sidebar-background z-10"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-sidebar-accent"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleEdit()
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
            >
              <Edit2 className="size-3" />
            </Button>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setIsDeleteDialogOpen(true)
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Page</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{page.name}"? This will permanently delete the page and all of its frames and layers. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </SidebarMenuItem>
  )
}

function getNextPageNumber(pages: Record<PageId, any>): number {
  const pageNumbers = Object.values(pages)
    .map((page) => {
      const match = page.name.match(/^Page (\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)
  
  if (pageNumbers.length === 0) return 1
  
  const maxNumber = Math.max(...pageNumbers)
  return maxNumber + 1
}

function createPage(document: Document): Document {
  const pageId = idGenerator.page()
  const now = new Date().toISOString()
  const nextPageNumber = getNextPageNumber(document.pages)
  const pageName = `Page ${nextPageNumber}`

  const newPage = {
    id: pageId,
    documentId: document.id,
    name: pageName,
    frameIds: [],
    provenance: {
      createdAt: now,
      createdBy: { kind: 'user' },
    },
  }

  return {
    ...document,
    updatedAt: now,
    pages: {
      ...document.pages,
      [pageId]: newPage,
    },
    activePageId: pageId,
  }
}

export function PagesPanel() {
  const state = useStore(canvasStore)
  const document = state.document
  const activePageId = state.activePageId

  // Sort pages by latest first (using updatedAt, fallback to createdAt)
  const pages = document
    ? Object.values(document.pages).sort((a, b) => {
        const aTime = new Date(a.provenance.updatedAt || a.provenance.createdAt).getTime()
        const bTime = new Date(b.provenance.updatedAt || b.provenance.createdAt).getTime()
        return bTime - aTime // Latest first
      })
    : []
  const activePage = activePageId && document ? document.pages[activePageId] : null

  const handlePageSelect = (pageId: string) => {
    if (document) {
      canvasActions.setActivePage(pageId as any)
    }
  }

  const handleCreatePage = () => {
    if (!document) return
    
    const updatedDocument = createPage(document)
    canvasActions.setDocument(updatedDocument)
    canvasActions.setActivePage(updatedDocument.activePageId)
  }

  return (
    <Sidebar collapsible="icon" className="overflow-hidden flex flex-col">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <FileText className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Pages</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col flex-1 overflow-hidden">
        {/* Pages Section - Scrollable */}
        <SidebarGroup className="shrink-0">
          <SidebarGroupContent className="px-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start mb-2"
              onClick={handleCreatePage}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Page
            </Button>
            <div className="overflow-y-auto max-h-[40vh]">
              <SidebarMenu>
                {pages.map((page) => (
                  <PageItem
                    key={page.id}
                    page={page}
                    isActive={page.id === activePageId}
                    onSelect={() => handlePageSelect(page.id)}
                  />
                ))}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separator */}
        <Separator className="my-2" />

        {/* Active Page Name */}
        {activePage && (
          <div className="px-4 py-2 shrink-0">
            <div className="text-sm font-medium text-foreground">{activePage.name}</div>
          </div>
        )}

        {/* Layers Section - Scrollable */}
        <SidebarGroup className="flex-1 overflow-hidden min-h-0">
          <SidebarGroupContent className="px-2 h-full flex flex-col">
            {activePage && document ? (
              <div className="flex-1 overflow-y-auto min-h-0">
                <LayersTree pageId={activePage.id} document={document} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Select a page to view layers
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{
          name: "Admin",
          email: "admin@example.com",
          avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23666'/%3E%3Ctext x='20' y='26' text-anchor='middle' fill='white' font-family='Arial' font-size='16' font-weight='bold'%3EA%3C/text%3E%3C/svg%3E",
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}

function getLayerIcon(layerType: string) {
  switch (layerType) {
    case 'rect':
      return <Square className="size-3" />
    case 'ellipse':
      return <Circle className="size-3" />
    case 'line':
      return <Minus className="size-3" />
    case 'path':
      return <Layers className="size-3" />
    case 'text':
      return <Type className="size-3" />
    case 'image':
      return <Image className="size-3" />
    case 'group':
    case 'componentInstance':
    default:
      return <Layers className="size-3" />
  }
}

interface SortableLayerItemProps {
  layerId: LayerId
  layer: any
  depth: number
  isSelected: boolean
  document: Document
  selection: any
}

function SortableLayerItem({ layerId, layer, depth, isSelected, document, selection }: SortableLayerItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layerId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasChildren = layer.children && layer.children.length > 0
  const isHidden = layer.flags?.hidden ?? false
  const isLocked = layer.flags?.locked ?? false

  // Sort children by latest first
  const sortedChildren = hasChildren
    ? [...layer.children]
        .map((childId: string) => document.layers[childId])
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const aTime = new Date(a.provenance?.updatedAt || a.provenance?.createdAt || 0).getTime()
          const bTime = new Date(b.provenance?.updatedAt || b.provenance?.createdAt || 0).getTime()
          return bTime - aTime // Latest first
        })
        .map((child: any) => child.id)
    : []

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...style, paddingLeft: `${depth * 16}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarMenuItem>
        <div className="relative group w-full">
          <SidebarMenuButton
            onClick={() => {
              if (!isLocked) {
                canvasActions.setSelection({
                  ...selection,
                  selectedIds: [layerId],
                })
              }
            }}
            isActive={isSelected}
            className="px-2 text-xs pr-8"
          >
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mr-1 touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-3 text-muted-foreground" />
            </div>
            {getLayerIcon(layer.type)}
            <span className={`truncate ${isHidden ? 'opacity-50' : ''}`}>{layer.name || layer.type}</span>
          </SidebarMenuButton>
          {isHovered && (
            <div 
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-sidebar-background z-10"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  canvasActions.toggleLayerVisibility(layerId)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                {isHidden ? (
                  <EyeOff className="size-3 text-muted-foreground" />
                ) : (
                  <Eye className="size-3 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  canvasActions.toggleLayerLock(layerId)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                {isLocked ? (
                  <Lock className="size-3 text-muted-foreground" />
                ) : (
                  <Unlock className="size-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          )}
        </div>
      </SidebarMenuItem>
      {sortedChildren.map((childId: string) => {
        const childLayer = document.layers[childId]
        if (!childLayer) return null
        return (
          <SortableLayerItem
            key={childId}
            layerId={childId}
            layer={childLayer}
            depth={depth + 1}
            isSelected={selection.selectedIds.includes(childId)}
            document={document}
            selection={selection}
          />
        )
      })}
    </div>
  )
}

function LayersTree({ pageId, document }: { pageId: string; document: any }) {
  const page = document.pages[pageId]
  if (!page) return null

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort frames by latest first (using updatedAt, fallback to createdAt)
  const frames = page.frameIds
    .map((frameId: string) => document.frames[frameId])
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const aTime = new Date(a.provenance?.updatedAt || a.provenance?.createdAt || 0).getTime()
      const bTime = new Date(b.provenance?.updatedAt || b.provenance?.createdAt || 0).getTime()
      return bTime - aTime // Latest first
    })

  // Get free-floating layers (layers that belong to the page but are not in any frame's childLayerIds)
  const freeFloatingLayers = Object.values(document.layers).filter((layer: any) => {
    // Check if layer belongs to this page (by checking if its frameId is in this page's frames)
    const layerFrame = layer.frameId ? document.frames[layer.frameId] : null
    const belongsToPage = layerFrame && frames.some((f: any) => f.id === layerFrame.id)
    
    if (!belongsToPage) return false
    
    // Check if layer is NOT in any frame's childLayerIds
    const isInAnyFrame = frames.length > 0 && frames.some((frame: any) => frame.childLayerIds.includes(layer.id))
    return !isInAnyFrame
  }).sort((a: any, b: any) => {
    // Sort free-floating layers by latest first
    const aTime = new Date(a.provenance?.updatedAt || a.provenance?.createdAt || 0).getTime()
    const bTime = new Date(b.provenance?.updatedAt || b.provenance?.createdAt || 0).getTime()
    return bTime - aTime // Latest first
  })

  const selection = canvasStore.state.selection

  const handleDragEnd = (event: DragEndEvent, frameId: FrameId) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const frame = document.frames[frameId]
    if (!frame) return

    const oldIndex = frame.childLayerIds.indexOf(active.id as LayerId)
    const newIndex = frame.childLayerIds.indexOf(over.id as LayerId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(frame.childLayerIds, oldIndex, newIndex)
      canvasActions.reorderLayers(frameId, newOrder)
    }
  }

  return (
    <SidebarMenu>
      {frames.map((frame: any) => {
        // Use the actual order from frame.childLayerIds (not sorted by time)
        const childLayerIds = frame.childLayerIds.filter((layerId: string) => document.layers[layerId])

        return (
          <FrameItem
            key={frame.id}
            frame={frame}
            isSelected={selection.selectedIds.includes(frame.id)}
            selection={selection}
            document={document}
            sensors={sensors}
            childLayerIds={childLayerIds}
            onDragEnd={(event) => handleDragEnd(event, frame.id)}
          />
        )
      })}
      {/* Render free-floating layers at the same level as frames */}
      {freeFloatingLayers.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={() => {
            // Free-floating layers don't support reordering yet
          }}
        >
          <SortableContext items={freeFloatingLayers.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
            {freeFloatingLayers.map((layer: any) => {
              return (
                <SortableLayerItem
                  key={layer.id}
                  layerId={layer.id}
                  layer={layer}
                  depth={0}
                  isSelected={selection.selectedIds.includes(layer.id)}
                  document={document}
                  selection={selection}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      )}
    </SidebarMenu>
  )
}

interface FrameItemProps {
  frame: any
  isSelected: boolean
  selection: any
  document: any
  sensors: any
  childLayerIds: string[]
  onDragEnd: (event: DragEndEvent) => void
}

function FrameItem({ frame, isSelected, selection, document, sensors, childLayerIds, onDragEnd }: FrameItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isHidden = frame.flags?.hidden ?? false
  const isLocked = frame.flags?.locked ?? false

  return (
    <div 
      key={frame.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarMenuItem>
        <div className="relative group w-full">
          <SidebarMenuButton
            onClick={() => {
              if (!isLocked) {
                canvasActions.setSelection({
                  ...selection,
                  selectedIds: [frame.id],
                })
              }
            }}
            isActive={isSelected}
            className="px-2 font-medium pr-8"
          >
            <Frame className="size-4" />
            <span className={isHidden ? 'opacity-50' : ''}>{frame.name}</span>
          </SidebarMenuButton>
          {isHovered && (
            <div 
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-sidebar-background z-10"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  canvasActions.toggleFrameVisibility(frame.id)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                {isHidden ? (
                  <EyeOff className="size-3 text-muted-foreground" />
                ) : (
                  <Eye className="size-3 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  canvasActions.toggleFrameLock(frame.id)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                {isLocked ? (
                  <Lock className="size-3 text-muted-foreground" />
                ) : (
                  <Unlock className="size-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          )}
        </div>
      </SidebarMenuItem>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={childLayerIds} strategy={verticalListSortingStrategy}>
          {childLayerIds.map((layerId: string) => {
            const layer = document.layers[layerId]
            if (!layer) return null
            return (
              <SortableLayerItem
                key={layerId}
                layerId={layerId}
                layer={layer}
                depth={1}
                isSelected={selection.selectedIds.includes(layerId)}
                document={document}
                selection={selection}
              />
            )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
