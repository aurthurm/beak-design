import Konva from 'konva'
import type { Layer, Rect, Point, ColorValue, FillStyle, StrokeStyle, PathCommand } from '../../schema'

/**
 * Convert color value to Konva color string
 */
export function colorValueToKonva(color: ColorValue | undefined, tokens?: Record<string, any>): string {
  if (!color) return '#000000'
  
  if ('tokenRef' in color) {
    // Look up token value
    const token = tokens?.[color.tokenRef.tokenId]
    if (token && token.kind === 'color') {
      return token.value.hex
    }
    return '#000000'
  }
  
  if ('literal' in color) {
    return color.literal.hex
  }
  
  return '#000000'
}

/**
 * Convert fill style to Konva fill
 */
export function fillStyleToKonva(fill: FillStyle | undefined, tokens?: Record<string, any>): {
  fill: string
  fillEnabled: boolean
} {
  if (!fill || fill.kind === 'none') {
    return { fill: '', fillEnabled: false }
  }
  
  if (fill.kind === 'solid') {
    return {
      fill: colorValueToKonva(fill.color, tokens),
      fillEnabled: true,
    }
  }
  
  return { fill: '', fillEnabled: false }
}

/**
 * Convert stroke style to Konva stroke
 */
export function strokeStyleToKonva(stroke: StrokeStyle | undefined, tokens?: Record<string, any>): {
  stroke: string
  strokeWidth: number
  strokeEnabled: boolean
} {
  if (!stroke) {
    return { stroke: '', strokeWidth: 0, strokeEnabled: false }
  }
  
  return {
    stroke: colorValueToKonva(stroke.color, tokens),
    strokeWidth: stroke.width,
    strokeEnabled: true,
  }
}

/**
 * Apply common style properties to Konva node
 */
export function applyStyleToKonvaNode(
  node: Konva.Shape,
  layer: Layer,
  tokens?: Record<string, any>
): void {
  const fill = fillStyleToKonva(layer.style?.fill, tokens)
  const stroke = strokeStyleToKonva(layer.style?.stroke, tokens)
  
  node.fill(fill.fill)
  node.fillEnabled(fill.fillEnabled)
  node.stroke(stroke.stroke)
  node.strokeWidth(stroke.strokeWidth)
  node.strokeEnabled(stroke.strokeEnabled)
  
  if (layer.style?.opacity !== undefined) {
    node.opacity(layer.style.opacity)
  }
  
  if (layer.rotation !== undefined) {
    node.rotation(layer.rotation)
  }
}

/**
 * Create a Konva rect from layer data
 */
export function createKonvaRect(layer: Layer & { type: 'rect' }, tokens?: Record<string, any>): Konva.Rect {
  const rect = new Konva.Rect({
    x: layer.rect.x,
    y: layer.rect.y,
    width: layer.rect.w,
    height: layer.rect.h,
    cornerRadius: layer.style?.radius ?? 0,
  })
  
  applyStyleToKonvaNode(rect, layer, tokens)
  return rect
}

/**
 * Create a Konva text from layer data
 */
export function createKonvaText(layer: Layer & { type: 'text' }, tokens?: Record<string, any>): Konva.Text {
  const typography = layer.typography
  const text = new Konva.Text({
    x: layer.rect.x,
    y: layer.rect.y,
    width: layer.rect.w,
    height: layer.rect.h,
    text: layer.text || '',
    fontSize: typography && 'literal' in typography ? typography.literal.fontSize : 16,
    fontFamily: typography && 'literal' in typography ? typography.literal.fontFamily : 'Arial',
    fontStyle: typography && 'literal' in typography 
      ? (typography.literal.fontWeight >= 700 ? 'bold' : 'normal')
      : 'normal',
    align: layer.align || 'left',
    verticalAlign: layer.verticalAlign || 'top',
    lineHeight: typography && 'literal' in typography ? typography.literal.lineHeight : 1.2,
  })
  
  // Text color
  if (layer.color) {
    text.fill(colorValueToKonva(layer.color, tokens))
  } else {
    text.fill('#000000')
  }
  
  if (layer.style?.opacity !== undefined) {
    text.opacity(layer.style.opacity)
  }
  
  if (layer.rotation !== undefined) {
    text.rotation(layer.rotation)
  }
  
  return text
}

/**
 * Create a Konva ellipse from layer data
 */
export function createKonvaEllipse(layer: Layer & { type: 'ellipse' }, tokens?: Record<string, any>): Konva.Ellipse {
  const ellipse = new Konva.Ellipse({
    x: layer.rect.x + layer.rect.w / 2,
    y: layer.rect.y + layer.rect.h / 2,
    radiusX: layer.rect.w / 2,
    radiusY: layer.rect.h / 2,
  })
  
  applyStyleToKonvaNode(ellipse, layer, tokens)
  return ellipse
}

/**
 * Create a Konva line from layer data
 */
export function createKonvaLine(layer: Layer & { type: 'line' }, tokens?: Record<string, any>): Konva.Line {
  const points: number[] = []
  for (const point of layer.points) {
    points.push(point.x, point.y)
  }
  
  const line = new Konva.Line({
    points,
    closed: false,
  })
  
  applyStyleToKonvaNode(line, layer, tokens)
  
  // For lines, always ensure there's a visible stroke (lines need strokes to be visible)
  // If no stroke was applied, set a default black stroke
  if (!line.strokeEnabled() || !line.stroke() || line.strokeWidth() === 0) {
    line.stroke('#000000')
    line.strokeWidth(2)
    line.strokeEnabled(true)
  }
  
  // Apply line-specific stroke properties
  if (layer.style?.stroke) {
    const stroke = layer.style.stroke
    
    // Line cap
    if (stroke.lineCap) {
      line.lineCap(stroke.lineCap)
    }
    
    // Line join
    if (stroke.lineJoin) {
      line.lineJoin(stroke.lineJoin)
    }
    
    // Miter limit
    if (stroke.miterLimit !== undefined) {
      line.miterLimit(stroke.miterLimit)
    }
    
    // Dash pattern
    if (stroke.dash && stroke.dash.length > 0) {
      line.dash(stroke.dash)
    } else {
      line.dash([]) // Ensure solid line if dash is empty or undefined
    }
  }
  
  return line
}

/**
 * Create a Konva path from layer data
 */
export function createKonvaPath(layer: Layer & { type: 'path' }, tokens?: Record<string, any>): Konva.Path {
  // Convert path commands to SVG path string
  let pathData = ''
  for (const cmd of layer.commands) {
    if (cmd.type === 'M') {
      pathData += `M ${cmd.point.x} ${cmd.point.y} `
    } else if (cmd.type === 'L') {
      pathData += `L ${cmd.point.x} ${cmd.point.y} `
    } else if (cmd.type === 'C') {
      pathData += `C ${cmd.cp1.x} ${cmd.cp1.y} ${cmd.cp2.x} ${cmd.cp2.y} ${cmd.point.x} ${cmd.point.y} `
    } else if (cmd.type === 'Q') {
      pathData += `Q ${cmd.cp.x} ${cmd.cp.y} ${cmd.point.x} ${cmd.point.y} `
    } else if (cmd.type === 'Z') {
      pathData += 'Z '
    }
  }
  
  const path = new Konva.Path({
    data: pathData.trim(),
  })
  
  applyStyleToKonvaNode(path, layer, tokens)
  
  // For paths, ensure there's a visible stroke if no fill
  if (!path.fillEnabled() || !path.fill() || path.fill() === 'transparent') {
    if (!path.strokeEnabled() || !path.stroke() || path.strokeWidth() === 0) {
      path.stroke('#000000')
      path.strokeWidth(2)
      path.strokeEnabled(true)
    }
  }
  
  // Apply path-specific stroke properties
  if (layer.style?.stroke) {
    const stroke = layer.style.stroke
    
    if (stroke.lineCap) {
      path.lineCap(stroke.lineCap)
    }
    
    if (stroke.lineJoin) {
      path.lineJoin(stroke.lineJoin)
    }
    
    if (stroke.miterLimit !== undefined) {
      path.miterLimit(stroke.miterLimit)
    }
    
    if (stroke.dash && stroke.dash.length > 0) {
      path.dash(stroke.dash)
    } else {
      path.dash([])
    }
  }
  
  return path
}
