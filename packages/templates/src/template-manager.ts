import type { Document } from '../../schema/src'
import { deserializeBeaki, serializeBeaki } from '../../storage-core/src'
import {
  createShadcnTemplate,
  createLunarisTemplate,
  createHaloTemplate,
  createNitroTemplate,
} from './content'

export interface Template {
  id: string
  name: string
  description?: string
  thumbnail?: string
  category?: 'design-system' | 'blank' | 'example'
}

export class TemplateManager {
  private static templates: Template[] = [
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start with an empty canvas',
      category: 'blank',
    },
    {
      id: 'shadcn',
      name: 'Shadcn UI',
      description: 'Shadcn UI design system components',
      category: 'design-system',
    },
    {
      id: 'lunaris',
      name: 'Lunaris',
      description: 'Lunaris design system',
      category: 'design-system',
    },
    {
      id: 'halo',
      name: 'Halo',
      description: 'Halo design system',
      category: 'design-system',
    },
    {
      id: 'nitro',
      name: 'Nitro',
      description: 'Nitro design system',
      category: 'design-system',
    },
  ]

  static getTemplates(): Template[] {
    return [...this.templates]
  }

  static getTemplate(id: string): Template | undefined {
    return this.templates.find((t) => t.id === id)
  }

  static createBlankDocument(): Document {
    const now = new Date().toISOString()
    return {
      id: `doc-${Date.now()}` as any,
      schemaVersion: '1.0.0',
      name: 'Untitled',
      createdAt: now,
      updatedAt: now,
      activePageId: null,
      pages: {},
      frames: {},
      layers: {},
      tokens: {},
      components: {},
      assets: {},
    }
  }

  static async loadTemplate(templateId: string): Promise<Document> {
    const cached = this.loadTemplateFromLocalStorage(templateId)
    if (cached) {
      return cached
    }

    switch (templateId) {
      case 'blank':
        return this.createBlankDocument()
      case 'shadcn':
        return createShadcnTemplate()
      case 'lunaris':
        return createLunarisTemplate()
      case 'halo':
        return createHaloTemplate()
      case 'nitro':
        return createNitroTemplate()
      default:
        console.warn(`Unknown template ID: ${templateId}, returning blank document`)
        return this.createBlankDocument()
    }
  }

  static saveTemplateToLocalStorage(templateId: string, document: Document): void {
    try {
      const serialized = serializeBeaki(document)
      localStorage.setItem(`template-${templateId}`, serialized)
    } catch (error) {
      console.error('Failed to save template to localStorage:', error)
    }
  }

  static loadTemplateFromLocalStorage(templateId: string): Document | null {
    try {
      const stored = localStorage.getItem(`template-${templateId}`)
      if (!stored) return null
      const project = deserializeBeaki(stored)
      return project.document
    } catch (error) {
      console.error('Failed to load template from localStorage:', error)
      return null
    }
  }

  static registerTemplate(template: Template): void {
    const existing = this.templates.findIndex((t) => t.id === template.id)
    if (existing >= 0) {
      this.templates[existing] = template
    } else {
      this.templates.push(template)
    }
  }
}
