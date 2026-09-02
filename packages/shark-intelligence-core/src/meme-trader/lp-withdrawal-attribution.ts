import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LiquidityEventEvidence } from './liquidity-event-semantics'
import type { LPPositionEvent } from './lp-position-ledger'
import { SolanaLPStateMachine } from './lp-state-machine'

export type LPWithdrawalAttribution = {
  signature: string
  observedAt: string
  poolAddress: string
  lpMint?: string
  lpTokenAccount?: string
  lpAmountRaw?: bigint
  ownerBefore?: string
  ownerAfter?: string
  lpStateEventId?: string
  raydiumWithdrawalEventId?: string
  developerAssociation?: 'MATCHED' | 'NOT_MATCHED' | 'UNKNOWN'
  evidenceIds: string[]
  confidence: number
}

function sameTime(a: string, b: string): boolean {
  return Number.isFinite(Date.parse(a)) && Number.isFinite(Date.parse(b)) && Math.abs(Date.parse(a) - Date.parse(b)) <= 120_000
}

function correlatedLPEvent(event: LiquidityEventEvidence, lp: LPPositionEvent): boolean {
  if (lp.poolAddress !== event.poolAddress || lp.signature !== event.signature) return false
  if (!sameTime(lp.observedAt, event.observedAt)) return false
  if (lp.kind !== 'BURN' && lp.kind !== 'TRANSFER') return false

  // Once the withdrawal decoder has supplied an identity field, a candidate
  // must carry and match that same field. Never fill a known identity gap
  // from an unrelated LP event merely because signature/time happen to match.
  if (event.lpMint !== undefined && lp.lpMint !== event.lpMint) return false
  if (event.lpTokenAccount !== undefined && lp.tokenAccount !== event.lpTokenAccount) return false
  if (event.amountRaw !== undefined && lp.amountRaw !== event.amountRaw) return false
  return true
}

export function attributeLPWithdrawals(input: {
  history: PoolHistory
  liquidityEvents: LiquidityEventEvidence[]
  lpEvents?: LPPositionEvent[]
  lpMint?: string
  developerWalletIds?: string[]
}): LPWithdrawalAttribution[] {
  const lpEvents = input.lpEvents ?? (input.lpMint ? input.history.transactions.flatMap(tx => new SolanaLPStateMachine().decode(tx, input.history.pool, input.lpMint)) : [])
  const developerWallets = new Set(input.developerWalletIds ?? [])
  return input.liquidityEvents
    .filter(event => event.kind === 'LIQUIDITY_REMOVE')
    .map(event => {
      const candidates = lpEvents
        .filter(lp => correlatedLPEvent(event, lp))
        .sort((a, b) => Math.abs(Date.parse(a.observedAt) - Date.parse(event.observedAt)) - Math.abs(Date.parse(b.observedAt) - Date.parse(event.observedAt)))
      const lp = candidates[0]
      const ownerBefore = lp?.from
      const association: LPWithdrawalAttribution['developerAssociation'] = ownerBefore ? (developerWallets.size === 0 ? 'UNKNOWN' : developerWallets.has(ownerBefore) ? 'MATCHED' : 'NOT_MATCHED') : 'UNKNOWN'
      const evidenceIds = [...new Set([event.eventId, ...event.evidenceIds, ...(lp?.evidenceIds ?? [])])]
      return {
        signature: event.signature,
        observedAt: event.observedAt,
        poolAddress: event.poolAddress,
        lpMint: event.lpMint ?? lp?.lpMint,
        lpTokenAccount: event.lpTokenAccount ?? lp?.tokenAccount,
        lpAmountRaw: event.amountRaw ?? lp?.amountRaw,
        ownerBefore,
        ownerAfter: lp?.to,
        lpStateEventId: lp?.eventId,
        raydiumWithdrawalEventId: event.eventId,
        developerAssociation: association,
        evidenceIds,
        confidence: lp ? Math.min(event.confidence, lp.confidence) : Math.min(event.confidence, 0.35),
      }
    })
}

export function verifiedLPWithdrawals(attributions: LPWithdrawalAttribution[]): LPWithdrawalAttribution[] {
  return attributions.filter(item => Boolean(item.ownerBefore) && Boolean(item.lpStateEventId) && Boolean(item.lpTokenAccount) && item.confidence >= 0.7)
}

export type LPWithdrawalTransactionMatcher = (transaction: HistoricalPoolTransaction, attribution: LPWithdrawalAttribution) => boolean

export const sameSignatureWithdrawalMatcher: LPWithdrawalTransactionMatcher = (transaction, attribution) => transaction.signature === attribution.signature
