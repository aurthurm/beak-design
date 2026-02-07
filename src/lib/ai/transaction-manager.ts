import type {
  TransactionManager,
  TransactionId,
  ToolContext,
} from '../mcp-tools'
import { idGenerator } from '../db/id-generator'

/**
 * Simple Transaction Manager
 * Groups commands into transactions for undo/redo
 */
export class SimpleTransactionManager implements TransactionManager {
  private transactions: Map<TransactionId, { name: string; commands: any[] }> = new Map()

  async begin(name: string, ctx: ToolContext): Promise<TransactionId> {
    const txId = idGenerator.tx() as TransactionId
    this.transactions.set(txId, { name, commands: [] })
    return txId
  }

  async commit(txId: TransactionId, ctx: ToolContext): Promise<void> {
    // For now, transactions are just markers
    // In future, could batch commands for undo/redo
    this.transactions.delete(txId)
  }

  async rollback(txId: TransactionId, ctx: ToolContext): Promise<void> {
    // For now, just remove the transaction
    // In future, could undo commands
    this.transactions.delete(txId)
  }

  async inTransaction<T>(
    name: string,
    ctx: ToolContext,
    fn: () => Promise<T>
  ): Promise<T> {
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
