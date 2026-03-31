import { describe, expect, it } from 'vitest'

import { idGenerator, generateId } from './id-generator'

describe('schema id generator', () => {
  it('generates ids for each document entity type', () => {
    expect(idGenerator.doc()).toEqual(expect.any(String))
    expect(idGenerator.page()).toEqual(expect.any(String))
    expect(idGenerator.frame()).toEqual(expect.any(String))
    expect(idGenerator.layer()).toEqual(expect.any(String))
    expect(idGenerator.component()).toEqual(expect.any(String))
    expect(idGenerator.token()).toEqual(expect.any(String))
    expect(idGenerator.tx()).toEqual(expect.any(String))
  })

  it('generates legacy ids', () => {
    expect(generateId('doc')).toEqual(expect.any(String))
  })
})
