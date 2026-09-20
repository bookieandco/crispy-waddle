import type { AuthorizedCommunicationDispatch } from './communication-action.js'

export type StoreForwardItem = Readonly<{
  itemId: string
  dispatch: AuthorizedCommunicationDispatch
  enqueuedAt: string
}>

export interface StoreForwardQueue {
  enqueue(item: StoreForwardItem): Promise<'enqueued' | 'duplicate'>
  pending(): Promise<readonly StoreForwardItem[]>
  markReconciled(itemId: string): Promise<void>
}

export class InMemoryStoreForwardQueue implements StoreForwardQueue {
  private readonly items = new Map<string, StoreForwardItem>()
  private readonly reconciled = new Set<string>()

  async enqueue(item: StoreForwardItem): Promise<'enqueued' | 'duplicate'> {
    if (!item.itemId.trim() || !item.dispatch.correlationId.trim()) throw new Error('STORE_FORWARD_LINEAGE_REQUIRED')
    if (item.dispatch.correlationId !== item.dispatch.intent.correlationId) throw new Error('STORE_FORWARD_LINEAGE_MISMATCH')
    if (this.items.has(item.itemId) || this.reconciled.has(item.itemId)) return 'duplicate'
    this.items.set(item.itemId, Object.freeze({ ...item }))
    return 'enqueued'
  }

  async pending(): Promise<readonly StoreForwardItem[]> {
    return [...this.items.values()]
  }

  async markReconciled(itemId: string): Promise<void> {
    if (!this.items.has(itemId)) return
    this.items.delete(itemId)
    this.reconciled.add(itemId)
  }
}

export async function reconcileStoreForward(input: {
  queue: StoreForwardQueue
  forward: (dispatch: AuthorizedCommunicationDispatch) => Promise<void>
}): Promise<Readonly<{ forwarded: readonly string[]; failed: readonly string[] }>> {
  const forwarded: string[] = [], failed: string[] = []
  for (const item of await input.queue.pending()) {
    try {
      await input.forward(item.dispatch)
      await input.queue.markReconciled(item.itemId)
      forwarded.push(item.itemId)
    } catch {
      failed.push(item.itemId)
    }
  }
  return Object.freeze({ forwarded: Object.freeze(forwarded), failed: Object.freeze(failed) })
}
