import { nanoid } from 'nanoid'

export type TransactionId = string & { __brand: 'TransactionId' }

export type ToolContext = {
  activeDocumentId?: string | null
}

export interface TransactionManager {
  begin(name: string, ctx: ToolContext): Promise<TransactionId>
  commit(txId: TransactionId, ctx: ToolContext): Promise<void>
  rollback(txId: TransactionId, ctx: ToolContext): Promise<void>
  inTransaction<T>(name: string, ctx: ToolContext, fn: () => Promise<T>): Promise<T>
}

type TransactionRecord = { name: string; commands: any[] }

export class SimpleTransactionManager implements TransactionManager {
  private transactions: Map<TransactionId, TransactionRecord> = new Map()

  hasTransaction(txId: TransactionId): boolean {
    return this.transactions.has(txId)
  }

  async begin(name: string, _ctx: ToolContext): Promise<TransactionId> {
    const txId = nanoid() as TransactionId
    this.transactions.set(txId, { name, commands: [] })
    return txId
  }

  async commit(txId: TransactionId, _ctx: ToolContext): Promise<void> {
    this.transactions.delete(txId)
  }

  async rollback(txId: TransactionId, _ctx: ToolContext): Promise<void> {
    this.transactions.delete(txId)
  }

  async inTransaction<T>(name: string, ctx: ToolContext, fn: () => Promise<T>): Promise<T> {
    const txId = await this.begin(name, ctx)
    try {
      const result = await fn()
      await this.commit(txId, ctx)
      return result
    } catch (error) {
      await this.rollback(txId, ctx)
      throw error
    }
  }
}
