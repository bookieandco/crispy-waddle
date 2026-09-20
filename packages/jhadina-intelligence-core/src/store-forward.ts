import type { ActionLedger } from '@jhadina/action-core'
import type { AuthorizedCommunicationDispatch } from './communication-action.js'
import { assertCommunicationIntent } from './communication-contracts.js'

export type StoreForwardItem = Readonly<{
  itemId: string
  dispatch: AuthorizedCommunicationDispatch
  enqueuedAt: string
}>

export interface StoreForwardRepository {
  putIfAbsent(item: StoreForwardItem, idempotencyKey: string): Promise<'enqueued' | 'duplicate'>
  listPending(): Promise<readonly StoreForwardItem[]>
  markReconciled(itemId: string): Promise<void>
}

export interface StoreForwardQueue {
  enqueue(item: StoreForwardItem): Promise<'enqueued' | 'duplicate'>
  pending(): Promise<readonly StoreForwardItem[]>
  markReconciled(itemId: string): Promise<void>
}

function dispatchIdempotencyKey(dispatch: AuthorizedCommunicationDispatch): string {
  return `${dispatch.intent.intentId}:${dispatch.correlationId}`
}

export class InMemoryStoreForwardRepository implements StoreForwardRepository {
  private readonly items = new Map<string, StoreForwardItem>()
  private readonly idempotencyKeys = new Set<string>()
  private readonly reconciled = new Set<string>()

  async putIfAbsent(item: StoreForwardItem, idempotencyKey: string): Promise<'enqueued' | 'duplicate'> {
    if (this.items.has(item.itemId) || this.reconciled.has(item.itemId) || this.idempotencyKeys.has(idempotencyKey)) return 'duplicate'
    this.items.set(item.itemId, Object.freeze({ ...item }))
    this.idempotencyKeys.add(idempotencyKey)
    return 'enqueued'
  }

  async listPending(): Promise<readonly StoreForwardItem[]> { return [...this.items.values()] }

  async markReconciled(itemId: string): Promise<void> {
    if (!this.items.has(itemId)) return
    this.items.delete(itemId)
    this.reconciled.add(itemId)
  }
}

export class RepositoryStoreForwardQueue implements StoreForwardQueue {
  constructor(private readonly repository: StoreForwardRepository) {}

  async enqueue(item: StoreForwardItem): Promise<'enqueued' | 'duplicate'> {
    if (!item.itemId.trim() || !item.dispatch.correlationId.trim()) throw new Error('STORE_FORWARD_LINEAGE_REQUIRED')
    const intent = assertCommunicationIntent(item.dispatch.intent)
    if (item.dispatch.correlationId !== intent.correlationId) throw new Error('STORE_FORWARD_LINEAGE_MISMATCH')
    return this.repository.putIfAbsent(Object.freeze({ ...item, dispatch: Object.freeze({ ...item.dispatch, intent }) }), dispatchIdempotencyKey(item.dispatch))
  }

  async pending(): Promise<readonly StoreForwardItem[]> { return this.repository.listPending() }
  async markReconciled(itemId: string): Promise<void> { await this.repository.markReconciled(itemId) }
}

export class InMemoryStoreForwardQueue extends RepositoryStoreForwardQueue {
  constructor(repository = new InMemoryStoreForwardRepository()) { super(repository) }
}

async function appendReconciliationEvidence(input: {
  ledger?: ActionLedger
  item: StoreForwardItem
  status: 'forwarded' | 'failed'
}): Promise<void> {
  if (!input.ledger) return
  await input.ledger.append({
    id: `communication-store-forward:${input.item.itemId}:${input.status}`,
    actionId: input.item.dispatch.intent.intentId,
    userId: input.item.dispatch.intent.actorId,
    type: `communication.store-forward.${input.status}`,
    status: input.status === 'forwarded' ? 'completed' : 'failed',
    timestamp: input.item.enqueuedAt,
    metadata: {
      correlationId: input.item.dispatch.correlationId,
      itemId: input.item.itemId,
      reconciliationStatus: input.status,
      failureCode: input.status === 'failed' ? 'FORWARD_FAILED' : undefined,
    },
  })
}

export async function reconcileStoreForward(input: {
  queue: StoreForwardQueue
  forward: (dispatch: AuthorizedCommunicationDispatch) => Promise<void>
  ledger?: ActionLedger
}): Promise<Readonly<{ forwarded: readonly string[]; failed: readonly string[]; evidenceFailed: readonly string[] }>> {
  const forwarded: string[] = [], failed: string[] = [], evidenceFailed: string[] = []
  for (const item of await input.queue.pending()) {
    try {
      await input.forward(item.dispatch)
      await input.queue.markReconciled(item.itemId)
      forwarded.push(item.itemId)
      try { await appendReconciliationEvidence({ ledger: input.ledger, item, status: 'forwarded' }) } catch { evidenceFailed.push(item.itemId) }
    } catch {
      failed.push(item.itemId)
      try { await appendReconciliationEvidence({ ledger: input.ledger, item, status: 'failed' }) } catch { evidenceFailed.push(item.itemId) }
    }
  }
  return Object.freeze({
    forwarded: Object.freeze(forwarded),
    failed: Object.freeze(failed),
    evidenceFailed: Object.freeze(evidenceFailed),
  })
}
