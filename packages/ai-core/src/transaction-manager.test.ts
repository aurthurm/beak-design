import { describe, expect, it } from 'vitest'

import { SimpleTransactionManager } from './transaction-manager'

describe('ai-core transaction manager', () => {
  it('tracks transaction lifecycle', async () => {
    const manager = new SimpleTransactionManager()
    const txId = await manager.begin('create-doc', {})

    expect(manager.hasTransaction(txId)).toBe(true)

    await manager.commit(txId, {})
    expect(manager.hasTransaction(txId)).toBe(false)
  })

  it('rolls back failed transactions', async () => {
    const manager = new SimpleTransactionManager()

    await expect(
      manager.inTransaction('failing-op', {}, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
  })

  it('returns the result of successful transactions', async () => {
    const manager = new SimpleTransactionManager()

    await expect(
      manager.inTransaction('successful-op', {}, async () => {
        return { ok: true }
      })
    ).resolves.toEqual({ ok: true })
  })
})
