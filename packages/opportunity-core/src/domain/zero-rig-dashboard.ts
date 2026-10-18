import type { OpportunityOutcome } from './outcome.js'
import type { ZeroRigPaperPilotEvaluation } from './zero-rig-paper-pilot.js'

/**
 * JH-ZERO-RIG.07 — strictly read-only dashboard projection.
 * Financial truth belongs exclusively to canonical Money Core. No exchange rates,
 * balance synthesis, payout claims, or conversion of paper forecasts to real receipts.
 */
export type ZeroRigPendingReward = { id: string; currency: string; amount: number | null; sourceRef: string }
export type ZeroRigDashboard = {
  mode: 'READ_ONLY'
  payoutsByCurrency: Array<{ currency: string; netRevenue: number; count: number }>
  verifiedPayoutCount: number
  excludedUnverifiedCount: number
  pendingRewardCount: number
  pendingRewardTotalUnpriced: true
  pilot: { plannedDays: number; observedDays: number; status: string; simulatedNetUsd: number | null } | null
  moneyCoreConnected: false
  walletConnected: false
  submissionEnabled: false
  claimEnabled: false
  transferEnabled: false
}
/** Only reconciled Money-Core outcomes with real transaction references qualify. */
export function projectZeroRigDashboard(input: {
  outcomes: readonly OpportunityOutcome[]
  pending: readonly ZeroRigPendingReward[]
  pilot?: ZeroRigPaperPilotEvaluation
}): ZeroRigDashboard {
  const totals = new Map<string, { currency: string; netRevenue: number; count: number }>()
  const seen = new Set<string>()
  let verified = 0, excluded = 0
  for (const row of input.outcomes) {
    const valid = row.opportunityId.startsWith('zero-rig:') &&
      row.sourceOwner === 'money_core' && row.result === 'won' &&
      Array.isArray(row.transactionRefs) && row.transactionRefs.some(x => x.trim().length > 0) &&
      Array.isArray(row.evidenceRefs) && row.evidenceRefs.some(x => x.trim().length > 0) &&
      Number.isFinite(row.netRevenue) && row.netRevenue >= 0 &&
      /^[A-Z0-9]{2,12}$/.test(row.currency) &&
      !seen.has(row.id)
    if (!valid) { excluded++; continue }
    seen.add(row.id)
    verified++
    const total = totals.get(row.currency) ?? { currency: row.currency, netRevenue: 0, count: 0 }
    total.netRevenue += row.netRevenue
    total.count++
    totals.set(row.currency, total)
  }
  return {
    mode: 'READ_ONLY', payoutsByCurrency: [...totals.values()].sort((a,b) => a.currency.localeCompare(b.currency)),
    verifiedPayoutCount: verified, excludedUnverifiedCount: excluded,
    pendingRewardCount: input.pending.length, pendingRewardTotalUnpriced: true,
    pilot: input.pilot ? {
      plannedDays: input.pilot.plannedDays, observedDays: input.pilot.observedDays,
      status: input.pilot.status, simulatedNetUsd: input.pilot.simulatedNetUsd,
    } : null,
    moneyCoreConnected: false, walletConnected: false, submissionEnabled: false,
    claimEnabled: false, transferEnabled: false,
  }
}
