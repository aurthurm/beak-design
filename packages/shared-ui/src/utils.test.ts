import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('shared-ui cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('px-2', 'px-4', false && 'hidden', ['text-sm', 'text-lg'])).toBe('px-4 text-lg')
  })

  it('ignores empty values', () => {
    expect(cn(undefined, null, '', 'flex')).toBe('flex')
  })
})
