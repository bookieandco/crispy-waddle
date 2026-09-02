import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LPPositionEvent, LPPositionEventKind } from './lp-position-ledger'

const TOKEN_PROGRAMS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEFhdkAS6EPFLC1PHnBqCXEpPxuEb',
])

type Balance = {
  accountIndex: number
  mint: string
  owner?: string
  amountRaw: bigint
}

type ParsedInstruction = {
  program?: unknown
  programId?: unknown
  parsed?: unknown
  accounts?: unknown
  data?: unknown
  programIdIndex?: unknown
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function parseAmount(value: unknown): bigint | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  return undefined
}

function balances(raw: Record<string, unknown>, key: 'preTokenBalances' | 'postTokenBalances', lpMint: string): Balance[] {
  const meta = object(raw.meta)
  const rows = Array.isArray(meta?.[key]) ? meta[key] as unknown[] : []
  const result: Balance[] = []
  for (const value of rows) {
    const row = object(value)
    if (!row || row.mint !== lpMint || typeof row.accountIndex !== 'number') continue
    const tokenAmount = object(row.uiTokenAmount)
    const amountRaw = parseAmount(tokenAmount?.amount ?? row.amount)
    if (amountRaw === undefined) continue
    result.push({ accountIndex: row.accountIndex, mint: lpMint, owner: typeof row.owner === 'string' ? row.owner : undefined, amountRaw })
  }
  return result
}

function accountKey(raw: Record<string, unknown>, index: number): string | undefined {
  const tx = object(raw.transaction) ?? raw
  const message = object(tx.message)
  const keys = message?.accountKeys ?? tx.accountKeys ?? raw.accountKeys
  if (!Array.isArray(keys)) return undefined
  const key = keys[index]
  if (typeof key === 'string') return key
  const parsed = object(key)
  return typeof parsed?.pubkey === 'string' ? parsed.pubkey : undefined
}

function evidenceId(transaction: HistoricalPoolTransaction, suffix: string): string {
  return `${transaction.evidenceId}:${suffix}`
}

function parsedTokenOperations(raw: Record<string, unknown>, lpMint: string): Array<{ kind: LPPositionEventKind; from?: number; to?: number; account?: number; amountRaw?: bigint; evidence: string }> {
  const meta = object(raw.meta)
  const groups = Array.isArray(meta?.innerInstructions) ? meta.innerInstructions as unknown[] : []
  const result: Array<{ kind: LPPositionEventKind; from?: number; to?: number; account?: number; amountRaw?: bigint; evidence: string }> = []

  for (const group of groups) {
    const g = object(group)
    const instructions = Array.isArray(g?.instructions) ? g.instructions as unknown[] : []
    instructions.forEach((value, index) => {
      const ix = object(value) as ParsedInstruction | undefined
      if (!ix) return
      const program = typeof ix.program === 'string' ? ix.program : undefined
      const parsed = object(ix.parsed)
      const type = typeof parsed?.type === 'string' ? parsed.type : undefined
      if (program !== 'spl-token' && program !== 'spl-token-2022') return
      if (!type) return
      const info = object(parsed?.info)
      if (!info) return
      const mint = typeof info.mint === 'string' ? info.mint : undefined
      if (mint && mint !== lpMint) return
      const amountRaw = parseAmount(info.amount ?? info.tokenAmount?.amount)
      const evidence = `inner:${String(g?.index ?? 'unknown')}:${index}`
      if (type === 'mintTo' || type === 'mintToChecked') {
        const account = typeof info.account === 'string' ? info.account : undefined
        if (account) result.push({ kind: 'MINT', amountRaw, evidence, to: undefined })
      } else if (type === 'burn' || type === 'burnChecked') {
        const account = typeof info.account === 'string' ? info.account : undefined
        if (account) result.push({ kind: 'BURN', amountRaw, evidence })
      } else if (type === 'transfer' || type === 'transferChecked') {
        const source = typeof info.source === 'string' ? info.source : undefined
        const destination = typeof info.destination === 'string' ? info.destination : undefined
        if (source && destination) result.push({ kind: 'TRANSFER', amountRaw, evidence })
      }
    })
  }
  return result
}

function confidence(kind: LPPositionEventKind, corroborated: boolean): number {
  if (kind === 'UNKNOWN') return 0.35
  return corroborated ? 1 : 0.7
}

/**
 * Reconciles LP-token pre/post balances and corroborating SPL Token CPI
 * instructions into conservative point-in-time position events.
 *
 * A balance delta alone never proves mint/burn/transfer semantics.
 */
export class SolanaLPStateMachine {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool'], lpMint: string): LPPositionEvent[] {
    const raw = object(transaction.raw)
    if (!raw) return []
    const pre = balances(raw, 'preTokenBalances', lpMint)
    const post = balances(raw, 'postTokenBalances', lpMint)
    const byIndex = new Map<number, { pre?: Balance; post?: Balance }>()
    for (const row of pre) byIndex.set(row.accountIndex, { ...(byIndex.get(row.accountIndex) ?? {}), pre: row })
    for (const row of post) byIndex.set(row.accountIndex, { ...(byIndex.get(row.accountIndex) ?? {}), post: row })

    const operations = parsedTokenOperations(raw, lpMint)
    const events: LPPositionEvent[] = []

    for (const [index, state] of byIndex) {
      const before = state.pre?.amountRaw ?? 0n
      const after = state.post?.amountRaw ?? 0n
      if (before === after) continue
      const address = accountKey(raw, index)
      if (!address) continue

      let kind: LPPositionEventKind = 'UNKNOWN'
      let amountRaw = before > after ? before - after : after - before
      let from: string | undefined
      let to: string | undefined
      let corroborated = false

      if (after > before) {
        const op = operations.find(item => item.kind === 'MINT')
        if (op) {
          kind = 'MINT'
          corroborated = true
        } else {
          const transfer = operations.find(item => item.kind === 'TRANSFER')
          if (transfer) {
            kind = 'TRANSFER'
            corroborated = true
          }
        }
        to = state.post?.owner
      } else {
        const burn = operations.find(item => item.kind === 'BURN')
        if (burn) {
          kind = 'BURN'
          corroborated = true
        } else {
          const transfer = operations.find(item => item.kind === 'TRANSFER')
          if (transfer) {
            kind = 'TRANSFER'
            corroborated = true
          }
        }
        from = state.pre?.owner
      }

      const evidenceIds = [transaction.evidenceId, evidenceId(transaction, `lp:${index}`), ...operations.filter(op => op.kind === kind).map(op => evidenceId(transaction, op.evidence))]
      events.push({
        eventId: `${transaction.signature}:lp-state:${lpMint}:${index}:${kind}`,
        observedAt: transaction.observedAt,
        poolAddress: pool.poolAddress,
        lpMint,
        kind,
        from,
        to,
        amountRaw,
        source: 'solana-token-balance-reconciliation',
        evidenceIds: [...new Set(evidenceIds)],
        confidence: confidence(kind, corroborated),
      })
    }

    return events
  }
}

export function buildLPStateMachineEvents(input: { history: PoolHistory; lpMint: string }): LPPositionEvent[] {
  const decoder = new SolanaLPStateMachine()
  return input.history.transactions.flatMap(tx => decoder.decode(tx, input.history.pool, input.lpMint)).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}
