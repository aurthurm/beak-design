import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Toggle } from '@/components/ui/toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { 
  ChevronDown, 
  Link as LinkIcon,
  Unlink,
  MinusCircle,
  Square,
  RotateCw,
  Circle,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Minus,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Bold,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Settings,
  Download,
  Maximize2,
} from 'lucide-react'
import { useState } from 'react'
import type { Layer, LayerId, Frame, FrameId, PlatformTag, FillStyle } from '@/lib/schema'

// Helper function to update a layer directly in the document
function updateLayer(layerId: LayerId, patch: Partial<Layer>): void {
  const state = canvasStore.state
  if (!state.document) return

  const layer = state.document.layers[layerId]
  if (!layer) return

  const updatedDocument = {
    ...state.document,
    updatedAt: new Date().toISOString(),
    layers: {
      ...state.document.layers,
      [layerId]: {
        ...layer,
        ...patch,
      },
    },
  }

  canvasActions.setDocument(updatedDocument)
}

// Helper function to update a frame directly in the document
function updateFrame(frameId: FrameId, patch: Partial<Frame>): void {
  const state = canvasStore.state
  if (!state.document) return

  const frame = state.document.frames[frameId]
  if (!frame) return

  const updatedDocument = {
    ...state.document,
    updatedAt: new Date().toISOString(),
    frames: {
      ...state.document.frames,
      [frameId]: {
        ...frame,
        ...patch,
      },
    },
  }

  // If frame is being locked/unlocked, automatically lock/unlock all child layers
  if ('flags' in patch && patch.flags?.locked !== undefined) {
    const isLocked = patch.flags.locked
    const updatedLayers = { ...updatedDocument.layers }
    
    // Lock/unlock all child layers
    frame.childLayerIds.forEach((layerId) => {
      const layer = updatedLayers[layerId]
      if (layer) {
        updatedLayers[layerId] = {
          ...layer,
          flags: {
            ...layer.flags,
            locked: isLocked,
          },
        }
      }
    })
    
    updatedDocument.layers = updatedLayers
  }

  canvasActions.setDocument(updatedDocument)
}

// Frame size presets
const FRAME_PRESETS: Record<PlatformTag, Array<{ name: string; width: number; height: number }>> = {
  mobile: [
    { name: 'iPhone 15 Pro', width: 393, height: 852 },
    { name: 'iPhone 15', width: 393, height: 852 },
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'Android', width: 360, height: 640 },
    { name: 'Samsung Galaxy', width: 360, height: 800 },
  ],
  tablet: [
    { name: 'iPad Pro', width: 1024, height: 1366 },
    { name: 'iPad', width: 768, height: 1024 },
    { name: 'iPad Mini', width: 768, height: 1024 },
    { name: 'Android Tablet', width: 800, height: 1280 },
  ],
  desktop: [
    { name: 'Desktop HD', width: 1920, height: 1080 },
    { name: 'Desktop Full HD', width: 1920, height: 1080 },
    { name: 'Desktop 4K', width: 3840, height: 2160 },
    { name: 'MacBook Pro', width: 1440, height: 900 },
    { name: 'MacBook Air', width: 1280, height: 800 },
  ],
  web: [
    { name: 'Web Standard', width: 1440, height: 1024 },
    { name: 'Web Wide', width: 1920, height: 1080 },
    { name: 'Web Narrow', width: 1280, height: 800 },
  ],
  custom: [],
}

export function InspectorPanel() {
  const state = useStore(canvasStore)
  const selection = state.selection
  const document = state.document
  const [linkedDimensions, setLinkedDimensions] = useState(true)
  const [linkedCorners, setLinkedCorners] = useState(true)

  if (!document) {
    return (
      <div className="h-full p-4">
        <h2 className="text-lg font-semibold mb-4">Inspector</h2>
        <p className="text-sm text-muted-foreground">No document loaded</p>
      </div>
    )
  }

  const selectedItems = selection.selectedIds
    .map((id) => {
      if (document.frames[id]) return { type: 'frame', id, data: document.frames[id] }
      if (document.layers[id]) return { type: 'layer', id, data: document.layers[id] }
      return null
    })
    .filter(Boolean) as Array<{ type: 'frame' | 'layer'; id: string; data: any }>

  if (selectedItems.length === 0) {
    return (
      <div className="h-full p-4">
        <h2 className="text-lg font-semibold mb-4">Inspector</h2>
        <p className="text-sm text-muted-foreground">No selection</p>
      </div>
    )
  }

  const firstItem = selectedItems[0]
  const isFrame = firstItem.type === 'frame'
  const isRectLayer = firstItem.type === 'layer' && firstItem.data.type === 'rect'
  const isEllipseLayer = firstItem.type === 'layer' && firstItem.data.type === 'ellipse'
  const isLineLayer = firstItem.type === 'layer' && firstItem.data.type === 'line'
  const isMultiSelect = selectedItems.length > 1

  if (isMultiSelect) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Inspector</h2>
          <p className="text-sm text-muted-foreground">
            {selectedItems.length} items selected
          </p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">
            Multi-selection editing coming soon
          </p>
        </ScrollArea>
      </div>
    )
  }

  const layer = firstItem.type === 'layer' ? firstItem.data : null
  const layerId = firstItem.id as LayerId
  const frame = firstItem.type === 'frame' ? firstItem.data : null
  const frameId = firstItem.id as FrameId

  // Render frame-specific controls
  if (isFrame && frame) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Frame Inspector</h2>
          <p className="text-sm text-muted-foreground">
            {frame.name || 'Unnamed Frame'}
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Frame Properties */}
            <Section title="Frame">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={frame.name || ''}
                  onChange={(e) => {
                    updateFrame(frameId, { name: e.target.value })
                  }}
                />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Platform</Label>
                <NativeSelect
                  value={frame.platform || 'custom'}
                  onChange={(e) => {
                    updateFrame(frameId, { platform: e.target.value as PlatformTag })
                  }}
                  className="w-full"
                >
                  <NativeSelectOption value="mobile">Mobile</NativeSelectOption>
                  <NativeSelectOption value="tablet">Tablet</NativeSelectOption>
                  <NativeSelectOption value="desktop">Desktop</NativeSelectOption>
                  <NativeSelectOption value="web">Web</NativeSelectOption>
                  <NativeSelectOption value="custom">Custom</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {frame.flags?.locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="frame-lock-toggle" className="cursor-pointer text-sm">
                      Lock
                    </Label>
                  </div>
                  <Switch
                    id="frame-lock-toggle"
                    checked={frame.flags?.locked || false}
                    onCheckedChange={(checked) => {
                      updateFrame(frameId, {
                        flags: {
                          ...frame.flags,
                          locked: checked,
                        },
                      })
                    }}
                  />
                </div>
              </div>
            </Section>

            {/* Transform */}
            <Section title="Transform">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>X</Label>
                  <Input
                    type="number"
                    value={Math.round(frame.rect.x || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      updateFrame(frameId, {
                        rect: { ...frame.rect, x: value },
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Y</Label>
                  <Input
                    type="number"
                    value={Math.round(frame.rect.y || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      updateFrame(frameId, {
                        rect: { ...frame.rect, y: value },
                      })
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Width</Label>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-4 w-4"
                      onClick={() => setLinkedDimensions(!linkedDimensions)}
                      title={linkedDimensions ? 'Unlink dimensions' : 'Link dimensions'}
                    >
                      {linkedDimensions ? (
                        <LinkIcon className="h-3 w-3" />
                      ) : (
                        <Unlink className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <Input
                    type="number"
                    value={Math.round(frame.rect.w || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      if (linkedDimensions) {
                        const aspectRatio = frame.rect.h / frame.rect.w
                        updateFrame(frameId, {
                          rect: {
                            ...frame.rect,
                            w: value,
                            h: value * aspectRatio,
                          },
                        })
                      } else {
                        updateFrame(frameId, {
                          rect: { ...frame.rect, w: value },
                        })
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={Math.round(frame.rect.h || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      if (linkedDimensions) {
                        const aspectRatio = frame.rect.w / frame.rect.h
                        updateFrame(frameId, {
                          rect: {
                            ...frame.rect,
                            h: value,
                            w: value * aspectRatio,
                          },
                        })
                      } else {
                        updateFrame(frameId, {
                          rect: { ...frame.rect, h: value },
                        })
                      }
                    }}
                  />
                </div>
              </div>
              {/* Size Presets */}
              {FRAME_PRESETS[frame.platform]?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label>Presets</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Maximize2 className="h-4 w-4" />
                          Size Presets
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {FRAME_PRESETS[frame.platform].map((preset) => (
                        <DropdownMenuItem
                          key={preset.name}
                          onClick={() => {
                            updateFrame(frameId, {
                              rect: {
                                ...frame.rect,
                                w: preset.width,
                                h: preset.height,
                              },
                            })
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{preset.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {preset.width} × {preset.height}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </Section>

            {/* Background */}
            <Section title="Background">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={frame.background?.kind === 'none' || !frame.background ? 'none' : 'solid'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        updateFrame(frameId, {
                          background: { kind: 'none' },
                        })
                      } else {
                        updateFrame(frameId, {
                          background: {
                            kind: 'solid',
                            color: {
                              literal: { format: 'hex', hex: '#ffffff' },
                            },
                          },
                        })
                      }
                    }}
                  >
                    <ToggleGroupItem value="none" aria-label="No background">
                      <MinusCircle className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="solid" aria-label="Solid background">
                      <Square className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {frame.background && frame.background.kind === 'solid' && (
                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={
                          frame.background.color && 'literal' in frame.background.color
                            ? frame.background.color.literal.hex
                            : '#ffffff'
                        }
                        onChange={(e) => {
                          updateFrame(frameId, {
                            background: {
                              kind: 'solid',
                              color: {
                                literal: { format: 'hex', hex: e.target.value },
                              },
                            },
                          })
                        }}
                        className="h-10 w-20"
                      />
                      <Input
                        value={
                          frame.background.color && 'literal' in frame.background.color
                            ? frame.background.color.literal.hex
                            : '#ffffff'
                        }
                        onChange={(e) => {
                          const hex = e.target.value.replace('#', '')
                          if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                            updateFrame(frameId, {
                              background: {
                                kind: 'solid',
                                color: {
                                  literal: { format: 'hex', hex: `#${hex}` },
                                },
                              },
                            })
                          }
                        }}
                        placeholder="#ffffff"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Alignment & Constraints */}
            <Section title="Alignment">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Horizontal</Label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align left')
                      }}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align center')
                      }}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align right')
                      }}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vertical</Label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align top')
                      }}
                    >
                      <AlignStartVertical className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align middle')
                      }}
                    >
                      <AlignCenterVertical className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        console.log('Align bottom')
                      }}
                    >
                      <AlignEndVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Section>

            {/* Export Settings */}
            <Section title="Export">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Export Scale</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          1x
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => console.log('Export 1x')}>
                        1x (Standard)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => console.log('Export 2x')}>
                        2x (Retina)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => console.log('Export 3x')}>
                        3x (Super Retina)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    console.log('Export frame:', frameId)
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Frame
                </Button>
              </div>
            </Section>

            {/* Frame Info */}
            <Section title="Info">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Layers:</span>
                  <span className="font-medium">{frame.childLayerIds?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aspect Ratio:</span>
                  <span className="font-medium">
                    {(frame.rect.w / frame.rect.h).toFixed(2)}:1
                  </span>
                </div>
              </div>
            </Section>
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Render layer controls (existing code)
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <p className="text-sm text-muted-foreground">
          {firstItem.data.name || 'Unnamed'}
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Layer Properties */}
          <Section title="Layer">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={firstItem.data.name || ''}
                onChange={(e) => {
                  if (layer) {
                    updateLayer(layerId, { name: e.target.value })
                  }
                }}
              />
            </div>
            {layer && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {layer.flags?.locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="lock-toggle" className="cursor-pointer text-sm">
                      Lock
                    </Label>
                  </div>
                  <Switch
                    id="lock-toggle"
                    checked={layer.flags?.locked || false}
                    onCheckedChange={(checked) => {
                      updateLayer(layerId, {
                        flags: {
                          ...layer.flags,
                          locked: checked,
                        },
                      })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {layer.flags?.hidden ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="hide-toggle" className="cursor-pointer text-sm">
                      Visible
                    </Label>
                  </div>
                  <Switch
                    id="hide-toggle"
                    checked={!(layer.flags?.hidden || false)}
                    onCheckedChange={(checked) => {
                      updateLayer(layerId, {
                        flags: {
                          ...layer.flags,
                          hidden: !checked,
                        },
                      })
                    }}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* Transform */}
          <Section title="Transform">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>X</Label>
                <Input
                  type="number"
                  value={Math.round(firstItem.data.rect.x || 0)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    if (layer) {
                      updateLayer(layerId, {
                        rect: { ...layer.rect, x: value },
                      })
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Y</Label>
                <Input
                  type="number"
                  value={Math.round(firstItem.data.rect.y || 0)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    if (layer) {
                      updateLayer(layerId, {
                        rect: { ...layer.rect, y: value },
                      })
                    }
                  }}
                />
              </div>
            </div>
            {/* Size controls - special handling for ellipse/circle */}
            {isEllipseLayer && layer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Size</Label>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-4 w-4"
                    onClick={() => setLinkedDimensions(!linkedDimensions)}
                    title={linkedDimensions ? 'Unlink dimensions (make ellipse)' : 'Link dimensions (make circle)'}
                  >
                    {linkedDimensions ? (
                      <LinkIcon className="h-3 w-3" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {linkedDimensions ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Radius</Label>
                    <Input
                      type="number"
                      value={Math.round((layer.rect.w || layer.rect.h || 0) / 2)}
                      onChange={(e) => {
                        const radius = parseFloat(e.target.value) || 0
                        const diameter = radius * 2
                        updateLayer(layerId, {
                          rect: {
                            ...layer.rect,
                            w: diameter,
                            h: diameter,
                          },
                        })
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Diameter: {Math.round(layer.rect.w || 0)}px
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Width</Label>
                      <Input
                        type="number"
                        value={Math.round(layer.rect.w || 0)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          updateLayer(layerId, {
                            rect: { ...layer.rect, w: value },
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Height</Label>
                      <Input
                        type="number"
                        value={Math.round(layer.rect.h || 0)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          updateLayer(layerId, {
                            rect: { ...layer.rect, h: value },
                          })
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Width</Label>
                    {!isEllipseLayer && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-4 w-4"
                        onClick={() => setLinkedDimensions(!linkedDimensions)}
                        title={linkedDimensions ? 'Unlink dimensions' : 'Link dimensions'}
                      >
                        {linkedDimensions ? (
                          <LinkIcon className="h-3 w-3" />
                        ) : (
                          <Unlink className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={Math.round(firstItem.data.rect.w || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      if (layer && linkedDimensions && !isEllipseLayer) {
                        const aspectRatio = layer.rect.h / layer.rect.w
                        updateLayer(layerId, {
                          rect: {
                            ...layer.rect,
                            w: value,
                            h: value * aspectRatio,
                          },
                        })
                      } else if (layer) {
                        updateLayer(layerId, {
                          rect: { ...layer.rect, w: value },
                        })
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={Math.round(firstItem.data.rect.h || 0)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      if (layer && linkedDimensions && !isEllipseLayer) {
                        const aspectRatio = layer.rect.w / layer.rect.h
                        updateLayer(layerId, {
                          rect: {
                            ...layer.rect,
                            h: value,
                            w: value * aspectRatio,
                          },
                        })
                      } else if (layer) {
                        updateLayer(layerId, {
                          rect: { ...layer.rect, h: value },
                        })
                      }
                    }}
                  />
                </div>
              </div>
            )}
            {layer && layer.rotation !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Rotation</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(layer.rotation || 0)}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[layer.rotation || 0]}
                    min={-180}
                    max={180}
                    step={1}
                    onValueChange={([value]) => {
                      updateLayer(layerId, { rotation: value })
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-6 w-6"
                    onClick={() => updateLayer(layerId, { rotation: 0 })}
                    title="Reset rotation"
                  >
                    <RotateCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* Ellipse/Circle-specific controls */}
          {isEllipseLayer && layer && (
            <>
              {/* Fill */}
              <Section title="Fill">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={layer.style?.fill?.kind === 'none' ? 'none' : 'solid'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              fill: { kind: 'none' },
                            },
                          })
                        } else {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              fill: {
                                kind: 'solid',
                                color: {
                                  literal: { format: 'hex', hex: '#3b82f6' },
                                },
                              },
                            },
                          })
                        }
                      }}
                    >
                      <ToggleGroupItem value="none" aria-label="No fill">
                        <MinusCircle className="h-4 w-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="solid" aria-label="Solid fill">
                        <Circle className="h-4 w-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {layer.style?.fill && layer.style.fill.kind === 'solid' && (
                    <>
                      <div className="space-y-2">
                        <Label>Fill Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={
                              layer.style.fill.color && 'literal' in layer.style.fill.color
                                ? layer.style.fill.color.literal.hex
                                : '#3b82f6'
                            }
                            onChange={(e) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  fill: {
                                    kind: 'solid',
                                    color: {
                                      literal: { format: 'hex', hex: e.target.value },
                                    },
                                  },
                                },
                              })
                            }}
                            className="h-10 w-20"
                          />
                          <Input
                            value={
                              layer.style.fill.color && 'literal' in layer.style.fill.color
                                ? layer.style.fill.color.literal.hex.toUpperCase()
                                : '#3B82F6'
                            }
                            onChange={(e) => {
                              const hex = e.target.value.replace('#', '')
                              if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                                updateLayer(layerId, {
                                  style: {
                                    ...layer.style,
                                    fill: {
                                      kind: 'solid',
                                      color: {
                                        literal: { format: 'hex', hex: `#${hex}` },
                                      },
                                    },
                                  },
                                })
                              }
                            }}
                            placeholder="#3b82f6"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Stroke */}
              <Section title="Stroke">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stroke</Label>
                    <Switch
                      checked={!!layer.style?.stroke}
                      onCheckedChange={(checked) => {
                        updateLayer(layerId, {
                          style: {
                            ...layer.style,
                            stroke: checked
                              ? {
                                  width: layer.style?.stroke?.width || 1,
                                  color: layer.style?.stroke?.color || {
                                    literal: { format: 'hex', hex: '#1e40af' },
                                  },
                                }
                              : undefined,
                          },
                        })
                      }}
                    />
                  </div>
                  {layer.style?.stroke && (
                    <>
                      <div className="space-y-2">
                        <Label>Stroke Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex
                                : '#1e40af'
                            }
                            onChange={(e) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    color: {
                                      literal: { format: 'hex', hex: e.target.value },
                                    },
                                  },
                                },
                              })
                            }}
                            className="h-10 w-20"
                          />
                          <Input
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex.toUpperCase()
                                : '#1E40AF'
                            }
                            onChange={(e) => {
                              const hex = e.target.value.replace('#', '')
                              if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                                updateLayer(layerId, {
                                  style: {
                                    ...layer.style,
                                    stroke: {
                                      ...layer.style.stroke,
                                      color: {
                                        literal: { format: 'hex', hex: `#${hex}` },
                                      },
                                    },
                                  },
                                })
                              }
                            }}
                            placeholder="#1e40af"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Stroke Width</Label>
                          <span className="text-xs text-muted-foreground">
                            {layer.style.stroke.width || 0}px
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[layer.style.stroke.width || 0]}
                            min={0}
                            max={50}
                            step={0.5}
                            onValueChange={([value]) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    width: value,
                                  },
                                },
                              })
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={layer.style.stroke.width || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    width: Math.max(0, Math.min(50, value)),
                                  },
                                },
                              })
                            }}
                            className="w-16 text-xs"
                            min={0}
                            max={50}
                            step={0.5}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Effects */}
              <Section title="Effects">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Opacity</Label>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((layer.style?.opacity || 1) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[(layer.style?.opacity || 1) * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([value]) => {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: value / 100,
                            },
                          })
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={Math.round((layer.style?.opacity || 1) * 100)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 100
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: Math.max(0, Math.min(100, value)) / 100,
                            },
                          })
                        }}
                        className="w-16"
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* Rectangle-specific controls */}
          {isRectLayer && layer && (
            <>
              {/* Fill */}
              <Section title="Fill">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={layer.style?.fill?.kind === 'none' ? 'none' : 'solid'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              fill: { kind: 'none' },
                            },
                          })
                        } else {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              fill: {
                                kind: 'solid',
                                color: {
                                  literal: { format: 'hex', hex: '#3b82f6' },
                                },
                              },
                            },
                          })
                        }
                      }}
                    >
                      <ToggleGroupItem value="none" aria-label="No fill">
                        <MinusCircle className="h-4 w-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="solid" aria-label="Solid fill">
                        <Square className="h-4 w-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {layer.style?.fill && layer.style.fill.kind === 'solid' && (
                    <>
                      <div className="space-y-2">
                        <Label>Fill Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={
                              layer.style.fill.color && 'literal' in layer.style.fill.color
                                ? layer.style.fill.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  fill: {
                                    kind: 'solid',
                                    color: {
                                      literal: { format: 'hex', hex: e.target.value },
                                    },
                                  },
                                },
                              })
                            }}
                            className="h-10 w-20"
                          />
                          <Input
                            value={
                              layer.style.fill.color && 'literal' in layer.style.fill.color
                                ? layer.style.fill.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              const hex = e.target.value.replace('#', '')
                              if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                                updateLayer(layerId, {
                                  style: {
                                    ...layer.style,
                                    fill: {
                                      kind: 'solid',
                                      color: {
                                        literal: { format: 'hex', hex: `#${hex}` },
                                      },
                                    },
                                  },
                                })
                              }
                            }}
                            placeholder="#000000"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Stroke */}
              <Section title="Stroke">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stroke</Label>
                    <Switch
                      checked={!!layer.style?.stroke}
                      onCheckedChange={(checked) => {
                        updateLayer(layerId, {
                          style: {
                            ...layer.style,
                            stroke: checked
                              ? {
                                  width: 1,
                                  color: {
                                    literal: { format: 'hex', hex: '#000000' },
                                  },
                                }
                              : undefined,
                          },
                        })
                      }}
                    />
                  </div>
                  {layer.style?.stroke && (
                    <>
                      <div className="space-y-2">
                        <Label>Stroke Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    color: {
                                      literal: { format: 'hex', hex: e.target.value },
                                    },
                                  },
                                },
                              })
                            }}
                            className="h-10 w-20"
                          />
                          <Input
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              const hex = e.target.value.replace('#', '')
                              if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                                updateLayer(layerId, {
                                  style: {
                                    ...layer.style,
                                    stroke: {
                                      ...layer.style.stroke,
                                      color: {
                                        literal: { format: 'hex', hex: `#${hex}` },
                                      },
                                    },
                                  },
                                })
                              }
                            }}
                            placeholder="#000000"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Stroke Width</Label>
                          <span className="text-xs text-muted-foreground">
                            {layer.style.stroke.width || 0}px
                          </span>
                        </div>
                        <Slider
                          value={[layer.style.stroke.width || 0]}
                          min={0}
                          max={20}
                          step={0.5}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  width: value,
                                },
                              },
                            })
                          }}
                        />
                        <Input
                          type="number"
                          value={layer.style.stroke.width || 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  width: Math.max(0, value),
                                },
                              },
                            })
                          }}
                          min={0}
                          step={0.5}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Corner Radius */}
              <Section title="Corner Radius">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Radius</Label>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-4 w-4"
                      onClick={() => setLinkedCorners(!linkedCorners)}
                      title={linkedCorners ? 'Unlink corners' : 'Link corners'}
                    >
                      {linkedCorners ? (
                        <LinkIcon className="h-3 w-3" />
                      ) : (
                        <Unlink className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  {linkedCorners ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[layer.style?.radius || 0]}
                          min={0}
                          max={Math.min(layer.rect.w, layer.rect.h) / 2}
                          step={1}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                radius: value,
                              },
                            })
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={Math.round(layer.style?.radius || 0)}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            const maxRadius = Math.min(layer.rect.w, layer.rect.h) / 2
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                radius: Math.max(0, Math.min(maxRadius, value)),
                              },
                            })
                          }}
                          className="w-20"
                          min={0}
                          step={1}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((corner) => (
                        <div key={corner} className="space-y-1">
                          <Label className="text-xs capitalize">
                            {corner.replace(/([A-Z])/g, ' $1').trim()}
                          </Label>
                          <Input
                            type="number"
                            value={Math.round(layer.style?.radius || 0)}
                            onChange={(e) => {
                              // For now, all corners share the same radius
                              // In the future, this could support individual corner radii
                              const value = parseFloat(e.target.value) || 0
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  radius: value,
                                },
                              })
                            }}
                            min={0}
                            step={1}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* Effects */}
              <Section title="Effects">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Opacity</Label>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((layer.style?.opacity || 1) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[(layer.style?.opacity || 1) * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([value]) => {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: value / 100,
                            },
                          })
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={Math.round((layer.style?.opacity || 1) * 100)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 100
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: Math.max(0, Math.min(100, value)) / 100,
                            },
                          })
                        }}
                        className="w-16"
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* Line layer specific */}
          {isLineLayer && layer && (
            <>
              {/* Stroke */}
              <Section title="Stroke">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stroke</Label>
                    <Switch
                      checked={!!layer.style?.stroke}
                      onCheckedChange={(checked) => {
                        updateLayer(layerId, {
                          style: {
                            ...layer.style,
                            stroke: checked
                              ? {
                                  width: 2,
                                  color: {
                                    literal: { format: 'hex', hex: '#000000' },
                                  },
                                }
                              : undefined,
                          },
                        })
                      }}
                    />
                  </div>
                  {layer.style?.stroke && (
                    <>
                      <div className="space-y-2">
                        <Label>Stroke Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    color: {
                                      literal: { format: 'hex', hex: e.target.value },
                                    },
                                  },
                                },
                              })
                            }}
                            className="h-10 w-20"
                          />
                          <Input
                            value={
                              layer.style.stroke.color && 'literal' in layer.style.stroke.color
                                ? layer.style.stroke.color.literal.hex
                                : '#000000'
                            }
                            onChange={(e) => {
                              const hex = e.target.value.replace('#', '')
                              if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                                updateLayer(layerId, {
                                  style: {
                                    ...layer.style,
                                    stroke: {
                                      ...layer.style.stroke,
                                      color: {
                                        literal: { format: 'hex', hex: `#${hex}` },
                                      },
                                    },
                                  },
                                })
                              }
                            }}
                            placeholder="#000000"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Stroke Width</Label>
                          <span className="text-xs text-muted-foreground">
                            {layer.style.stroke.width || 0}px
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[layer.style.stroke.width || 0]}
                            min={0}
                            max={50}
                            step={0.5}
                            onValueChange={([value]) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    width: value,
                                  },
                                },
                              })
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={layer.style.stroke.width || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    width: Math.max(0, value),
                                  },
                                },
                              })
                            }}
                            min={0}
                            step={0.5}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Stroke Style */}
              {layer.style?.stroke && (
                <Section title="Stroke Style">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Line Style</Label>
                      <ToggleGroup
                        type="single"
                        value={
                          !layer.style.stroke.dash || layer.style.stroke.dash.length === 0
                            ? 'solid'
                            : layer.style.stroke.dash.length === 2 && layer.style.stroke.dash[0] === 2
                            ? 'dotted'
                            : 'dashed'
                        }
                        onValueChange={(value) => {
                          if (value === 'solid') {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  dash: [],
                                },
                              },
                            })
                          } else if (value === 'dotted') {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  dash: [2, 2],
                                },
                              },
                            })
                          } else if (value === 'dashed') {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  dash: [5, 5],
                                },
                              },
                            })
                          }
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="solid" aria-label="Solid" className="flex-1">
                          <Minus className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="dashed" aria-label="Dashed" className="flex-1">
                          <GripVertical className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="dotted" aria-label="Dotted" className="flex-1">
                          <Circle className="h-3 w-3" />
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {(layer.style.stroke.dash && layer.style.stroke.dash.length > 0) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Dash Length</Label>
                          <Input
                            type="number"
                            value={layer.style.stroke.dash[0] || 5}
                            onChange={(e) => {
                              const dashLength = parseFloat(e.target.value) || 5
                              const gapLength = layer.style.stroke.dash?.[1] || 5
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    dash: [dashLength, gapLength],
                                  },
                                },
                              })
                            }}
                            min={0}
                            step={0.5}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Gap Length</Label>
                          <Input
                            type="number"
                            value={layer.style.stroke.dash[1] || 5}
                            onChange={(e) => {
                              const dashLength = layer.style.stroke.dash?.[0] || 5
                              const gapLength = parseFloat(e.target.value) || 5
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    dash: [dashLength, gapLength],
                                  },
                                },
                              })
                            }}
                            min={0}
                            step={0.5}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Line Cap & Join */}
              {layer.style?.stroke && (
                <Section title="Line Appearance">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Line Cap</Label>
                      <ToggleGroup
                        type="single"
                        value={layer.style.stroke.lineCap || 'butt'}
                        onValueChange={(value) => {
                          if (value === 'butt' || value === 'round' || value === 'square') {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  lineCap: value,
                                },
                              },
                            })
                          }
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="butt" aria-label="Butt" className="flex-1">
                          <span className="text-xs">Butt</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="round" aria-label="Round" className="flex-1">
                          <span className="text-xs">Round</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="square" aria-label="Square" className="flex-1">
                          <span className="text-xs">Square</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="space-y-2">
                      <Label>Line Join</Label>
                      <ToggleGroup
                        type="single"
                        value={layer.style.stroke.lineJoin || 'miter'}
                        onValueChange={(value) => {
                          if (value === 'miter' || value === 'round' || value === 'bevel') {
                            updateLayer(layerId, {
                              style: {
                                ...layer.style,
                                stroke: {
                                  ...layer.style.stroke,
                                  lineJoin: value,
                                },
                              },
                            })
                          }
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="miter" aria-label="Miter" className="flex-1">
                          <span className="text-xs">Miter</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="round" aria-label="Round" className="flex-1">
                          <span className="text-xs">Round</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="bevel" aria-label="Bevel" className="flex-1">
                          <span className="text-xs">Bevel</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {layer.style.stroke.lineJoin === 'miter' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Miter Limit</Label>
                          <span className="text-xs text-muted-foreground">
                            {layer.style.stroke.miterLimit || 10}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[layer.style.stroke.miterLimit || 10]}
                            min={0}
                            max={50}
                            step={0.5}
                            onValueChange={([value]) => {
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    miterLimit: value,
                                  },
                                },
                              })
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={layer.style.stroke.miterLimit || 10}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 10
                              updateLayer(layerId, {
                                style: {
                                  ...layer.style,
                                  stroke: {
                                    ...layer.style.stroke,
                                    miterLimit: Math.max(0, value),
                                  },
                                },
                              })
                            }}
                            min={0}
                            step={0.5}
                            className="w-20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Points Info */}
              {layer.type === 'line' && layer.points && (
                <Section title="Points">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Point Count</Label>
                      <span className="text-xs text-muted-foreground">
                        {layer.points.length}
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {layer.points.map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs p-1.5 bg-muted rounded"
                        >
                          <span className="font-mono">
                            P{index + 1}: ({Math.round(point.x)}, {Math.round(point.y)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              )}

              {/* Effects */}
              <Section title="Effects">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Opacity</Label>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((layer.style?.opacity || 1) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[(layer.style?.opacity || 1) * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([value]) => {
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: value / 100,
                            },
                          })
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={Math.round((layer.style?.opacity || 1) * 100)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 100
                          updateLayer(layerId, {
                            style: {
                              ...layer.style,
                              opacity: Math.max(0, Math.min(100, value)) / 100,
                            },
                          })
                        }}
                        className="w-16"
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* Text layer specific */}
          {layer && layer.type === 'text' && (
            <>
              <Section title="Text">
                <div className="space-y-2">
                  <Label>Content</Label>
                  <textarea
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md resize-none"
                    value={layer.text || ''}
                    onChange={(e) => {
                      updateLayer(layerId, { text: e.target.value })
                    }}
                  />
                </div>
                
                {/* Text Color */}
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={
                        layer.color && 'literal' in layer.color
                          ? layer.color.literal.hex
                          : '#000000'
                      }
                      onChange={(e) => {
                        updateLayer(layerId, {
                          color: { literal: { format: 'hex', hex: e.target.value } },
                        })
                      }}
                      className="h-10 w-20 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={
                        layer.color && 'literal' in layer.color
                          ? layer.color.literal.hex
                          : '#000000'
                      }
                      onChange={(e) => {
                        const hex = e.target.value.replace('#', '')
                        if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                          updateLayer(layerId, {
                            color: { literal: { format: 'hex', hex: `#${hex}` } },
                          })
                        }
                      }}
                      className="flex-1 font-mono text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </Section>

              {layer.typography && 'literal' in layer.typography && (
                <>
                  <Section title="Typography">
                    {/* Font Family */}
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <NativeSelect
                        value={layer.typography.literal.fontFamily || 'Arial'}
                        onChange={(e) => {
                          updateLayer(layerId, {
                            typography: {
                              literal: {
                                ...layer.typography.literal,
                                fontFamily: e.target.value,
                              },
                            },
                          })
                        }}
                        className="w-full"
                      >
                        <NativeSelectOption value="Arial">Arial</NativeSelectOption>
                        <NativeSelectOption value="Helvetica">Helvetica</NativeSelectOption>
                        <NativeSelectOption value="Georgia">Georgia</NativeSelectOption>
                        <NativeSelectOption value="Times New Roman">Times New Roman</NativeSelectOption>
                        <NativeSelectOption value="Courier New">Courier New</NativeSelectOption>
                        <NativeSelectOption value="Verdana">Verdana</NativeSelectOption>
                        <NativeSelectOption value="Trebuchet MS">Trebuchet MS</NativeSelectOption>
                        <NativeSelectOption value="Impact">Impact</NativeSelectOption>
                        <NativeSelectOption value="Comic Sans MS">Comic Sans MS</NativeSelectOption>
                        <NativeSelectOption value="Tahoma">Tahoma</NativeSelectOption>
                        <NativeSelectOption value="Lucida Console">Lucida Console</NativeSelectOption>
                        <NativeSelectOption value="Palatino">Palatino</NativeSelectOption>
                        <NativeSelectOption value="Garamond">Garamond</NativeSelectOption>
                        <NativeSelectOption value="Bookman">Bookman</NativeSelectOption>
                        <NativeSelectOption value="Courier">Courier</NativeSelectOption>
                        <NativeSelectOption value="Monaco">Monaco</NativeSelectOption>
                        <NativeSelectOption value="Menlo">Menlo</NativeSelectOption>
                        <NativeSelectOption value="Consolas">Consolas</NativeSelectOption>
                        <NativeSelectOption value="Roboto">Roboto</NativeSelectOption>
                        <NativeSelectOption value="Open Sans">Open Sans</NativeSelectOption>
                        <NativeSelectOption value="Lato">Lato</NativeSelectOption>
                        <NativeSelectOption value="Montserrat">Montserrat</NativeSelectOption>
                        <NativeSelectOption value="Poppins">Poppins</NativeSelectOption>
                        <NativeSelectOption value="Inter">Inter</NativeSelectOption>
                      </NativeSelect>
                    </div>

                    {/* Font Size */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Font Size</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(layer.typography.literal.fontSize || 16)}px
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[layer.typography.literal.fontSize || 16]}
                          min={8}
                          max={200}
                          step={1}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              typography: {
                                literal: {
                                  ...layer.typography.literal,
                                  fontSize: value,
                                },
                              },
                            })
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={layer.typography.literal.fontSize || 16}
                          onChange={(e) => {
                            const size = parseFloat(e.target.value)
                            if (!isNaN(size) && size >= 1 && size <= 500) {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    fontSize: size,
                                  },
                                },
                              })
                            }
                          }}
                          className="w-20"
                          min={1}
                          max={500}
                        />
                      </div>
                    </div>

                    {/* Font Weight */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Font Weight</Label>
                        <div className="flex items-center gap-1">
                          <Toggle
                            pressed={layer.typography.literal.fontWeight >= 700}
                            onPressedChange={(pressed) => {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    fontWeight: pressed ? 700 : 400,
                                  },
                                },
                              })
                            }}
                            aria-label="Bold"
                            size="sm"
                          >
                            <Bold className="size-4" />
                          </Toggle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[layer.typography.literal.fontWeight || 400]}
                          min={100}
                          max={900}
                          step={100}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              typography: {
                                literal: {
                                  ...layer.typography.literal,
                                  fontWeight: value,
                                },
                              },
                            })
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={layer.typography.literal.fontWeight || 400}
                          onChange={(e) => {
                            const weight = parseInt(e.target.value, 10)
                            if (!isNaN(weight) && weight >= 100 && weight <= 900) {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    fontWeight: weight,
                                  },
                                },
                              })
                            }
                          }}
                          className="w-20"
                          min={100}
                          max={900}
                          step={100}
                        />
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
                          <Button
                            key={weight}
                            variant={
                              layer.typography.literal.fontWeight === weight
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    fontWeight: weight,
                                  },
                                },
                              })
                            }}
                          >
                            {weight === 400 ? 'Regular' : weight === 700 ? 'Bold' : weight}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Line Height */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Line Height</Label>
                        <span className="text-xs text-muted-foreground">
                          {layer.typography.literal.lineHeight?.toFixed(2) || '1.20'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[((layer.typography.literal.lineHeight || 1.2) - 0.5) * 100]}
                          min={0}
                          max={450}
                          step={5}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              typography: {
                                literal: {
                                  ...layer.typography.literal,
                                  lineHeight: value / 100 + 0.5,
                                },
                              },
                            })
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={layer.typography.literal.lineHeight || 1.2}
                          onChange={(e) => {
                            const lineHeight = parseFloat(e.target.value)
                            if (!isNaN(lineHeight) && lineHeight >= 0.5 && lineHeight <= 5) {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    lineHeight: lineHeight,
                                  },
                                },
                              })
                            }
                          }}
                          className="w-20"
                          min={0.5}
                          max={5}
                          step={0.1}
                        />
                      </div>
                    </div>

                    {/* Letter Spacing */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Letter Spacing</Label>
                        <span className="text-xs text-muted-foreground">
                          {((layer.typography.literal.letterSpacing || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[((layer.typography.literal.letterSpacing || 0) + 2) * 10]}
                          min={0}
                          max={40}
                          step={1}
                          onValueChange={([value]) => {
                            updateLayer(layerId, {
                              typography: {
                                literal: {
                                  ...layer.typography.literal,
                                  letterSpacing: value / 10 - 2,
                                },
                              },
                            })
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={layer.typography.literal.letterSpacing || 0}
                          onChange={(e) => {
                            const letterSpacing = parseFloat(e.target.value)
                            if (!isNaN(letterSpacing) && letterSpacing >= -2 && letterSpacing <= 2) {
                              updateLayer(layerId, {
                                typography: {
                                  literal: {
                                    ...layer.typography.literal,
                                    letterSpacing: letterSpacing,
                                  },
                                },
                              })
                            }
                          }}
                          className="w-20"
                          min={-2}
                          max={2}
                          step={0.01}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Alignment">
                    {/* Text Alignment */}
                    <div className="space-y-2">
                      <Label>Horizontal Alignment</Label>
                      <ToggleGroup
                        type="single"
                        value={layer.align || 'left'}
                        onValueChange={(value) => {
                          if (value) {
                            updateLayer(layerId, {
                              align: value as 'left' | 'center' | 'right',
                            })
                          }
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="left" aria-label="Align left" className="flex-1">
                          <AlignLeft className="size-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="center" aria-label="Align center" className="flex-1">
                          <AlignCenter className="size-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="right" aria-label="Align right" className="flex-1">
                          <AlignRight className="size-4" />
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Vertical Alignment */}
                    <div className="space-y-2">
                      <Label>Vertical Alignment</Label>
                      <ToggleGroup
                        type="single"
                        value={layer.verticalAlign || 'top'}
                        onValueChange={(value) => {
                          if (value) {
                            updateLayer(layerId, {
                              verticalAlign: value as 'top' | 'middle' | 'bottom',
                            })
                          }
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="top" aria-label="Align top" className="flex-1">
                          <AlignStartVertical className="size-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="middle" aria-label="Align middle" className="flex-1">
                          <AlignCenterVertical className="size-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="bottom" aria-label="Align bottom" className="flex-1">
                          <AlignEndVertical className="size-4" />
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </Section>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground">
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
