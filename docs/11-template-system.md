# Template System

## Overview

The template system provides pre-configured design system starting points with tokens, sample components, and style guides. Templates include color palettes, typography scales, spacing systems, and example UI elements.

## Architecture

```
TemplateManager
    ├── Template Registry (5 built-in templates)
    ├── Template Content (Document structures)
    ├── LocalStorage Cache (custom templates)
    └── Template Loader (async loading)
```

## Built-in Templates

### 1. Blank Template
Empty document with minimal structure.

**Contents:**
- 1 page ("Page 1")
- No frames, layers, or tokens
- Clean slate for custom designs

### 2. Shadcn UI Template
Modern, accessible design system based on Radix UI.

**Color Tokens (11):**
- `primary` - #0F172A (Slate 900)
- `secondary` - #F1F5F9 (Slate 100)
- `muted` - #94A3B8 (Slate 400)
- `border` - #E2E8F0 (Slate 200)
- `background` - #FFFFFF
- `foreground` - #020617 (Slate 950)
- `accent` - #3B82F6 (Blue 500)
- `destructive` - #EF4444 (Red 500)
- `success` - #10B981 (Green 500)
- `warning` - #F59E0B (Amber 500)
- `info` - #06B6D4 (Cyan 500)

**Typography Tokens (4):**
- `heading-1` - Inter, 700, 48px, 1.2 line-height
- `heading-2` - Inter, 600, 32px, 1.3 line-height
- `body` - Inter, 400, 16px, 1.5 line-height
- `small` - Inter, 400, 14px, 1.4 line-height

**Spacing Tokens (5):**
- `xs` - 4px
- `sm` - 8px
- `md` - 16px
- `lg` - 24px
- `xl` - 32px

**Sample Frames (4):**
- Design Tokens showcase
- Button variants (Primary, Secondary, Destructive)
- Card component
- Input component

### 3. Lunaris Template
Futuristic, space-themed design system.

**Color Tokens (11):**
- `cosmic-purple` - #8B5CF6 (Violet 500)
- `stellar-blue` - #3B82F6 (Blue 500)
- `nebula-pink` - #EC4899 (Pink 500)
- `galaxy-dark` - #0F0F23 (Deep navy)
- `void-black` - #000000
- `stardust` - #F3F4F6 (Gray 100)
- `meteor` - #6366F1 (Indigo 500)
- `aurora` - #10B981 (Green 500)
- `solar` - #F59E0B (Amber 500)
- `plasma` - #EF4444 (Red 500)
- `quantum` - #06B6D4 (Cyan 500)

**Typography Tokens (5):**
- `hero` - Space Grotesk, 700, 64px, 1.1
- `heading` - Space Grotesk, 600, 40px, 1.2
- `body` - Inter, 400, 16px, 1.6
- `small` - Inter, 400, 14px, 1.4
- `code` - JetBrains Mono, 400, 14px, 1.5

**Spacing Tokens (5):**
- `xs` - 4px
- `sm` - 8px
- `md` - 16px
- `lg` - 32px
- `xl` - 48px

**Sample Frames (4):**
- Hero Section (with glow effects)
- Button Variants (Cosmic theme)
- Cosmic Card (with gradients)
- Color Tokens showcase

**Special Effects:**
- Glow effects via opacity layers
- Gradient backgrounds
- Dark mode optimized

### 4. Halo Template
Soft, rounded components with pastel colors (stub).

**Status:** Placeholder - ready for implementation

### 5. Nitro Template
Bold, angular components with high contrast (stub).

**Status:** Placeholder - ready for implementation

## API Reference

### TemplateManager Class

Located in `src/lib/templates/template-manager.ts`

#### `getTemplates(): Template[]`
Get list of all available templates.

```typescript
import { TemplateManager } from '@/lib/templates/template-manager'

const templates = TemplateManager.getTemplates()
// Returns: [{ id, name, description, thumbnail }, ...]
```

#### `getTemplate(id: string): Template | undefined`
Get specific template metadata.

```typescript
const template = TemplateManager.getTemplate('shadcn')
console.log(template.name) // "Shadcn UI"
```

#### `loadTemplate(templateId: string): Promise<Document>`
Load template content as Document.

```typescript
const document = await TemplateManager.loadTemplate('shadcn')
// Returns full Document with pages, frames, layers, tokens
```

**Behavior:**
1. Checks localStorage for custom templates first
2. Loads built-in template if not found in cache
3. Returns blank document if template ID unknown

#### `createBlankDocument(): Document`
Create empty document structure.

```typescript
const blank = TemplateManager.createBlankDocument()
// Returns: { id, name, pages: [...], frames: {}, layers: {}, tokens: [], assets: {} }
```

#### `saveTemplateToLocalStorage(templateId: string, document: Document): void`
Save custom template to localStorage.

```typescript
TemplateManager.saveTemplateToLocalStorage('my-custom', document)
// Stored as: 'beak-template-my-custom'
```

#### `loadTemplateFromLocalStorage(templateId: string): Document | null`
Load custom template from localStorage.

```typescript
const custom = TemplateManager.loadTemplateFromLocalStorage('my-custom')
if (custom) {
  // Use custom template
}
```

#### `registerTemplate(template: Template): void`
Register new template dynamically.

```typescript
TemplateManager.registerTemplate({
  id: 'custom-system',
  name: 'Custom System',
  description: 'My design system',
  thumbnail: '/path/to/thumbnail.png'
})
```

## Document Structure

Templates return Document objects following this schema:

```typescript
interface Document {
  id: string
  name: string
  version: string
  pages: Page[]
  frames: Record<string, Frame>
  layers: Record<string, Layer>
  tokens: Token[]
  assets: Record<string, Asset>
}
```

### Pages
Top-level containers for frames.

```typescript
interface Page {
  id: string
  name: string
  frameIds: string[]
}
```

### Frames
Artboards containing layers.

```typescript
interface Frame {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  layerIds: string[]
  fill?: Fill
}
```

### Layers
Visual elements (rectangles, text, ellipses, images).

```typescript
interface Layer {
  id: string
  type: 'rect' | 'text' | 'ellipse' | 'image' | 'group'
  name: string
  x: number
  y: number
  width: number
  height: number
  fill?: Fill
  stroke?: Stroke
  opacity?: number
  // ... type-specific properties
}
```

### Tokens
Design system variables.

```typescript
interface Token {
  id: string
  name: string
  kind: 'color' | 'typography' | 'spacing'
  value: ColorValue | TypographyValue | SpacingValue
}
```

**Token Binding:**
Layers can reference tokens dynamically:

```typescript
// Color token reference
fill: {
  tokenRef: { tokenId: 'token-primary-color' }
}

// Literal value
fill: {
  color: '#FF0000'
}
```

## Usage Examples

### Basic Template Loading

```typescript
import { TemplateManager } from '@/lib/templates/template-manager'
import { canvasStore } from '@/lib/canvas/canvas-store'

async function createFromTemplate(templateId: string) {
  const document = await TemplateManager.loadTemplate(templateId)

  // Update canvas store
  canvasStore.setState(state => ({
    ...state,
    document
  }))
}

// Use template
await createFromTemplate('shadcn')
```

### Custom Template Creation

```typescript
import { TemplateManager } from '@/lib/templates/template-manager'
import { canvasStore } from '@/lib/canvas/canvas-store'

// Get current document
const currentDoc = canvasStore.state.document

// Save as custom template
TemplateManager.saveTemplateToLocalStorage('my-brand', currentDoc)

// Later: load custom template
const myBrand = await TemplateManager.loadTemplate('my-brand')
```

### Template Picker Component

```typescript
import { TemplateManager } from '@/lib/templates/template-manager'

function TemplatePicker() {
  const templates = TemplateManager.getTemplates()

  const handleSelect = async (templateId: string) => {
    const document = await TemplateManager.loadTemplate(templateId)
    // Apply to canvas
  }

  return (
    <div>
      {templates.map(template => (
        <button
          key={template.id}
          onClick={() => handleSelect(template.id)}
        >
          <img src={template.thumbnail} alt={template.name} />
          <h3>{template.name}</h3>
          <p>{template.description}</p>
        </button>
      ))}
    </div>
  )
}
```

### Token Resolution

```typescript
import { VariableManager } from '@/lib/variables/variable-manager'

function resolveTokenValue(fill: Fill): string {
  if ('tokenRef' in fill) {
    const token = VariableManager.getInstance()
      .getToken(fill.tokenRef.tokenId)

    if (token?.kind === 'color') {
      return token.value.hex
    }
  }

  return fill.color || '#000000'
}
```

## Creating New Templates

### Step 1: Create Template Content File

Create `src/lib/templates/content/my-template.ts`:

```typescript
import type { Document } from '@/lib/schema'

export function createMyTemplate(): Document {
  const pageId = `page-${Date.now()}`
  const frameId = `frame-${Date.now()}`
  const layerId = `layer-${Date.now()}`
  const tokenId = `token-${Date.now()}`

  return {
    id: `doc-${Date.now()}`,
    name: 'My Template',
    version: '1.0.0',
    pages: [
      {
        id: pageId,
        name: 'Page 1',
        frameIds: [frameId]
      }
    ],
    frames: {
      [frameId]: {
        id: frameId,
        name: 'Frame 1',
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        layerIds: [layerId],
        fill: { color: '#FFFFFF' }
      }
    },
    layers: {
      [layerId]: {
        id: layerId,
        type: 'rect',
        name: 'Background',
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        fill: {
          tokenRef: { tokenId }
        }
      }
    },
    tokens: [
      {
        id: tokenId,
        name: 'primary',
        kind: 'color',
        value: { hex: '#FF0000' }
      }
    ],
    assets: {}
  }
}
```

### Step 2: Register in Template Manager

Update `src/lib/templates/template-manager.ts`:

```typescript
import { createMyTemplate } from './content/my-template'

export class TemplateManager {
  private static templates: Template[] = [
    // ... existing templates
    {
      id: 'my-template',
      name: 'My Template',
      description: 'Custom design system',
      thumbnail: '/thumbnails/my-template.png'
    }
  ]

  static async loadTemplate(templateId: string): Promise<Document> {
    // ... existing code

    switch (templateId) {
      // ... existing cases
      case 'my-template':
        return createMyTemplate()
    }
  }
}
```

### Step 3: Export Template Content

Update `src/lib/templates/content/index.ts`:

```typescript
export { createMyTemplate } from './my-template'
```

## Best Practices

### Token Naming
- Use semantic names (`primary`, `secondary`) not literal colors (`blue`, `red`)
- Follow consistent naming conventions
- Group related tokens (color-primary, color-secondary)

### Frame Organization
- Create frames for common components
- Use descriptive frame names
- Include sample variations (default, hover, active)

### Layer Structure
- Group related layers
- Use meaningful layer names
- Apply tokens for consistency

### Documentation
- Add README in template content directory
- Document color palette rationale
- Explain typography scale choices

## Related Documentation

- [Canvas System](./03-canvas-system.md) - Document rendering
- [Variable/Token System](./01-agent-integration.md#tokens) - Token management
- [Storage System](./07-storage-database.md) - Template persistence
