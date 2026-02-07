import type { Document, FrameId, LayerId, Rect } from '../schema'
import { canvasStore } from '../canvas/store'

/**
 * Konva-based export utilities
 * Exports frames and layers to PNG/SVG formats
 */
export class KonvaExporter {
  /**
   * Export frame to PNG using Konva
   */
  async exportFrameToPNG(
    frameId: FrameId,
    scale: number = 1,
    maxResolution: number = 4096
  ): Promise<{ mimeType: 'image/png'; bytesBase64: string }> {
    const state = canvasStore.state
    if (!state.document) {
      throw new Error('No document loaded')
    }

    const frame = state.document.frames[frameId]
    if (!frame) {
      throw new Error(`Frame not found: ${frameId}`)
    }

    // Calculate dimensions
    let width = Math.ceil(frame.rect.w * scale)
    let height = Math.ceil(frame.rect.h * scale)

    // Limit to max resolution
    if (width > maxResolution || height > maxResolution) {
      const scaleFactor = maxResolution / Math.max(width, height)
      width = Math.ceil(width * scaleFactor)
      height = Math.ceil(height * scaleFactor)
    }

    // Create a temporary canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Set white background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Render frame and its layers
    await this.renderFrameToCanvas(ctx, frame, state.document, scale, width, height)

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/png')
    const bytesBase64 = dataUrl.split(',')[1] || dataUrl

    return {
      mimeType: 'image/png',
      bytesBase64,
    }
  }

  /**
   * Export frame to SVG
   */
  async exportFrameToSVG(frameId: FrameId): Promise<string> {
    const state = canvasStore.state
    if (!state.document) {
      throw new Error('No document loaded')
    }

    const frame = state.document.frames[frameId]
    if (!frame) {
      throw new Error(`Frame not found: ${frameId}`)
    }

    const svg = this.generateSVG(frame, state.document)
    return svg
  }

  /**
   * Render frame to canvas context
   */
  private async renderFrameToCanvas(
    ctx: CanvasRenderingContext2D,
    frame: any,
    document: Document,
    scale: number,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    ctx.save()
    ctx.scale(scale, scale)

    // Render layers
    for (const layerId of frame.childLayerIds || []) {
      const layer = document.layers[layerId]
      if (layer && !layer.flags?.hidden) {
        await this.renderLayerToCanvas(ctx, layer, document)
      }
    }

    ctx.restore()
  }

  /**
   * Render layer to canvas context
   */
  private async renderLayerToCanvas(
    ctx: CanvasRenderingContext2D,
    layer: any,
    document: Document
  ): Promise<void> {
    ctx.save()

    // Apply transform
    ctx.translate(layer.rect.x, layer.rect.y)
    if (layer.rotation) {
      ctx.rotate((layer.rotation * Math.PI) / 180)
    }

    // Render based on layer type
    switch (layer.type) {
      case 'rect':
        this.renderRectLayer(ctx, layer)
        break
      case 'ellipse':
        this.renderEllipseLayer(ctx, layer)
        break
      case 'text':
        await this.renderTextLayer(ctx, layer)
        break
      case 'image':
        await this.renderImageLayer(ctx, layer)
        break
      case 'group':
        // Render group children
        if (layer.children) {
          for (const childId of layer.children) {
            const child = document.layers[childId]
            if (child && !child.flags?.hidden) {
              await this.renderLayerToCanvas(ctx, child, document)
            }
          }
        }
        break
    }

    ctx.restore()
  }

  /**
   * Render rectangle layer
   */
  private renderRectLayer(ctx: CanvasRenderingContext2D, layer: any): void {
    const { rect, style } = layer

    // Fill
    if (style?.fill && style.fill.kind !== 'none') {
      ctx.fillStyle = this.resolveColor(style.fill.color)
      ctx.globalAlpha = style.opacity ?? 1
      if (style.radius) {
        this.roundRect(ctx, 0, 0, rect.w, rect.h, style.radius)
        ctx.fill()
      } else {
        ctx.fillRect(0, 0, rect.w, rect.h)
      }
    }

    // Stroke
    if (style?.stroke) {
      ctx.strokeStyle = this.resolveColor(style.stroke.color)
      ctx.lineWidth = style.stroke.width
      ctx.globalAlpha = style.opacity ?? 1
      if (style.radius) {
        this.roundRect(ctx, 0, 0, rect.w, rect.h, style.radius)
        ctx.stroke()
      } else {
        ctx.strokeRect(0, 0, rect.w, rect.h)
      }
    }
  }

  /**
   * Render ellipse layer
   */
  private renderEllipseLayer(ctx: CanvasRenderingContext2D, layer: any): void {
    const { rect, style } = layer
    const centerX = rect.w / 2
    const centerY = rect.h / 2
    const radiusX = rect.w / 2
    const radiusY = rect.h / 2

    ctx.beginPath()
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)

    // Fill
    if (style?.fill && style.fill.kind !== 'none') {
      ctx.fillStyle = this.resolveColor(style.fill.color)
      ctx.globalAlpha = style.opacity ?? 1
      ctx.fill()
    }

    // Stroke
    if (style?.stroke) {
      ctx.strokeStyle = this.resolveColor(style.stroke.color)
      ctx.lineWidth = style.stroke.width
      ctx.globalAlpha = style.opacity ?? 1
      ctx.stroke()
    }
  }

  /**
   * Render text layer
   */
  private async renderTextLayer(ctx: CanvasRenderingContext2D, layer: any): Promise<void> {
    const { rect, style, content } = layer

    if (!content) return

    ctx.save()

    // Set font properties
    const fontFamily = style?.fontFamily || 'Arial'
    const fontSize = style?.fontSize || 16
    const fontWeight = style?.fontWeight || 400
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`

    // Set text color
    if (style?.fill && style.fill.kind !== 'none') {
      ctx.fillStyle = this.resolveColor(style.fill.color)
    } else {
      ctx.fillStyle = '#000000'
    }

    ctx.globalAlpha = style?.opacity ?? 1
    ctx.textBaseline = 'top'

    // Render text
    ctx.fillText(content, 0, 0, rect.w)

    ctx.restore()
  }

  /**
   * Render image layer
   */
  private async renderImageLayer(ctx: CanvasRenderingContext2D, layer: any): Promise<void> {
    const { rect, imageUrl } = layer

    if (!imageUrl) return

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      ctx.globalAlpha = layer.style?.opacity ?? 1
      ctx.drawImage(img, 0, 0, rect.w, rect.h)
    } catch (error) {
      console.error('Failed to load image:', error)
    }
  }

  /**
   * Generate SVG for frame
   */
  private generateSVG(frame: any, document: Document): string {
    const { rect } = frame
    const svgParts: string[] = []

    svgParts.push(
      `<svg width="${rect.w}" height="${rect.h}" xmlns="http://www.w3.org/2000/svg">`
    )

    // Render layers
    for (const layerId of frame.childLayerIds || []) {
      const layer = document.layers[layerId]
      if (layer && !layer.flags?.hidden) {
        svgParts.push(this.generateLayerSVG(layer, document))
      }
    }

    svgParts.push('</svg>')
    return svgParts.join('\n')
  }

  /**
   * Generate SVG for a layer
   */
  private generateLayerSVG(layer: any, document: Document): string {
    const { rect, style, rotation } = layer
    const transform = rotation
      ? `transform="translate(${rect.x}, ${rect.y}) rotate(${rotation})"`
      : `x="${rect.x}" y="${rect.y}"`

    switch (layer.type) {
      case 'rect':
        return `<rect ${transform} width="${rect.w}" height="${rect.h}" ${this.getStyleAttributes(
          style
        )} />`
      case 'ellipse':
        return `<ellipse ${transform} cx="${rect.w / 2}" cy="${rect.h / 2}" rx="${
          rect.w / 2
        }" ry="${rect.h / 2}" ${this.getStyleAttributes(style)} />`
      case 'text':
        return `<text ${transform} ${this.getStyleAttributes(style)}>${this.escapeXml(
          layer.content || ''
        )}</text>`
      case 'image':
        return `<image ${transform} width="${rect.w}" height="${rect.h}" href="${layer.imageUrl || ''}" />`
      default:
        return ''
    }
  }

  /**
   * Get SVG style attributes from layer style
   */
  private getStyleAttributes(style: any): string {
    const attrs: string[] = []

    if (style?.fill && style.fill.kind !== 'none') {
      attrs.push(`fill="${this.resolveColor(style.fill.color)}"`)
    } else {
      attrs.push('fill="none"')
    }

    if (style?.stroke) {
      attrs.push(`stroke="${this.resolveColor(style.stroke.color)}"`)
      attrs.push(`stroke-width="${style.stroke.width}"`)
    }

    if (style?.opacity !== undefined) {
      attrs.push(`opacity="${style.opacity}"`)
    }

    return attrs.join(' ')
  }

  /**
   * Resolve color value (literal or token reference)
   */
  private resolveColor(colorValue: any): string {
    if (!colorValue) return '#000000'

    if (colorValue.literal) {
      return colorValue.literal.hex || '#000000'
    }

    if (colorValue.tokenRef) {
      // Resolve token reference
      const state = canvasStore.state
      if (state.document) {
        const token = state.document.tokens[colorValue.tokenRef.tokenId]
        if (token && token.kind === 'color') {
          return token.value.hex
        }
      }
    }

    return '#000000'
  }

  /**
   * Round rectangle helper
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  /**
   * Escape XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}

// Singleton instance
let exporterInstance: KonvaExporter | null = null

export function getKonvaExporter(): KonvaExporter {
  if (!exporterInstance) {
    exporterInstance = new KonvaExporter()
  }
  return exporterInstance
}
