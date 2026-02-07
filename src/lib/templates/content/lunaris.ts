import type { Document } from '../../schema'

/**
 * Lunaris Design System Template
 * A futuristic, space-themed design system with cosmic aesthetics
 */
export function createLunarisTemplate(): Document {
  const now = new Date().toISOString()
  const docId = `doc-lunaris-${Date.now()}` as any
  const pageId = `page-${Date.now()}` as any

  // Frame IDs
  const heroFrameId = `frame-hero-${Date.now()}` as any
  const buttonFrameId = `frame-button-${Date.now() + 1}` as any
  const cardFrameId = `frame-card-${Date.now() + 2}` as any
  const tokensFrameId = `frame-tokens-${Date.now() + 3}` as any

  // Token IDs - Cosmic color palette
  const cosmicPurpleId = `token-cosmic-purple-${Date.now()}` as any
  const stellarBlueId = `token-stellar-blue-${Date.now() + 1}` as any
  const nebulaVioletId = `token-nebula-violet-${Date.now() + 2}` as any
  const galaxyDarkId = `token-galaxy-dark-${Date.now() + 3}` as any
  const stardustWhiteId = `token-stardust-white-${Date.now() + 4}` as any
  const lunarGrayId = `token-lunar-gray-${Date.now() + 5}` as any
  const auroraGreenId = `token-aurora-green-${Date.now() + 6}` as any
  const solarYellowId = `token-solar-yellow-${Date.now() + 7}` as any
  const accentCyanId = `token-accent-cyan-${Date.now() + 8}` as any
  const surfaceId = `token-surface-${Date.now() + 9}` as any
  const borderGlowId = `token-border-glow-${Date.now() + 10}` as any

  // Typography tokens
  const displayTokenId = `token-display-${Date.now() + 11}` as any
  const headingTokenId = `token-heading-${Date.now() + 12}` as any
  const bodyTokenId = `token-body-${Date.now() + 13}` as any
  const captionTokenId = `token-caption-${Date.now() + 14}` as any
  const codeTokenId = `token-code-${Date.now() + 15}` as any

  // Spacing tokens
  const spaceXsTokenId = `token-space-xs-${Date.now() + 16}` as any
  const spaceSmTokenId = `token-space-sm-${Date.now() + 17}` as any
  const spaceMdTokenId = `token-space-md-${Date.now() + 18}` as any
  const spaceLgTokenId = `token-space-lg-${Date.now() + 19}` as any
  const spaceXlTokenId = `token-space-xl-${Date.now() + 20}` as any

  // Hero frame layer IDs
  const heroBgId = `layer-hero-bg-${Date.now()}` as any
  const heroTitleId = `layer-hero-title-${Date.now() + 1}` as any
  const heroSubtitleId = `layer-hero-subtitle-${Date.now() + 2}` as any
  const heroGlowId = `layer-hero-glow-${Date.now() + 3}` as any

  // Button layer IDs
  const primaryBtnBgId = `layer-primary-btn-bg-${Date.now() + 4}` as any
  const primaryBtnTextId = `layer-primary-btn-text-${Date.now() + 5}` as any
  const ghostBtnBgId = `layer-ghost-btn-bg-${Date.now() + 6}` as any
  const ghostBtnTextId = `layer-ghost-btn-text-${Date.now() + 7}` as any
  const glowBtnBgId = `layer-glow-btn-bg-${Date.now() + 8}` as any
  const glowBtnTextId = `layer-glow-btn-text-${Date.now() + 9}` as any

  // Card layer IDs
  const cardBgId = `layer-card-bg-${Date.now() + 10}` as any
  const cardGlowId = `layer-card-glow-${Date.now() + 11}` as any
  const cardIconId = `layer-card-icon-${Date.now() + 12}` as any
  const cardTitleId = `layer-card-title-${Date.now() + 13}` as any
  const cardDescId = `layer-card-desc-${Date.now() + 14}` as any
  const cardAccentId = `layer-card-accent-${Date.now() + 15}` as any

  // Token showcase layer IDs
  const tokensHeaderId = `layer-tokens-header-${Date.now() + 16}` as any
  const cosmicColorId = `layer-cosmic-${Date.now() + 17}` as any
  const stellarColorId = `layer-stellar-${Date.now() + 18}` as any
  const nebulaColorId = `layer-nebula-${Date.now() + 19}` as any
  const auroraColorId = `layer-aurora-${Date.now() + 20}` as any

  return {
    id: docId,
    schemaVersion: '1.0.0',
    name: 'Lunaris Design System',
    createdAt: now,
    updatedAt: now,
    activePageId: pageId,

    pages: {
      [pageId]: {
        id: pageId,
        documentId: docId,
        name: 'Cosmic Components',
        frameIds: [heroFrameId, buttonFrameId, cardFrameId, tokensFrameId],
        provenance: {
          createdAt: now,
          createdBy: { kind: 'user' },
        },
      },
    },

    frames: {
      // Hero section frame
      [heroFrameId]: {
        id: heroFrameId,
        pageId,
        name: 'Hero Section',
        platform: 'web',
        rect: { x: 100, y: 100, w: 800, h: 400 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: galaxyDarkId } } },
        childLayerIds: [heroBgId, heroGlowId, heroTitleId, heroSubtitleId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Button variants frame
      [buttonFrameId]: {
        id: buttonFrameId,
        pageId,
        name: 'Button Variants',
        platform: 'web',
        rect: { x: 950, y: 100, w: 450, h: 400 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: galaxyDarkId } } },
        childLayerIds: [primaryBtnBgId, primaryBtnTextId, ghostBtnBgId, ghostBtnTextId, glowBtnBgId, glowBtnTextId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Card frame
      [cardFrameId]: {
        id: cardFrameId,
        pageId,
        name: 'Cosmic Card',
        platform: 'web',
        rect: { x: 100, y: 550, w: 400, h: 350 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: galaxyDarkId } } },
        childLayerIds: [cardGlowId, cardBgId, cardAccentId, cardIconId, cardTitleId, cardDescId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Tokens showcase
      [tokensFrameId]: {
        id: tokensFrameId,
        pageId,
        name: 'Color Tokens',
        platform: 'web',
        rect: { x: 550, y: 550, w: 500, h: 350 },
        background: { kind: 'solid', color: { tokenRef: { tokenId: galaxyDarkId } } },
        childLayerIds: [tokensHeaderId, cosmicColorId, stellarColorId, nebulaColorId, auroraColorId],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
    },

    layers: {
      // Hero frame layers
      [heroBgId]: {
        id: heroBgId,
        type: 'rect',
        name: 'Hero Gradient',
        parentId: heroFrameId,
        frameId: heroFrameId,
        rect: { x: 100, y: 100, w: 800, h: 400 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: nebulaVioletId } } },
          opacity: 0.3,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [heroGlowId]: {
        id: heroGlowId,
        type: 'ellipse',
        name: 'Cosmic Glow',
        parentId: heroFrameId,
        frameId: heroFrameId,
        rect: { x: 300, y: 200, w: 400, h: 300 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: cosmicPurpleId } } },
          opacity: 0.15,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [heroTitleId]: {
        id: heroTitleId,
        type: 'text',
        name: 'Hero Title',
        parentId: heroFrameId,
        frameId: heroFrameId,
        rect: { x: 150, y: 220, w: 700, h: 70 },
        text: 'Lunaris Design System',
        typography: { tokenRef: { tokenId: displayTokenId } },
        color: { tokenRef: { tokenId: stardustWhiteId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [heroSubtitleId]: {
        id: heroSubtitleId,
        type: 'text',
        name: 'Hero Subtitle',
        parentId: heroFrameId,
        frameId: heroFrameId,
        rect: { x: 200, y: 310, w: 600, h: 30 },
        text: 'Cosmic aesthetics for the modern web',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: accentCyanId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Button layers
      [primaryBtnBgId]: {
        id: primaryBtnBgId,
        type: 'rect',
        name: 'Primary Button',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1050, y: 150, w: 250, h: 50 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: cosmicPurpleId } } },
          radius: 12,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [primaryBtnTextId]: {
        id: primaryBtnTextId,
        type: 'text',
        name: 'Primary Text',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1105, y: 163, w: 140, h: 24 },
        text: 'Launch Mission',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: stardustWhiteId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [ghostBtnBgId]: {
        id: ghostBtnBgId,
        type: 'rect',
        name: 'Ghost Button',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1050, y: 230, w: 250, h: 50 },
        style: {
          fill: { kind: 'none' },
          stroke: { width: 2, color: { tokenRef: { tokenId: stellarBlueId } } },
          radius: 12,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [ghostBtnTextId]: {
        id: ghostBtnTextId,
        type: 'text',
        name: 'Ghost Text',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1095, y: 243, w: 160, h: 24 },
        text: 'Explore Galaxy',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: stellarBlueId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [glowBtnBgId]: {
        id: glowBtnBgId,
        type: 'rect',
        name: 'Glow Button',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1050, y: 310, w: 250, h: 50 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: auroraGreenId } } },
          radius: 12,
          opacity: 0.9,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [glowBtnTextId]: {
        id: glowBtnTextId,
        type: 'text',
        name: 'Glow Text',
        parentId: buttonFrameId,
        frameId: buttonFrameId,
        rect: { x: 1100, y: 323, w: 150, h: 24 },
        text: 'Aurora Effect',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: galaxyDarkId } },
        align: 'center',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Card layers
      [cardGlowId]: {
        id: cardGlowId,
        type: 'rect',
        name: 'Card Outer Glow',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 138, y: 588, w: 324, h: 274 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: cosmicPurpleId } } },
          radius: 18,
          opacity: 0.2,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardBgId]: {
        id: cardBgId,
        type: 'rect',
        name: 'Card Background',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 145, y: 595, w: 310, h: 260 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: surfaceId } } },
          stroke: { width: 1, color: { tokenRef: { tokenId: borderGlowId } } },
          radius: 16,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardAccentId]: {
        id: cardAccentId,
        type: 'rect',
        name: 'Card Accent',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 145, y: 595, w: 310, h: 4 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: accentCyanId } } },
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardIconId]: {
        id: cardIconId,
        type: 'ellipse',
        name: 'Card Icon',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 175, y: 630, w: 60, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: cosmicPurpleId } } },
          opacity: 0.8,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardTitleId]: {
        id: cardTitleId,
        type: 'text',
        name: 'Card Title',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 175, y: 710, w: 250, h: 32 },
        text: 'Stellar Component',
        typography: { tokenRef: { tokenId: headingTokenId } },
        color: { tokenRef: { tokenId: stardustWhiteId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cardDescId]: {
        id: cardDescId,
        type: 'text',
        name: 'Card Description',
        parentId: cardFrameId,
        frameId: cardFrameId,
        rect: { x: 175, y: 752, w: 250, h: 70 },
        text: 'Illuminate your interfaces with cosmic elegance. Built for the future of design.',
        typography: { tokenRef: { tokenId: bodyTokenId } },
        color: { tokenRef: { tokenId: lunarGrayId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },

      // Token showcase layers
      [tokensHeaderId]: {
        id: tokensHeaderId,
        type: 'text',
        name: 'Tokens Header',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 600, y: 580, w: 400, h: 36 },
        text: 'Cosmic Color Palette',
        typography: { tokenRef: { tokenId: headingTokenId } },
        color: { tokenRef: { tokenId: stardustWhiteId } },
        align: 'left',
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [cosmicColorId]: {
        id: cosmicColorId,
        type: 'rect',
        name: 'Cosmic Purple',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 600, y: 640, w: 200, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: cosmicPurpleId } } },
          radius: 10,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [stellarColorId]: {
        id: stellarColorId,
        type: 'rect',
        name: 'Stellar Blue',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 820, y: 640, w: 200, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: stellarBlueId } } },
          radius: 10,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [nebulaColorId]: {
        id: nebulaColorId,
        type: 'rect',
        name: 'Nebula Violet',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 600, y: 720, w: 200, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: nebulaVioletId } } },
          radius: 10,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
      [auroraColorId]: {
        id: auroraColorId,
        type: 'rect',
        name: 'Aurora Green',
        parentId: tokensFrameId,
        frameId: tokensFrameId,
        rect: { x: 820, y: 720, w: 200, h: 60 },
        style: {
          fill: { kind: 'solid', color: { tokenRef: { tokenId: auroraGreenId } } },
          radius: 10,
        },
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
    },

    tokens: {
      // Color tokens - Cosmic palette
      [cosmicPurpleId]: {
        id: cosmicPurpleId,
        kind: 'color',
        name: 'cosmic.purple',
        value: { format: 'hex', hex: '#8B5CF6' },
        meta: { description: 'Primary cosmic purple' },
      },
      [stellarBlueId]: {
        id: stellarBlueId,
        kind: 'color',
        name: 'stellar.blue',
        value: { format: 'hex', hex: '#3B82F6' },
        meta: { description: 'Stellar blue accent' },
      },
      [nebulaVioletId]: {
        id: nebulaVioletId,
        kind: 'color',
        name: 'nebula.violet',
        value: { format: 'hex', hex: '#A78BFA' },
        meta: { description: 'Nebula violet gradient' },
      },
      [galaxyDarkId]: {
        id: galaxyDarkId,
        kind: 'color',
        name: 'galaxy.dark',
        value: { format: 'hex', hex: '#0F0F23' },
        meta: { description: 'Deep space background' },
      },
      [stardustWhiteId]: {
        id: stardustWhiteId,
        kind: 'color',
        name: 'stardust.white',
        value: { format: 'hex', hex: '#F8FAFC' },
        meta: { description: 'Bright text color' },
      },
      [lunarGrayId]: {
        id: lunarGrayId,
        kind: 'color',
        name: 'lunar.gray',
        value: { format: 'hex', hex: '#94A3B8' },
        meta: { description: 'Muted gray text' },
      },
      [auroraGreenId]: {
        id: auroraGreenId,
        kind: 'color',
        name: 'aurora.green',
        value: { format: 'hex', hex: '#10B981' },
        meta: { description: 'Aurora green success' },
      },
      [solarYellowId]: {
        id: solarYellowId,
        kind: 'color',
        name: 'solar.yellow',
        value: { format: 'hex', hex: '#FBBF24' },
        meta: { description: 'Solar yellow warning' },
      },
      [accentCyanId]: {
        id: accentCyanId,
        kind: 'color',
        name: 'accent.cyan',
        value: { format: 'hex', hex: '#06B6D4' },
        meta: { description: 'Cyan accent color' },
      },
      [surfaceId]: {
        id: surfaceId,
        kind: 'color',
        name: 'surface',
        value: { format: 'hex', hex: '#1E1B33' },
        meta: { description: 'Card/surface background' },
      },
      [borderGlowId]: {
        id: borderGlowId,
        kind: 'color',
        name: 'border.glow',
        value: { format: 'hex', hex: '#4C1D95' },
        meta: { description: 'Glowing border color' },
      },

      // Typography tokens
      [displayTokenId]: {
        id: displayTokenId,
        kind: 'typography',
        name: 'display',
        value: {
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 56,
          lineHeight: 64,
          letterSpacing: -1,
        },
        meta: { description: 'Large display text' },
      },
      [headingTokenId]: {
        id: headingTokenId,
        kind: 'typography',
        name: 'heading',
        value: {
          fontFamily: 'Space Grotesk',
          fontWeight: 600,
          fontSize: 28,
          lineHeight: 36,
          letterSpacing: -0.5,
        },
        meta: { description: 'Section headings' },
      },
      [bodyTokenId]: {
        id: bodyTokenId,
        kind: 'typography',
        name: 'body',
        value: {
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 24,
          letterSpacing: 0,
        },
        meta: { description: 'Body text' },
      },
      [captionTokenId]: {
        id: captionTokenId,
        kind: 'typography',
        name: 'caption',
        value: {
          fontFamily: 'Inter',
          fontWeight: 500,
          fontSize: 13,
          lineHeight: 18,
          letterSpacing: 0,
        },
        meta: { description: 'Caption/label text' },
      },
      [codeTokenId]: {
        id: codeTokenId,
        kind: 'typography',
        name: 'code',
        value: {
          fontFamily: 'JetBrains Mono',
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 20,
          letterSpacing: 0,
        },
        meta: { description: 'Code/monospace text' },
      },

      // Spacing tokens
      [spaceXsTokenId]: {
        id: spaceXsTokenId,
        kind: 'spacing',
        name: 'space.xs',
        value: { px: 8 },
        meta: { description: 'Extra small spacing' },
      },
      [spaceSmTokenId]: {
        id: spaceSmTokenId,
        kind: 'spacing',
        name: 'space.sm',
        value: { px: 12 },
        meta: { description: 'Small spacing' },
      },
      [spaceMdTokenId]: {
        id: spaceMdTokenId,
        kind: 'spacing',
        name: 'space.md',
        value: { px: 20 },
        meta: { description: 'Medium spacing' },
      },
      [spaceLgTokenId]: {
        id: spaceLgTokenId,
        kind: 'spacing',
        name: 'space.lg',
        value: { px: 32 },
        meta: { description: 'Large spacing' },
      },
      [spaceXlTokenId]: {
        id: spaceXlTokenId,
        kind: 'spacing',
        name: 'space.xl',
        value: { px: 48 },
        meta: { description: 'Extra large spacing' },
      },
    },

    components: {},
    assets: {},
  }
}
