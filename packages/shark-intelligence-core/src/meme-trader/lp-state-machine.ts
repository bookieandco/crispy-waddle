import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LPPositionEvent, LPPositionEventKind } from './lp-position-ledger'

type Balance = { accountIndex: number; mint: string; owner?: string; amountRaw: bigint }
type ParsedInstruction = { program?: unknown; programId?: unknown; parsed?: unknown; accounts?: unknown; data?: unknown; programIdIndex?: unknown }
type TokenOperation = { kind: LPPositionEventKind; source?: string; destination?: string; account?: string; amountRaw?: bigint; evidence: string }
function object(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' ? value as Record<string, unknown> : undefined }
function parseAmount(value: unknown): bigint | undefined { if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value); if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value); return undefined }
function accountKeys(raw: Record<string, unknown>): string[] { const tx = object(raw.transaction) ?? raw; const message = object(tx.message); const staticKeys = Array.isArray(message?.accountKeys) ? message.accountKeys : Array.isArray(tx.accountKeys) ? tx.accountKeys : []; const keys = staticKeys.map(key => typeof key === 'string' ? key : (object(key)?.pubkey as string | undefined)).filter((key): key is string => typeof key === 'string'); const meta = object(raw.meta); const loaded = object(meta?.loadedAddresses); const writable = Array.isArray(loaded?.writable) ? loaded.writable.filter((v): v is string => typeof v === 'string') : []; const readonly = Array.isArray(loaded?.readonly) ? loaded.readonly.filter((v): v is string => typeof v === 'string') : []; return [...keys, ...writable, ...readonly] }
function evidenceId(transaction: HistoricalPoolTransaction, suffix: string): string { return `${transaction.evidenceId}:${suffix}` }
function balances(raw: Record<string, unknown>, key: 'preTokenBalances' | 'postTokenBalances', lpMint: string): Balance[] { const meta = object(raw.meta); const rows = Array.isArray(meta?.[key]) ? meta[key] as unknown[] : []; return rows.flatMap(value => { const row = object(value); if (!row || row.mint !== lpMint || typeof row.accountIndex !== 'number') return []; const tokenAmount = object(row.uiTokenAmount); const amountRaw = parseAmount(tokenAmount?.amount ?? row.amount); return amountRaw === undefined ? [] : [{ accountIndex: row.accountIndex, mint: lpMint, owner: typeof row.owner === 'string' ? row.owner : undefined, amountRaw }] }) }
function parsedTokenOperations(raw: Record<string, unknown>, lpMint: string): TokenOperation[] { const meta = object(raw.meta); const groups = Array.isArray(meta?.innerInstructions) ? meta.innerInstructions as unknown[] : []; const result: TokenOperation[] = []; for (const group of groups) { const g = object(group); const instructions = Array.isArray(g?.instructions) ? g.instructions as unknown[] : []; instructions.forEach((value, index) => { const ix = object(value) as ParsedInstruction | undefined; const parsed = object(ix?.parsed); const info = object(parsed?.info); const program = typeof ix?.program === 'string' ? ix.program : undefined; const type = typeof parsed?.type === 'string' ? parsed.type : undefined; if (!info || (program !== 'spl-token' && program !== 'spl-token-2022') || !type) return; const mint = typeof info.mint === 'string' ? info.mint : undefined; if (mint !== lpMint) return; const amountRaw = parseAmount(info.amount ?? object(info.tokenAmount)?.amount); const evidence = `inner:${String(g?.index ?? 'unknown')}:${index}`; if (type === 'mintTo' || type === 'mintToChecked') result.push({ kind: 'MINT', account: typeof info.account === 'string' ? info.account : undefined, amountRaw, evidence }); else if (type === 'burn' || type === 'burnChecked') result.push({ kind: 'BURN', account: typeof info.account === 'string' ? info.account : undefined, amountRaw, evidence }); else if (type === 'transfer' || type === 'transferChecked') result.push({ kind: 'TRANSFER', source: typeof info.source === 'string' ? info.source : undefined, destination: typeof info.destination === 'string' ? info.destination : undefined, amountRaw, evidence }) }) } return result }
function confidence(kind: LPPositionEventKind, corroborated: boolean): number { return kind === 'UNKNOWN' ? 0.35 : corroborated ? 1 : 0.7 }

/** Conservative LP-token state reconstruction. Balance deltas never prove semantics without corroborating evidence. */
export class SolanaLPStateMachine {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool'], lpMint: string): LPPositionEvent[] {
    const raw = object(transaction.raw); if (!raw) return []
    const pre = balances(raw, 'preTokenBalances', lpMint), post = balances(raw, 'postTokenBalances', lpMint)
    const byIndex = new Map<number, { pre?: Balance; post?: Balance }>()
    for (const row of pre) byIndex.set(row.accountIndex, { ...(byIndex.get(row.accountIndex) ?? {}), pre: row })
    for (const row of post) byIndex.set(row.accountIndex, { ...(byIndex.get(row.accountIndex) ?? {}), post: row })
    const keys = accountKeys(raw), operations = parsedTokenOperations(raw, lpMint), events: LPPositionEvent[] = []
    for (const [index, state] of byIndex) {
      const address = keys[index]; if (!address) continue
      const before = state.pre?.amountRaw ?? 0n, after = state.post?.amountRaw ?? 0n; if (before === after) continue
      const delta = before > after ? before - after : after - before
      const matching = operations.filter(op => op.account === address || op.source === address || op.destination === address)
      let kind: LPPositionEventKind = 'UNKNOWN', corroborated = false
      if (after > before) { const mint = matching.find(op => op.kind === 'MINT'); const transfer = matching.find(op => op.kind === 'TRANSFER' && op.destination === address); if (mint && mint.amountRaw === delta) { kind = 'MINT'; corroborated = true } else if (transfer && transfer.amountRaw === delta) { kind = 'TRANSFER'; corroborated = true } }
      else { const burn = matching.find(op => op.kind === 'BURN'); const transfer = matching.find(op => op.kind === 'TRANSFER' && op.source === address); if (burn && burn.amountRaw === delta) { kind = 'BURN'; corroborated = true } else if (transfer && transfer.amountRaw === delta) { kind = 'TRANSFER'; corroborated = true } }
      const matchingEvidence = matching.filter(op => op.kind === kind).map(op => evidenceId(transaction, op.evidence))
      events.push({ eventId: `${transaction.signature}:lp-state:${lpMint}:${index}:${kind}`, observedAt: transaction.observedAt, signature: transaction.signature, poolAddress: pool.poolAddress, lpMint, tokenAccount: address, kind, from: before > after ? state.pre?.owner : undefined, to: after > before ? state.post?.owner : undefined, amountRaw: delta, source: 'solana-token-balance-reconciliation', evidenceIds: [...new Set([transaction.evidenceId, evidenceId(transaction, `lp:${index}`), ...matchingEvidence])], confidence: confidence(kind, corroborated) })
    }
    return events
  }
}
export function buildLPStateMachineEvents(input: { history: PoolHistory; lpMint: string }): LPPositionEvent[] { return input.history.transactions.flatMap(tx => new SolanaLPStateMachine().decode(tx, input.history.pool, input.lpMint)).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)) }
