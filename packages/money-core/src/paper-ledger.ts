import { createHash } from 'node:crypto'
import type { PaperExecutionOutcome, PaperFill, PaperOrder, PaperPortfolio } from './paper-execution-contracts.js'

export type PaperLedgerEventKind = 'ORDER' | 'FILL' | 'PORTFOLIO_SNAPSHOT' | 'OUTCOME'
export type PaperLedgerPayload = PaperOrder | PaperFill | PaperPortfolio | PaperExecutionOutcome

export type PaperLedgerEvent = Readonly<{
  eventId: string
  paperRunId: string
  kind: PaperLedgerEventKind
  occurredAt: string
  payload: PaperLedgerPayload
  payloadHash: string
  evidenceIds: readonly string[]
  authority: 'SIMULATION_RECORD_ONLY'
}>

export type PaperLedgerAppendResult = Readonly<{
  disposition: 'INSERTED' | 'REPLAY'
  event: PaperLedgerEvent
}>

export interface PaperLedgerStore {
  append(event: PaperLedgerEvent): Promise<PaperLedgerAppendResult> | PaperLedgerAppendResult
  get(eventId: string): Promise<PaperLedgerEvent | undefined> | PaperLedgerEvent | undefined
  list(paperRunId: string): Promise<readonly PaperLedgerEvent[]> | readonly PaperLedgerEvent[]
}

type TaggedBigInt = Readonly<{ $moneyBigInt: string }>

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return Object.freeze({ $moneyBigInt: value.toString() } satisfies TaggedBigInt)
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

export function encodePaperLedgerPayload(value: PaperLedgerPayload): string {
  return JSON.stringify(canonicalize(value))
}

export function decodePaperLedgerPayload(value: unknown): PaperLedgerPayload {
  function revive(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(revive)
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>
      if (
        Object.keys(row).length === 1 &&
        typeof row.$moneyBigInt === 'string' &&
        /^-?\d+$/.test(row.$moneyBigInt)
      ) return BigInt(row.$moneyBigInt)
      return Object.fromEntries(Object.entries(row).map(([key, child]) => [key, revive(child)]))
    }
    return item
  }
  return revive(value) as PaperLedgerPayload
}

export function hashPaperLedgerPayload(payload: PaperLedgerPayload): string {
  return createHash('sha256').update(encodePaperLedgerPayload(payload)).digest('hex')
}

function assertIso(value: string, code: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code)
}

function assertPayloadAuthority(kind: PaperLedgerEventKind, payload: PaperLedgerPayload): void {
  const authority = (payload as { authority?: string }).authority
  if (kind === 'OUTCOME') {
    if (authority !== 'LEARNING_ONLY') throw new Error('MONEY_043_LEDGER_OUTCOME_AUTHORITY_INVALID')
  } else if (authority !== 'SIMULATION_ONLY') {
    throw new Error('MONEY_043_LEDGER_SIMULATION_AUTHORITY_INVALID')
  }
}

function payloadRunId(payload: PaperLedgerPayload): string | undefined {
  if ('paperRunId' in payload && typeof payload.paperRunId === 'string') return payload.paperRunId
  return undefined
}

function payloadOccurrence(kind: PaperLedgerEventKind, payload: PaperLedgerPayload): string | undefined {
  if (kind === 'ORDER' && 'submittedAt' in payload) return payload.submittedAt
  if (kind === 'FILL' && 'filledAt' in payload) return payload.filledAt
  if (kind === 'PORTFOLIO_SNAPSHOT' && 'asOf' in payload) return payload.asOf
  if (kind === 'OUTCOME' && 'createdAt' in payload) return payload.createdAt
  return undefined
}

export function createPaperLedgerEvent(input: {
  paperRunId: string
  kind: PaperLedgerEventKind
  payload: PaperLedgerPayload
  evidenceIds?: readonly string[]
}): PaperLedgerEvent {
  if (!input.paperRunId.trim()) throw new Error('MONEY_043_LEDGER_RUN_ID_REQUIRED')
  assertPayloadAuthority(input.kind, input.payload)
  const embeddedRunId = payloadRunId(input.payload)
  if (!embeddedRunId || embeddedRunId !== input.paperRunId) throw new Error('MONEY_043_LEDGER_RUN_BINDING_MISMATCH')
  const occurredAt = payloadOccurrence(input.kind, input.payload)
  if (!occurredAt) throw new Error('MONEY_043_LEDGER_OCCURRED_AT_REQUIRED')
  assertIso(occurredAt, 'MONEY_043_LEDGER_OCCURRED_AT_INVALID')
  const payloadHash = hashPaperLedgerPayload(input.payload)
  const evidenceIds = Object.freeze([...(new Set(input.evidenceIds ?? ('evidenceIds' in input.payload ? input.payload.evidenceIds : [])))].sort())
  const eventId = `paper-ledger:${input.paperRunId}:${input.kind.toLowerCase()}:${payloadHash}`
  return Object.freeze({
    eventId,
    paperRunId: input.paperRunId,
    kind: input.kind,
    occurredAt,
    payload: input.payload,
    payloadHash,
    evidenceIds,
    authority: 'SIMULATION_RECORD_ONLY',
  })
}

export function assertPaperLedgerEvent(event: PaperLedgerEvent): void {
  if (event.authority !== 'SIMULATION_RECORD_ONLY') throw new Error('MONEY_043_LEDGER_AUTHORITY_INVALID')
  if (!event.eventId || !event.paperRunId || !event.payloadHash) throw new Error('MONEY_043_LEDGER_IDENTITY_REQUIRED')
  assertIso(event.occurredAt, 'MONEY_043_LEDGER_OCCURRED_AT_INVALID')
  assertPayloadAuthority(event.kind, event.payload)
  if (payloadRunId(event.payload) !== event.paperRunId) throw new Error('MONEY_043_LEDGER_RUN_BINDING_MISMATCH')
  if (payloadOccurrence(event.kind, event.payload) !== event.occurredAt) throw new Error('MONEY_043_LEDGER_TIME_BINDING_MISMATCH')
  if (hashPaperLedgerPayload(event.payload) !== event.payloadHash) throw new Error('MONEY_043_LEDGER_PAYLOAD_HASH_MISMATCH')
}

export class InMemoryPaperLedgerStore implements PaperLedgerStore {
  private readonly rows = new Map<string, PaperLedgerEvent>()

  append(event: PaperLedgerEvent): PaperLedgerAppendResult {
    assertPaperLedgerEvent(event)
    const prior = this.rows.get(event.eventId)
    if (prior) {
      if (prior.payloadHash !== event.payloadHash || encodePaperLedgerPayload(prior.payload) !== encodePaperLedgerPayload(event.payload)) {
        throw new Error('MONEY_043_LEDGER_EVENT_CONFLICT')
      }
      return Object.freeze({ disposition: 'REPLAY', event: prior })
    }
    this.rows.set(event.eventId, event)
    return Object.freeze({ disposition: 'INSERTED', event })
  }

  get(eventId: string): PaperLedgerEvent | undefined {
    return this.rows.get(eventId)
  }

  list(paperRunId: string): readonly PaperLedgerEvent[] {
    return Object.freeze(
      [...this.rows.values()]
        .filter((event) => event.paperRunId === paperRunId)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId)),
    )
  }
}
