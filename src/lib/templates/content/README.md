# Design System Templates

This directory contains pre-configured design system templates for the Beak Design application. Each template provides a complete Document structure with design tokens, sample components, and artboards.

## Available Templates

### Shadcn UI (`shadcn.ts`)
A modern, accessible design system based on Radix UI primitives.

**Features:**
- Clean, minimal aesthetic
- Neutral color palette (slate/gray)
- Inter font family
- Border radius: 6-8px
- Components: Primary/Secondary buttons, Card, Input field
- Comprehensive token system for colors, typography, and spacing

**Color Tokens:**
- Primary: #0F172A (dark slate)
- Secondary: #F1F5F9 (light slate)
- Muted: #64748B (mid gray)
- Border: #E2E8F0 (light border)

### Lunaris (`lunaris.ts`)
A futuristic, space-themed design system with cosmic aesthetics.

**Features:**
- Dark, cosmic color palette
- Purple/blue gradient accents
- Space Grotesk for headings, Inter for body
- Border radius: 10-16px
- Glow effects and opacity layers
- Components: Hero section, Glow buttons, Cosmic card
- Token naming reflects space theme (cosmic, stellar, nebula, etc.)

**Color Tokens:**
- Cosmic Purple: #8B5CF6
- Stellar Blue: #3B82F6
- Galaxy Dark: #0F0F23 (background)
- Stardust White: #F8FAFC (text)
- Aurora Green: #10B981 (success)

### Halo (`halo.ts`)
A clean, minimal design system with soft edges and subtle gradients.

**Status:** Template stub created. Full implementation pending.

**Planned Features:**
- Soft, rounded components
- Pastel color palette
- Subtle gradient backgrounds
- Gentle shadows and glows
- Modern sans-serif typography

### Nitro (`nitro.ts`)
A high-energy, bold design system with sharp edges and vibrant colors.

**Status:** Template stub created. Full implementation pending.

**Planned Features:**
- Bold, angular components
- High-contrast colors
- Sharp corners and edges
- Energetic, modern feel
- Strong typography with geometric fonts

## Template Structure

Each template follows the Document schema defined in `src/lib/schema.ts`:

```typescript
{
  id: DocumentId
  schemaVersion: "1.0.0"
  name: string
  createdAt: ISODateString
  updatedAt: ISODateString
  activePageId: PageId | null

  pages: Record<PageId, Page>
  frames: Record<FrameId, Frame>
  layers: Record<LayerId, Layer>
  tokens: Record<TokenId, Token>
  components: Record<ComponentId, Component>
  assets: Record<string, Asset>

  provenance: Provenance
}
```

### Key Components

1. **Pages**: Organizational structure for frames
2. **Frames**: Artboards that contain layers (e.g., "Button", "Card", "Hero")
3. **Layers**: Visual elements (rect, text, ellipse, etc.)
4. **Tokens**: Design tokens for colors, typography, and spacing
5. **Components**: Reusable component definitions (future use)
6. **Assets**: Images and other media (future use)

## Token System

Templates define three types of tokens:

### Color Tokens
```typescript
{
  id: TokenId
  kind: "color"
  name: string  // e.g., "primary", "cosmic.purple"
  value: { format: "hex", hex: string }
  meta?: { description: string }
}
```

### Typography Tokens
```typescript
{
  id: TokenId
  kind: "typography"
  name: string  // e.g., "heading.h1", "body"
  value: {
    fontFamily: string
    fontWeight: number
    fontSize: number
    lineHeight: number
    letterSpacing?: number
  }
}
```

### Spacing Tokens
```typescript
{
  id: TokenId
  kind: "spacing"
  name: string  // e.g., "space.md"
  value: { px: number }
}
```

## Token References

Layers can reference tokens instead of using literal values:

```typescript
// Using a token reference
color: { tokenRef: { tokenId: primaryTokenId } }

// Using a literal value
color: { literal: { format: "hex", hex: "#000000" } }
```

Token references allow for dynamic theme updates across the entire document.

## Creating a New Template

1. Create a new file in this directory (e.g., `my-system.ts`)
2. Export a function that returns a complete `Document` object
3. Define your color palette as tokens
4. Define typography and spacing tokens
5. Create frames to showcase your design system
6. Create layers within frames to demonstrate components
7. Import and add to `content/index.ts`
8. Update `template-manager.ts` to handle the new template ID

Example structure:

```typescript
import type { Document } from '../../schema'

export function createMySystemTemplate(): Document {
  const now = new Date().toISOString()
  const docId = `doc-mysystem-${Date.now()}` as any
  const pageId = `page-${Date.now()}` as any

  // Generate unique IDs for frames, layers, and tokens
  // Define your document structure

  return {
    id: docId,
    schemaVersion: '1.0.0',
    name: 'My Design System',
    // ... rest of document structure
  }
}
```

## Best Practices

1. **Unique IDs**: Use timestamp-based IDs to ensure uniqueness
2. **Token References**: Use token references for colors and typography wherever possible
3. **Descriptive Names**: Use clear, descriptive names for layers and frames
4. **Provenance**: Always include provenance information
5. **Showcase Components**: Include 3-5 key components that demonstrate the system
6. **Complete Tokens**: Define a full set of color, typography, and spacing tokens
7. **Documentation**: Add meta descriptions to tokens for clarity

## Usage

Templates are loaded via the `TemplateManager`:

```typescript
import { TemplateManager } from './template-manager'

// Load a template
const document = await TemplateManager.loadTemplate('shadcn')

// Get all available templates
const templates = TemplateManager.getTemplates()
```

## Future Enhancements

- [ ] Add thumbnail images for template preview
- [ ] Implement Halo and Nitro templates
- [ ] Add more component examples (modal, dropdown, navigation)
- [ ] Support for component definitions (reusable instances)
- [ ] Asset management for template images
- [ ] Template variants (light/dark modes)
- [ ] Export templates to other formats (Figma, Sketch)
