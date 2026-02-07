import type { Document } from '../../schema'

/**
 * Shadcn UI Design System Template
 * A modern, accessible design system based on Radix UI primitives
 */
export function createShadcnTemplate(): Document {
  const now = new Date().toISOString()
  const docId = `doc-shadcn-${Date.now()}` as any
  const pageId = `page-${Date.now()}` as any

  // Frame IDs
  const tokensFrameId = `frame-tokens-${Date.now()}` as any
  const buttonFrameId = `frame-button-${Date.now() + 1}` as any
  const cardFrameId = `frame-card-${Date.now() + 2}` as any
  const inputFrameId = `frame-input-${Date.now() + 3}` as any

  // Token IDs
  const primaryTokenId = `token-primary-${Date.now()}` as any
  const primaryFgTokenId = `token-primary-fg-${Date.now() + 1}` as any
  const secondaryTokenId = `token-secondary-${Date.now() + 2}` as any
  const secondaryFgTokenId = `token-secondary-fg-${Date.now() + 3}` as any
  const backgroundTokenId = `token-background-${Date.now() + 4}` as any
  const foregroundTokenId = `token-foreground-${Date.now() + 5}` as any
  const mutedTokenId = `token-muted-${Date.now() + 6}` as any
  const mutedFgTokenId = `token-muted-fg-${Date.now() + 7}` as any
  const borderTokenId = `token-border-${Date.now() + 8}` as any
  const destructiveTokenId = `token-destructive-${Date.now() + 9}` as any
  const destructiveFgTokenId = `token-destructive-fg-${Date.now() + 10}` as any

  // Typography tokens
  const h1TokenId = `token-h1-${Date.now() + 11}` as any
  const h2TokenId = `token-h2-${Date.now() + 12}` as any
  const bodyTokenId = `token-body-${Date.now() + 13}` as any
  const smallTokenId = `token-small-${Date.now() + 14}` as any

  // Spacing tokens
  const spaceXsTokenId = `token-space-xs-${Date.now() + 15}` as any
  const spaceSmTokenId = `token-space-sm-${Date.now() + 16}` as any
  const spaceMdTokenId = `token-space-md-${Date.now() + 17}` as any
  const spaceLgTokenId = `token-space-lg-${Date.now() + 18}` as any
  const spaceXlTokenId = `token-space-xl-${Date.now() + 19}` as any

  // Layer IDs for token display frame
  const tokensHeaderId = `layer-tokens-header-${Date.now()}` as any
  const primaryColorId = `layer-primary-${Date.now() + 1}` as any
  const secondaryColorId = `layer-secondary-${Date.now() + 2}` as any
  const mutedColorId = `layer-muted-${Date.now() + 3}` as any

  // Button layer IDs
  const buttonBgId = `layer-button-bg-${Date.now() + 4}` as any
  const buttonTextId = `layer-button-text-${Date.now() + 5}` as any
  const buttonSecondaryBgId = `layer-button-secondary-bg-${Date.now() + 6}` as any
  const buttonSecondaryTextId = `layer-button-secondary-text-${Date.now() + 7}` as any

  // Card layer IDs
  const cardBgId = `layer-card-bg-${Date.now() + 8}` as any
  const cardTitleId = `layer-card-title-${Date.now() + 9}` as any
  const cardDescId = `layer-card-desc-${Date.now() + 10}` as any

  // Input layer IDs
  const inputBgId = `layer-input-bg-${Date.now() + 11}` as any
  const inputTextId = `layer-input-text-${Date.now() + 12}` as any
  const inputLabelId = `layer-input-label-${Date.now() + 13}` as any

  return {
    id: docId,
    schemaVersion: '1.0.0',
    name: 'Shadcn UI Design System',
    createdAt: now,
    updatedAt: now,
    activePageId: pageId,

    pages: {
      [pageId]: {
        id: pageId,
        documentId: docId,
        name: 'Components',
        frameIds: [tokensFrameId, buttonFrameId, cardFrameId, inputFrameId],
        provenance: {
          createdAt: now,
          createdBy: { kind: 'user' },
        },
      },
    },

    frames: {
      // Tokens showcase frame
      [tokensFrameId]: {
        id: tokensFrameId,
        pageId,
        name: 'Design Tokens',
        platform: 'web',
        rect: { x: 100, y: 100, w: 400, h: 500 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: backgroundTokenId } } },
        childLayerIds: [tokensHeaderId, primaryColorId, secondaryColorId, mutedColorId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Button frame
      [buttonFrameId]: {
        id: buttonFrameId,
        pageId,
        name: 'Button',
        platform: 'web',
        rect: { x: 550, y: 100, w: 400, h: 300 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: backgroundTokenId } } },
        childLayerIds: [buttonBgId, buttonTextId, buttonSecondaryBgId, buttonSecondaryTextId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Card frame
      [cardFrameId]: {
        id: cardFrameId,
        pageId,
        name: 'Card',
        platform: 'web',
        rect: { x: 1000, y: 100, w: 350, h: 250 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: backgroundTokenId } } },
        childLayerIds: [cardBgId, cardTitleId, cardDescId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Input frame
      [inputFrameId]: {
        id: inputFrameId,
        pageId,
        name: 'Input',
        platform: 'web',
        rect: { x: 100, y: 650, w: 400, h: 200 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: backgroundTokenId } } },
        childLayerIds: [inputLabelId, inputBgId, inputTextId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
    },

    layers: {
      // Tokens frame layers
      [tokensHeaderId]: {
        id: tokensHeaderId,
        type: 'text',
        name: 'Tokens Header',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 150, y: 130, w: 300, h: 40 },
        text: 'Design Tokens',
        typography: { tokenRef: { tokenId: h1TokenId } },
        color: { tokenRef: { tokenId: foregroundTokenId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [primaryColorId]: {
        id: primaryColorId,
        type: 'rect',
        name: 'Primary Color',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 150, y: 200, w: 300, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: primaryTokenId } } },
          radius: 8,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [secondaryColorId]: {
        id: secondaryColorId,
        type: 'rect',
        name: 'Secondary Color',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 150, y: 280, w: 300, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: secondaryTokenId } } },
          radius: 8,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [mutedColorId]: {
        id: mutedColorId,
        type: 'rect',
        name: 'Muted Color',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 150, y: 360, w: 300, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: mutedTokenId } } },
          radius: 8,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Button layers
      [buttonBgId]: {
        id: buttonBgId,
        type: 'rect',
        name: 'Primary Button',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 600, y: 150, w: 150, h: 44 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: primaryTokenId } } },
          radius: 6,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [buttonTextId]: {
        id: buttonTextId,
        type: 'text',
        name: 'Button Text',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 635, y: 161, w: 80, h: 22 },
        text: 'Primary',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: primaryFgTokenId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [buttonSecondaryBgId]: {
        id: buttonSecondaryBgId,
        type: 'rect',
        name: 'Secondary Button',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 600, y: 220, w: 150, h: 44 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: secondaryTokenId } } },
          stroke: { width: 1, color: { tokenRef: { tokenId: borderTokenId } } },
          radius: 6,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [buttonSecondaryTextId]: {
        id: buttonSecondaryTextId,
        type: 'text',
        name: 'Secondary Text',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 625, y: 231, w: 100, h: 22 },
        text: 'Secondary',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: secondaryFgTokenId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Card layers
      [cardBgId]: {
        id: cardBgId,
        type: 'rect',
        name: 'Card Background',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 1030, y: 130, w: 290, h: 180 },
        style: {
          fill: { kind: 'solid', color: { literal: { format: 'hex', hex: '#FFFFFF' } } },
          stroke: { width: 1, color: { tokenRef: { tokenId: borderTokenId } } },
          radius: 8,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardTitleId]: {
        id: cardTitleId,
        type: 'text',
        name: 'Card Title',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 1054, y: 154, w: 242, h: 32 },
        text: 'Card Title',
        typography: { tokenRef: { tokenId: h2TokenId } },
        color: { tokenRef: { tokenId: foregroundTokenId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardDescId]: {
        id: cardDescId,
        type: 'text',
        name: 'Card Description',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 1054, y: 194, w: 242, h: 80 },
        text: 'Card description goes here. This is an example of a Shadcn UI card component.',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: mutedFgTokenId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Input layers
      [inputLabelId]: {
        id: inputLabelId,
        type: 'text',
        name: 'Input Label',
        parentId: inputFrameId,
        frameId: inputFrameId,
        rect: { x: 140, y: 690, w: 320, h: 20 },
        text: 'Email',
        typography: { tokenRef: { tokenId: smallTokenId } },
        color: { tokenRef: { tokenId: foregroundTokenId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [inputBgId]: {
        id: inputBgId,
        type: 'rect',
        name: 'Input Background',
        parentId: inputFrameId,
        frameId: inputFrameId,
        rect: { x: 140, y: 720, w: 320, h: 44 },
        style: {
          fill: { kind: 'solid', color: { literal: { format: 'hex', hex: '#FFFFFF' } } },
          stroke: { width: 1, color: { tokenRef: { tokenId: borderTokenId } } },
          radius: 6,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [inputTextId]: {
        id: inputTextId,
        type: 'text',
        name: 'Input Placeholder',
        parentId: inputFrameId,
        frameId: inputFrameId,
        rect: { x: 152, y: 731, w: 296, h: 22 },
        text: 'you@example.com',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: mutedFgTokenId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
    },

    tokens: {
      // Color tokens
      [primaryTokenId]: {
        id: primaryTokenId,
        kind: 'color',
        name: 'primary',
        value: { format: 'hex', hex: '#0F172A' },
        meta: { description: 'Primary brand color' },
      },
      [primaryFgTokenId]: {
        id: primaryFgTokenId,
        kind: 'color',
        name: 'primary-foreground',
        value: { format: 'hex', hex: '#F8FAFC' },
        meta: { description: 'Text on primary color' },
      },
      [secondaryTokenId]: {
        id: secondaryTokenId,
        kind: 'color',
        name: 'secondary',
        value: { format: 'hex', hex: '#F1F5F9' },
        meta: { description: 'Secondary background color' },
      },
      [secondaryFgTokenId]: {
        id: secondaryFgTokenId,
        kind: 'color',
        name: 'secondary-foreground',
        value: { format: 'hex', hex: '#0F172A' },
        meta: { description: 'Text on secondary color' },
      },
      [backgroundTokenId]: {
        id: backgroundTokenId,
        kind: 'color',
        name: 'background',
        value: { format: 'hex', hex: '#FFFFFF' },
        meta: { description: 'Page background' },
      },
      [foregroundTokenId]: {
        id: foregroundTokenId,
        kind: 'color',
        name: 'foreground',
        value: { format: 'hex', hex: '#0F172A' },
        meta: { description: 'Primary text color' },
      },
      [mutedTokenId]: {
        id: mutedTokenId,
        kind: 'color',
        name: 'muted',
        value: { format: 'hex', hex: '#F1F5F9' },
        meta: { description: 'Muted background' },
      },
      [mutedFgTokenId]: {
        id: mutedFgTokenId,
        kind: 'color',
        name: 'muted-foreground',
        value: { format: 'hex', hex: '#64748B' },
        meta: { description: 'Muted text' },
      },
      [borderTokenId]: {
        id: borderTokenId,
        kind: 'color',
        name: 'border',
        value: { format: 'hex', hex: '#E2E8F0' },
        meta: { description: 'Border color' },
      },
      [destructiveTokenId]: {
        id: destructiveTokenId,
        kind: 'color',
        name: 'destructive',
        value: { format: 'hex', hex: '#EF4444' },
        meta: { description: 'Destructive/error color' },
      },
      [destructiveFgTokenId]: {
        id: destructiveFgTokenId,
        kind: 'color',
        name: 'destructive-foreground',
        value: { format: 'hex', hex: '#FEFEFE' },
        meta: { description: 'Text on destructive color' },
      },

      // Typography tokens
      [h1TokenId]: {
        id: h1TokenId,
        kind: 'typography',
        name: 'heading.h1',
        value: {
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: 36,
          lineHeight: 44,
          letterSpacing: -0.5,
        },
        meta: { description: 'Large heading' },
      },
      [h2TokenId]: {
        id: h2TokenId,
        kind: 'typography',
        name: 'heading.h2',
        value: {
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: 24,
          lineHeight: 32,
          letterSpacing: -0.25,
        },
        meta: { description: 'Section heading' },
      },
      [bodyTokenId]: {
        id: bodyTokenId,
        kind: 'typography',
        name: 'body',
        value: {
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 20,
          letterSpacing: 0,
        },
        meta: { description: 'Body text' },
      },
      [smallTokenId]: {
        id: smallTokenId,
        kind: 'typography',
        name: 'small',
        value: {
          fontFamily: 'Inter',
          fontWeight: 500,
          fontSize: 12,
          lineHeight: 16,
          letterSpacing: 0,
        },
        meta: { description: 'Small text/labels' },
      },

      // Spacing tokens
      [spaceXsTokenId]: {
        id: spaceXsTokenId,
        kind: 'spacing',
        name: 'space.xs',
        value: { px: 4 },
        meta: { description: 'Extra small spacing' },
      },
      [spaceSmTokenId]: {
        id: spaceSmTokenId,
        kind: 'spacing',
        name: 'space.sm',
        value: { px: 8 },
        meta: { description: 'Small spacing' },
      },
      [spaceMdTokenId]: {
        id: spaceMdTokenId,
        kind: 'spacing',
        name: 'space.md',
        value: { px: 16 },
        meta: { description: 'Medium spacing' },
      },
      [spaceLgTokenId]: {
        id: spaceLgTokenId,
        kind: 'spacing',
        name: 'space.lg',
        value: { px: 24 },
        meta: { description: 'Large spacing' },
      },
      [spaceXlTokenId]: {
        id: spaceXlTokenId,
        kind: 'spacing',
        name: 'space.xl',
        value: { px: 32 },
        meta: { description: 'Extra large spacing' },
      },
    },

    components: {},
    assets: {},
  }
}
