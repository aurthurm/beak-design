import type { Document, TokenId, Token, ColorToken, TypographyToken, SpacingToken } from '../schema'
import { canvasStore, canvasActions } from '../canvas/store'

/**
 * Variable/Token Manager
 * Manages design tokens (colors, typography, spacing) with theme support
 * Adapted from reference implementation for Konva-based system
 */
export class VariableManager {
  private document: Document | null = null

  constructor() {
    // Subscribe to document changes
    canvasStore.subscribe((state) => {
      this.document = state.document
    })
  }

  /**
   * Get all tokens from current document
   */
  getTokens(): Record<TokenId, Token> {
    return this.document?.tokens || {}
  }

  /**
   * Get token by ID
   */
  getToken(tokenId: TokenId): Token | undefined {
    return this.document?.tokens?.[tokenId]
  }

  /**
   * Get tokens by kind
   */
  getTokensByKind(kind: 'color' | 'typography' | 'spacing'): Token[] {
    const tokens = this.getTokens()
    return Object.values(tokens).filter((token) => token.kind === kind)
  }

  /**
   * Add a new token
   */
  addToken(token: Token): void {
    if (!this.document) return

    const updatedDocument = {
      ...this.document,
      updatedAt: new Date().toISOString(),
      tokens: {
        ...this.document.tokens,
        [token.id]: token,
      },
    }

    canvasActions.setDocument(updatedDocument)
  }

  /**
   * Update an existing token
   */
  updateToken(tokenId: TokenId, updates: Partial<Token>): void {
    if (!this.document) return

    const token = this.document.tokens?.[tokenId]
    if (!token) return

    const updatedDocument = {
      ...this.document,
      updatedAt: new Date().toISOString(),
      tokens: {
        ...this.document.tokens,
        [tokenId]: {
          ...token,
          ...updates,
        },
      },
    }

    canvasActions.setDocument(updatedDocument)
  }

  /**
   * Delete a token
   */
  deleteToken(tokenId: TokenId): void {
    if (!this.document) return

    const tokens = { ...this.document.tokens }
    delete tokens[tokenId]

    const updatedDocument = {
      ...this.document,
      updatedAt: new Date().toISOString(),
      tokens,
    }

    canvasActions.setDocument(updatedDocument)
  }

  /**
   * Create a color token
   */
  createColorToken(name: string, hex: string, id?: TokenId): ColorToken {
    return {
      id: (id || `token-${Date.now()}`) as TokenId,
      kind: 'color',
      name,
      value: {
        format: 'hex',
        hex,
      },
    }
  }

  /**
   * Create a typography token
   */
  createTypographyToken(
    name: string,
    value: {
      fontFamily: string
      fontWeight: number
      fontSize: number
      lineHeight: number
      letterSpacing?: number
    },
    id?: TokenId
  ): TypographyToken {
    return {
      id: (id || `token-${Date.now()}`) as TokenId,
      kind: 'typography',
      name,
      value,
    }
  }

  /**
   * Create a spacing token
   */
  createSpacingToken(name: string, px: number, id?: TokenId): SpacingToken {
    return {
      id: (id || `token-${Date.now()}`) as TokenId,
      kind: 'spacing',
      name,
      value: { px },
    }
  }

  /**
   * Resolve token reference to actual value
   */
  resolveTokenRef(tokenRef: { tokenId: TokenId }): any {
    const token = this.getToken(tokenRef.tokenId)
    if (!token) return null

    switch (token.kind) {
      case 'color':
        return token.value.hex
      case 'typography':
        return token.value
      case 'spacing':
        return token.value.px
      default:
        return null
    }
  }

  /**
   * Get all color tokens
   */
  getColorTokens(): ColorToken[] {
    return this.getTokensByKind('color') as ColorToken[]
  }

  /**
   * Get all typography tokens
   */
  getTypographyTokens(): TypographyToken[] {
    return this.getTokensByKind('typography') as TypographyToken[]
  }

  /**
   * Get all spacing tokens
   */
  getSpacingTokens(): SpacingToken[] {
    return this.getTokensByKind('spacing') as SpacingToken[]
  }
}

// Singleton instance
let variableManagerInstance: VariableManager | null = null

export function getVariableManager(): VariableManager {
  if (!variableManagerInstance) {
    variableManagerInstance = new VariableManager()
  }
  return variableManagerInstance
}
