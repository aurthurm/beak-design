import { canvasStore } from './store'
import type { FrameId, LayerId } from '../schema'

/**
 * Animation system for visual feedback
 * Handles highlights, flashes, and animations for agent operations
 */

export type AnimationType = 'flash' | 'pulse' | 'highlight'

export interface Animation {
  id: string
  type: AnimationType
  targetId: FrameId | LayerId
  color?: string
  duration?: number
  startTime: number
}

class AnimationManager {
  private animations: Map<string, Animation> = new Map()
  private animationFrameId: number | null = null

  /**
   * Add a flash animation to a node
   */
  flashNode(nodeId: FrameId | LayerId, color: string = '#0066ff', duration: number = 500): void {
    const animation: Animation = {
      id: `flash-${Date.now()}-${Math.random()}`,
      type: 'flash',
      targetId: nodeId,
      color,
      duration,
      startTime: Date.now(),
    }

    this.animations.set(animation.id, animation)
    this.startAnimationLoop()
  }

  /**
   * Add a pulse animation to a node
   */
  pulseNode(nodeId: FrameId | LayerId, color: string = '#0066ff', duration: number = 1000): void {
    const animation: Animation = {
      id: `pulse-${Date.now()}-${Math.random()}`,
      type: 'pulse',
      targetId: nodeId,
      color,
      duration,
      startTime: Date.now(),
    }

    this.animations.set(animation.id, animation)
    this.startAnimationLoop()
  }

  /**
   * Add a highlight animation to a node
   */
  highlightNode(nodeId: FrameId | LayerId, color: string = '#0066ff', duration: number = 2000): void {
    const animation: Animation = {
      id: `highlight-${Date.now()}-${Math.random()}`,
      type: 'highlight',
      targetId: nodeId,
      color,
      duration,
      startTime: Date.now(),
    }

    this.animations.set(animation.id, animation)
    this.startAnimationLoop()
  }

  /**
   * Remove an animation
   */
  removeAnimation(animationId: string): void {
    this.animations.delete(animationId)
    if (this.animations.size === 0) {
      this.stopAnimationLoop()
    }
  }

  /**
   * Get active animations for a node
   */
  getAnimationsForNode(nodeId: FrameId | LayerId): Animation[] {
    return Array.from(this.animations.values()).filter(
      (anim) => anim.targetId === nodeId && this.isAnimationActive(anim)
    )
  }

  /**
   * Check if animation is still active
   */
  private isAnimationActive(animation: Animation): boolean {
    const elapsed = Date.now() - animation.startTime
    return elapsed < (animation.duration || 1000)
  }

  /**
   * Start animation loop
   */
  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) return

    const animate = () => {
      // Clean up expired animations
      const now = Date.now()
      for (const [id, anim] of this.animations.entries()) {
        if (now - anim.startTime > (anim.duration || 1000)) {
          this.animations.delete(id)
        }
      }

      if (this.animations.size > 0) {
        this.animationFrameId = requestAnimationFrame(animate)
        // Trigger canvas re-render
        canvasStore.setState((state) => ({ ...state }))
      } else {
        this.stopAnimationLoop()
      }
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Get animation opacity for a node (for rendering)
   */
  getAnimationOpacity(nodeId: FrameId | LayerId): number {
    const animations = this.getAnimationsForNode(nodeId)
    if (animations.length === 0) return 0

    // Use the most recent animation
    const anim = animations[animations.length - 1]
    const elapsed = Date.now() - anim.startTime
    const duration = anim.duration || 1000
    const progress = elapsed / duration

    switch (anim.type) {
      case 'flash':
        // Flash: quick fade in/out
        return progress < 0.5 ? progress * 2 : (1 - progress) * 2
      case 'pulse':
        // Pulse: oscillating
        return (Math.sin(progress * Math.PI * 4) + 1) / 2
      case 'highlight':
        // Highlight: fade out
        return 1 - progress
      default:
        return 0
    }
  }

  /**
   * Clear all animations
   */
  clearAll(): void {
    this.animations.clear()
    this.stopAnimationLoop()
  }
}

// Singleton instance
let animationManagerInstance: AnimationManager | null = null

export function getAnimationManager(): AnimationManager {
  if (!animationManagerInstance) {
    animationManagerInstance = new AnimationManager()
  }
  return animationManagerInstance
}

/**
 * Flash a node when agent modifies it
 */
export function flashNodeOnAgentOperation(nodeId: FrameId | LayerId): void {
  const manager = getAnimationManager()
  manager.flashNode(nodeId, '#0066ff', 500)
}

/**
 * Highlight nodes being processed by agent
 */
export function highlightAgentOperation(nodes: Array<FrameId | LayerId>): void {
  const manager = getAnimationManager()
  nodes.forEach((nodeId) => {
    manager.highlightNode(nodeId, '#0066ff', 2000)
  })
}
