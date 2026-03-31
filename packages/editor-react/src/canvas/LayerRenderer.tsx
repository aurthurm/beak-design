import { useMemo, useState, useEffect, useRef } from 'react'
import { Group, Rect as KonvaRect, Text as KonvaText, Ellipse, Line, Image as KonvaImage, Path } from 'react-konva'
import type { Layer, LayerId, Rect } from '@/lib/schema'
import { createViewportTransform } from '@/lib/canvas/viewport'
import {
  createKonvaRect,
  createKonvaText,
  createKonvaEllipse,
  createKonvaLine,
  createKonvaPath,
} from '@/lib/canvas/utils/konva-helpers'
import { canvasActions, canvasStore } from '@/lib/canvas/store'
import { getAnimationManager } from '@/lib/canvas/animations'

interface LayerRendererProps {
  layer: Layer
  layerId: LayerId
  panX: number
  panY: number
  zoom: number
  screenWidth: number
  screenHeight: number
  isSelected: boolean
  isHovered?: boolean
  tokens?: Record<string, any>
  onClick?: (layerId: LayerId) => void
  clipRect?: Rect // Optional clipping rectangle (for shapes inside frames)
  showHiddenPartBorder?: boolean // If true, render border only for parts outside clipRect
  isGrayedOut?: boolean // If true, apply graying effect (when parent frame is being dragged)
}

export function LayerRenderer({
  layer,
  layerId,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
  isSelected,
  isHovered = false,
  tokens,
  onClick,
  clipRect,
  showHiddenPartBorder = false,
  isGrayedOut = false,
}: LayerRendererProps) {
  const transform = useMemo(
    () => createViewportTransform(panX, panY, zoom, screenWidth, screenHeight),
    [panX, panY, zoom, screenWidth, screenHeight]
  )

  // Get animation opacity for agent operations
  const [animationOpacity, setAnimationOpacity] = useState(0)
  useEffect(() => {
    const manager = getAnimationManager()
    const updateOpacity = () => {
      setAnimationOpacity(manager.getAnimationOpacity(layerId))
    }
    updateOpacity()
    const interval = setInterval(updateOpacity, 16) // ~60fps
    return () => clearInterval(interval)
  }, [layerId])

  const screenRect = useMemo(() => {
    return transform.worldRectToScreen(layer.rect)
  }, [transform, layer.rect])

  const handleClick = () => {
    if (!layer.flags?.locked) {
      onClick?.(layerId)
    }
  }

  if (layer.flags?.hidden) {
    return null
  }

  switch (layer.type) {
    case 'rect': {
      const konvaRect = useMemo(() => createKonvaRect(layer, tokens), [layer, tokens])
      const baseStroke = konvaRect.stroke() || '#000000'
      const baseStrokeWidth = konvaRect.strokeWidth() || 0
      
      // Darken the stroke color for hover (reduce lightness)
      const getHoverStroke = (color: string): string => {
        // Simple darkening: if it's a hex color, reduce RGB values
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          // Darken by 30%
          const darkenedR = Math.max(0, Math.floor(r * 0.7))
          const darkenedG = Math.max(0, Math.floor(g * 0.7))
          const darkenedB = Math.max(0, Math.floor(b * 0.7))
          return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`
        }
        // Fallback for non-hex colors
        return '#333333'
      }
      
      // For hidden part border, render with inverse clipping
      if (showHiddenPartBorder && clipRect) {
        return (
          <Group listening={false}>
            <Group
              clipFunc={(ctx) => {
                // Inverse clipping: show everything EXCEPT the frame bounds
                const clipX = clipRect.x
                const clipY = clipRect.y
                const clipW = clipRect.w
                const clipH = clipRect.h
                // Large canvas bounds
                const canvasW = screenWidth * 10
                const canvasH = screenHeight * 10
                ctx.beginPath()
                // Outer rectangle (clockwise) - covers everything
                ctx.moveTo(-canvasW, -canvasH)
                ctx.lineTo(canvasW, -canvasH)
                ctx.lineTo(canvasW, canvasH)
                ctx.lineTo(-canvasW, canvasH)
                ctx.closePath()
                // Inner rectangle (counter-clockwise) - creates hole
                ctx.moveTo(clipX, clipY)
                ctx.lineTo(clipX, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY)
                ctx.closePath()
                // Use even-odd fill rule for inverse clipping
                ctx.clip('evenodd')
              }}
            >
              {/* Border for hidden part - use selection color if selected, hover color if hovered */}
              <KonvaRect
                x={screenRect.x}
                y={screenRect.y}
                width={screenRect.w}
                height={screenRect.h}
                fillEnabled={false}
                stroke={isSelected ? '#0066ff' : getHoverStroke(baseStroke)}
                strokeWidth={isSelected ? 2 : Math.max(2, baseStrokeWidth + 1)}
                strokeEnabled={true}
                listening={false}
                cornerRadius={layer.style?.radius ?? 0}
              />
            </Group>
          </Group>
        )
      }

      return (
        <Group onClick={handleClick} onTap={handleClick} opacity={isGrayedOut ? 0.5 : 1}>
          {/* Selection highlight background */}
          {isSelected && (
            <KonvaRect
              x={screenRect.x - 2}
              y={screenRect.y - 2}
              width={screenRect.w + 4}
              height={screenRect.h + 4}
              fill="rgba(0, 102, 255, 0.1)"
              stroke="#0066ff"
              strokeWidth={2}
              listening={false}
              cornerRadius={layer.style?.radius ?? 0}
            />
          )}
          {/* Actual shape - render first so hover border appears on top */}
          <KonvaRect
            x={screenRect.x}
            y={screenRect.y}
            width={screenRect.w}
            height={screenRect.h}
            fill={konvaRect.fill()}
            fillEnabled={konvaRect.fillEnabled()}
            stroke={isSelected ? '#0066ff' : konvaRect.stroke()}
            strokeWidth={isSelected ? 2 : konvaRect.strokeWidth()}
            strokeEnabled={konvaRect.strokeEnabled()}
            cornerRadius={layer.style?.radius ?? 0}
            opacity={layer.style?.opacity ?? 1}
            rotation={layer.rotation ?? 0}
            listening={!layer.flags?.locked}
          />
          {/* Hover border - darker edge, only border, no fill - render on top */}
          {isHovered && !isSelected && (
            <KonvaRect
              x={screenRect.x}
              y={screenRect.y}
              width={screenRect.w}
              height={screenRect.h}
              fillEnabled={false}
              stroke={getHoverStroke(baseStroke)}
              strokeWidth={Math.max(2, baseStrokeWidth + 1)}
              strokeEnabled={true}
              listening={false}
              cornerRadius={layer.style?.radius ?? 0}
            />
          )}
          {/* Agent operation animation overlay */}
          {animationOpacity > 0 && (
            <KonvaRect
              x={screenRect.x - 2}
              y={screenRect.y - 2}
              width={screenRect.w + 4}
              height={screenRect.h + 4}
              fill={`rgba(0, 102, 255, ${animationOpacity * 0.2})`}
              stroke="#0066ff"
              strokeWidth={2}
              listening={false}
              cornerRadius={layer.style?.radius ?? 0}
              opacity={animationOpacity}
            />
          )}
        </Group>
      )
    }

    case 'text': {
      const konvaText = useMemo(() => createKonvaText(layer, tokens), [layer, tokens])
      const [isEditing, setIsEditing] = useState(false)
      const [editText, setEditText] = useState(layer.text || '')
      const inputRef = useRef<HTMLInputElement>(null)

      const handleDoubleClick = () => {
        if (!layer.flags?.locked && isSelected) {
          setIsEditing(true)
          setEditText(layer.text || '')
          // Focus input after a brief delay to ensure it's rendered
          setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
          }, 10)
        }
      }

      const handleBlur = () => {
        setIsEditing(false)
        // Update the layer text
        if (editText !== layer.text) {
          const state = canvasStore.state
          if (state.document) {
            const updatedDocument = {
              ...state.document,
              updatedAt: new Date().toISOString(),
              layers: {
                ...state.document.layers,
                [layerId]: {
                  ...layer,
                  text: editText,
                },
              },
            }
            canvasActions.setDocument(updatedDocument)
          }
        }
      }

      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          handleBlur()
        } else if (e.key === 'Escape') {
          setIsEditing(false)
          setEditText(layer.text || '')
        }
      }

      return (
        <>
          <Group onClick={handleClick} onTap={handleClick} onDblClick={handleDoubleClick} onDblTap={handleDoubleClick} opacity={isGrayedOut ? 0.5 : 1}>
            {/* Selection highlight background */}
            {isSelected && (
              <KonvaRect
                x={screenRect.x - 2}
                y={screenRect.y - 2}
                width={screenRect.w + 4}
                height={screenRect.h + 4}
                fill="rgba(0, 102, 255, 0.1)"
                stroke="#0066ff"
                strokeWidth={2}
                listening={false}
                cornerRadius={0}
              />
            )}
            {/* Hover border - darker edge, only border */}
            {isHovered && !isSelected && (
              <KonvaRect
                x={screenRect.x}
                y={screenRect.y}
                width={screenRect.w}
                height={screenRect.h}
                fillEnabled={false}
                stroke="#333333"
                strokeWidth={2}
                strokeEnabled={true}
                listening={false}
                cornerRadius={0}
              />
            )}
            <KonvaText
              x={screenRect.x}
              y={screenRect.y}
              width={screenRect.w}
              height={screenRect.h}
              text={konvaText.text()}
              fontSize={konvaText.fontSize()}
              fontFamily={konvaText.fontFamily()}
              fontStyle={konvaText.fontStyle()}
              align={konvaText.align()}
              verticalAlign={konvaText.verticalAlign()}
              lineHeight={konvaText.lineHeight()}
              fill={konvaText.fill()}
              opacity={layer.style?.opacity ?? 1}
              rotation={layer.rotation ?? 0}
              listening={!layer.flags?.locked}
            />
          </Group>
          {isEditing && (
            <input
              ref={inputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                position: 'absolute',
                left: `${screenRect.x}px`,
                top: `${screenRect.y}px`,
                width: `${screenRect.w}px`,
                height: `${screenRect.h}px`,
                fontSize: `${konvaText.fontSize()}px`,
                fontFamily: konvaText.fontFamily(),
                fontStyle: konvaText.fontStyle(),
                textAlign: konvaText.align() as 'left' | 'center' | 'right',
                border: '2px solid #0066ff',
                outline: 'none',
                padding: '2px',
                background: 'white',
                color: konvaText.fill(),
                transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                transformOrigin: 'top left',
                zIndex: 1000,
              }}
            />
          )}
        </>
      )
    }

    case 'ellipse': {
      const konvaEllipse = useMemo(() => createKonvaEllipse(layer, tokens), [layer, tokens])
      const baseStroke = konvaEllipse.stroke() || '#000000'
      const baseStrokeWidth = konvaEllipse.strokeWidth() || 0
      
      // Darken the stroke color for hover
      const getHoverStroke = (color: string): string => {
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const darkenedR = Math.max(0, Math.floor(r * 0.7))
          const darkenedG = Math.max(0, Math.floor(g * 0.7))
          const darkenedB = Math.max(0, Math.floor(b * 0.7))
          return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`
        }
        return '#333333'
      }
      
      // For hidden part border, render with inverse clipping
      if (showHiddenPartBorder && clipRect) {
        return (
          <Group listening={false}>
            <Group
              clipFunc={(ctx) => {
                const clipX = clipRect.x
                const clipY = clipRect.y
                const clipW = clipRect.w
                const clipH = clipRect.h
                const canvasW = screenWidth * 10
                const canvasH = screenHeight * 10
                ctx.beginPath()
                ctx.moveTo(-canvasW, -canvasH)
                ctx.lineTo(canvasW, -canvasH)
                ctx.lineTo(canvasW, canvasH)
                ctx.lineTo(-canvasW, canvasH)
                ctx.closePath()
                ctx.moveTo(clipX, clipY)
                ctx.lineTo(clipX, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY)
                ctx.closePath()
                ctx.clip('evenodd')
              }}
            >
              <Ellipse
                x={screenRect.x + screenRect.w / 2}
                y={screenRect.y + screenRect.h / 2}
                radiusX={screenRect.w / 2}
                radiusY={screenRect.h / 2}
                fillEnabled={false}
                stroke={isSelected ? '#0066ff' : getHoverStroke(baseStroke)}
                strokeWidth={isSelected ? 2 : Math.max(2, baseStrokeWidth + 1)}
                strokeEnabled={true}
                listening={false}
              />
            </Group>
          </Group>
        )
      }
      
      return (
        <Group onClick={handleClick} onTap={handleClick} opacity={isGrayedOut ? 0.5 : 1}>
          {/* Selection highlight background */}
          {isSelected && (
            <Ellipse
              x={screenRect.x + screenRect.w / 2}
              y={screenRect.y + screenRect.h / 2}
              radiusX={screenRect.w / 2 + 2}
              radiusY={screenRect.h / 2 + 2}
              fill="rgba(0, 102, 255, 0.1)"
              stroke="#0066ff"
              strokeWidth={2}
              listening={false}
            />
          )}
          {/* Hover border - darker edge */}
          {isHovered && !isSelected && (
            <Ellipse
              x={screenRect.x + screenRect.w / 2}
              y={screenRect.y + screenRect.h / 2}
              radiusX={screenRect.w / 2}
              radiusY={screenRect.h / 2}
              fillEnabled={false}
              stroke={getHoverStroke(baseStroke)}
              strokeWidth={Math.max(2, baseStrokeWidth + 1)}
              strokeEnabled={true}
              listening={false}
            />
          )}
          <Ellipse
            x={screenRect.x + screenRect.w / 2}
            y={screenRect.y + screenRect.h / 2}
            radiusX={screenRect.w / 2}
            radiusY={screenRect.h / 2}
            fill={konvaEllipse.fill()}
            fillEnabled={konvaEllipse.fillEnabled()}
            stroke={isSelected ? '#0066ff' : konvaEllipse.stroke()}
            strokeWidth={isSelected ? 2 : konvaEllipse.strokeWidth()}
            strokeEnabled={konvaEllipse.strokeEnabled()}
            opacity={layer.style?.opacity ?? 1}
            rotation={layer.rotation ?? 0}
            listening={!layer.flags?.locked}
          />
        </Group>
      )
    }

    case 'line': {
      const konvaLine = useMemo(() => createKonvaLine(layer, tokens), [layer, tokens])
      const points = useMemo(() => {
        const flatPoints: number[] = []
        for (const point of layer.points) {
          const screenPoint = transform.worldToScreen(point)
          flatPoints.push(screenPoint.x, screenPoint.y)
        }
        return flatPoints
      }, [layer.points, transform])
      
      // Get line-specific properties
      const stroke = layer.style?.stroke
      const lineCap = stroke?.lineCap || 'butt'
      const lineJoin = stroke?.lineJoin || 'miter'
      const miterLimit = stroke?.miterLimit || 10
      const dash = stroke?.dash && stroke.dash.length > 0 ? stroke.dash : []
      
      const baseStroke = konvaLine.stroke() || '#000000'
      const baseStrokeWidth = konvaLine.strokeWidth() || 2
      
      // Darken the stroke color for hover
      const getHoverStroke = (color: string): string => {
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const darkenedR = Math.max(0, Math.floor(r * 0.7))
          const darkenedG = Math.max(0, Math.floor(g * 0.7))
          const darkenedB = Math.max(0, Math.floor(b * 0.7))
          return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`
        }
        return '#333333'
      }
      
      // For hidden part border, render with inverse clipping
      if (showHiddenPartBorder && clipRect) {
        return (
          <Group listening={false}>
            <Group
              clipFunc={(ctx) => {
                const clipX = clipRect.x
                const clipY = clipRect.y
                const clipW = clipRect.w
                const clipH = clipRect.h
                const canvasW = screenWidth * 10
                const canvasH = screenHeight * 10
                ctx.beginPath()
                ctx.moveTo(-canvasW, -canvasH)
                ctx.lineTo(canvasW, -canvasH)
                ctx.lineTo(canvasW, canvasH)
                ctx.lineTo(-canvasW, canvasH)
                ctx.closePath()
                ctx.moveTo(clipX, clipY)
                ctx.lineTo(clipX, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY)
                ctx.closePath()
                ctx.clip('evenodd')
              }}
            >
              <Line
                points={points}
                closed={false}
                stroke={isSelected ? '#0066ff' : getHoverStroke(baseStroke)}
                strokeWidth={isSelected ? baseStrokeWidth + 2 : baseStrokeWidth + 1}
                listening={false}
                lineCap={lineCap}
                lineJoin={lineJoin}
                miterLimit={miterLimit}
                dash={dash}
              />
            </Group>
          </Group>
        )
      }
      
      return (
        <Group onClick={handleClick} onTap={handleClick} opacity={isGrayedOut ? 0.5 : 1}>
          {/* Selection highlight - draw thicker line behind */}
          {isSelected && (
            <Line
              points={points}
              closed={false}
              stroke="#0066ff"
              strokeWidth={baseStrokeWidth + 4}
              opacity={0.3}
              listening={false}
              lineCap={lineCap}
              lineJoin={lineJoin}
              miterLimit={miterLimit}
              dash={dash}
            />
          )}
          {/* Hover border - darker edge */}
          {isHovered && !isSelected && (
            <Line
              points={points}
              closed={false}
              stroke={getHoverStroke(baseStroke)}
              strokeWidth={baseStrokeWidth + 1}
              listening={false}
              lineCap={lineCap}
              lineJoin={lineJoin}
              miterLimit={miterLimit}
              dash={dash}
            />
          )}
          <Line
            points={points}
            closed={false}
            stroke={isSelected ? '#0066ff' : konvaLine.stroke()}
            strokeWidth={isSelected ? baseStrokeWidth + 2 : baseStrokeWidth}
            strokeEnabled={konvaLine.strokeEnabled()}
            opacity={layer.style?.opacity ?? 1}
            listening={!layer.flags?.locked}
            lineCap={lineCap}
            lineJoin={lineJoin}
            miterLimit={miterLimit}
            dash={dash}
          />
        </Group>
      )
    }

    case 'path': {
      const konvaPath = useMemo(() => createKonvaPath(layer, tokens), [layer, tokens])
      
      // Convert path commands to SVG path string for rendering
      const pathData = useMemo(() => {
        let data = ''
        for (const cmd of layer.commands) {
          if (cmd.type === 'M') {
            const screenPoint = transform.worldToScreen(cmd.point)
            data += `M ${screenPoint.x} ${screenPoint.y} `
          } else if (cmd.type === 'L') {
            const screenPoint = transform.worldToScreen(cmd.point)
            data += `L ${screenPoint.x} ${screenPoint.y} `
          } else if (cmd.type === 'C') {
            const screenPoint = transform.worldToScreen(cmd.point)
            const screenCp1 = transform.worldToScreen(cmd.cp1)
            const screenCp2 = transform.worldToScreen(cmd.cp2)
            data += `C ${screenCp1.x} ${screenCp1.y} ${screenCp2.x} ${screenCp2.y} ${screenPoint.x} ${screenPoint.y} `
          } else if (cmd.type === 'Q') {
            const screenPoint = transform.worldToScreen(cmd.point)
            const screenCp = transform.worldToScreen(cmd.cp)
            data += `Q ${screenCp.x} ${screenCp.y} ${screenPoint.x} ${screenPoint.y} `
          } else if (cmd.type === 'Z') {
            data += 'Z '
          }
        }
        return data.trim()
      }, [layer.commands, transform])
      
      const stroke = layer.style?.stroke
      const lineCap = stroke?.lineCap || 'butt'
      const lineJoin = stroke?.lineJoin || 'miter'
      const miterLimit = stroke?.miterLimit || 10
      const dash = stroke?.dash && stroke.dash.length > 0 ? stroke.dash : []
      
      const baseStroke = konvaPath.stroke() || '#000000'
      const baseStrokeWidth = konvaPath.strokeWidth() || 2
      
      const getHoverStroke = (color: string): string => {
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const darkenedR = Math.max(0, Math.floor(r * 0.7))
          const darkenedG = Math.max(0, Math.floor(g * 0.7))
          const darkenedB = Math.max(0, Math.floor(b * 0.7))
          return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`
        }
        return '#333333'
      }
      
      return (
        <Group onClick={handleClick} onTap={handleClick} opacity={isGrayedOut ? 0.5 : 1}>
          {/* Selection highlight */}
          {isSelected && (
            <Path
              data={pathData}
              fillEnabled={false}
              stroke="#0066ff"
              strokeWidth={baseStrokeWidth + 2}
              listening={false}
              lineCap={lineCap}
              lineJoin={lineJoin}
              miterLimit={miterLimit}
              dash={dash}
            />
          )}
          {/* Hover border */}
          {isHovered && !isSelected && (
            <Path
              data={pathData}
              fillEnabled={false}
              stroke={getHoverStroke(baseStroke)}
              strokeWidth={baseStrokeWidth + 1}
              listening={false}
              lineCap={lineCap}
              lineJoin={lineJoin}
              miterLimit={miterLimit}
              dash={dash}
            />
          )}
          <Path
            data={pathData}
            fill={konvaPath.fill()}
            fillEnabled={konvaPath.fillEnabled()}
            stroke={isSelected ? '#0066ff' : konvaPath.stroke()}
            strokeWidth={isSelected ? baseStrokeWidth + 2 : baseStrokeWidth}
            strokeEnabled={konvaPath.strokeEnabled()}
            opacity={layer.style?.opacity ?? 1}
            listening={!layer.flags?.locked}
            lineCap={lineCap}
            lineJoin={lineJoin}
            miterLimit={miterLimit}
            dash={dash}
          />
        </Group>
      )
    }

    case 'image': {
      const [image, setImage] = useState<HTMLImageElement | null>(null)
      
      useEffect(() => {
        if (layer.assetId) {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => setImage(img)
          img.onerror = () => setImage(null)
          img.src = layer.assetId
        }
      }, [layer.assetId])
      
      // For hidden part border, render with inverse clipping
      if (showHiddenPartBorder && clipRect) {
        return (
          <Group listening={false}>
            <Group
              clipFunc={(ctx) => {
                const clipX = clipRect.x
                const clipY = clipRect.y
                const clipW = clipRect.w
                const clipH = clipRect.h
                const canvasW = screenWidth * 10
                const canvasH = screenHeight * 10
                ctx.beginPath()
                ctx.moveTo(-canvasW, -canvasH)
                ctx.lineTo(canvasW, -canvasH)
                ctx.lineTo(canvasW, canvasH)
                ctx.lineTo(-canvasW, canvasH)
                ctx.closePath()
                ctx.moveTo(clipX, clipY)
                ctx.lineTo(clipX, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY + clipH)
                ctx.lineTo(clipX + clipW, clipY)
                ctx.closePath()
                ctx.clip('evenodd')
              }}
            >
              <KonvaRect
                x={screenRect.x}
                y={screenRect.y}
                width={screenRect.w}
                height={screenRect.h}
                fillEnabled={false}
                stroke={isSelected ? '#0066ff' : '#333333'}
                strokeWidth={isSelected ? 2 : 2}
                strokeEnabled={true}
                listening={false}
                cornerRadius={0}
              />
            </Group>
          </Group>
        )
      }
      
      return (
        <Group onClick={handleClick} onTap={handleClick} opacity={isGrayedOut ? 0.5 : 1}>
          {/* Selection highlight background */}
          {isSelected && (
            <KonvaRect
              x={screenRect.x - 2}
              y={screenRect.y - 2}
              width={screenRect.w + 4}
              height={screenRect.h + 4}
              fill="rgba(0, 102, 255, 0.1)"
              stroke="#0066ff"
              strokeWidth={2}
              listening={false}
              cornerRadius={0}
            />
          )}
          {/* Hover border - darker edge, only border */}
          {isHovered && !isSelected && (
            <KonvaRect
              x={screenRect.x}
              y={screenRect.y}
              width={screenRect.w}
              height={screenRect.h}
              fillEnabled={false}
              stroke="#333333"
              strokeWidth={2}
              strokeEnabled={true}
              listening={false}
              cornerRadius={0}
            />
          )}
          {image && (
            <KonvaImage
              x={screenRect.x}
              y={screenRect.y}
              width={screenRect.w}
              height={screenRect.h}
              image={image}
              opacity={layer.style?.opacity ?? 1}
              rotation={layer.rotation ?? 0}
              listening={!layer.flags?.locked}
            />
          )}
        </Group>
      )
    }

    case 'group': {
      // Groups will be rendered recursively by the parent component
      return null
    }

    case 'componentInstance': {
      // Component instances will be rendered separately
      return null
    }

    default:
      return null
  }
}
