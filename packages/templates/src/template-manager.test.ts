import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TemplateManager } from './template-manager'

const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    clear: () => {
      store = {}
    },
    getItem: (key: string) => (key in store ? store[key] : null),
    removeItem: (key: string) => {
      delete store[key]
    },
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
  }
})()

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock)
  localStorageMock.clear()
})

afterEach(() => {
  localStorageMock.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('templates package', () => {
  it('exposes built-in templates', () => {
    const templates = TemplateManager.getTemplates()
    expect(templates.map((template) => template.id)).toEqual(['blank', 'shadcn', 'lunaris', 'halo', 'nitro'])
  })

  it('serializes and restores a template document from localStorage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-03T04:05:06.000Z'))

    const document = TemplateManager.createBlankDocument()
    TemplateManager.saveTemplateToLocalStorage('blank', document)

    const restored = TemplateManager.loadTemplateFromLocalStorage('blank')
    expect(restored?.name).toBe('Untitled')
    expect(restored?.schemaVersion).toBe('1.0.0')
  })

  it('loads the blank built-in template', async () => {
    const template = await TemplateManager.loadTemplate('blank')
    expect(template.activePageId).toBeNull()
    expect(template.name).toBe('Untitled')
  })

  it('loads all built-in design system templates', async () => {
    const templates = await Promise.all(
      ['shadcn', 'lunaris', 'halo', 'nitro'].map(async (templateId) => {
        const document = await TemplateManager.loadTemplate(templateId)
        return {
          templateId,
          name: document.name,
          frameCount: Object.keys(document.frames).length,
        }
      })
    )

    expect(templates).toEqual([
      { templateId: 'shadcn', name: 'Shadcn UI Design System', frameCount: 4 },
      { templateId: 'lunaris', name: 'Lunaris Design System', frameCount: 4 },
      { templateId: 'halo', name: 'Halo Design System', frameCount: 0 },
      { templateId: 'nitro', name: 'Nitro Design System', frameCount: 0 },
    ])
  })
})
