export type RoyaltyLedgerStatus = "REPORTED" | "RECONCILED" | "NEEDS_MATCHING" | "CONFIRMED"

export type RoyaltyLedgerEntry = {
  id: string
  statementId: string
  periodStart: string
  periodEnd: string
  source: string
  releaseId?: string
  isrc?: string
  streams: number
  grossAmount: number
  currency: string
  status: RoyaltyLedgerStatus
}

export type RightsSplit = { party: string; percentage: number; role: "master" | "writer" | "publisher" }

export function validateRightsSplits(splits: RightsSplit[]) {
  const grouped = new Map<RightsSplit["role"], number>()
  for (const split of splits) grouped.set(split.role, (grouped.get(split.role) || 0) + split.percentage)
  for (const role of ["master", "writer", "publisher"] as const) {
    const total = grouped.get(role) || 0
    if (total !== 100) throw new Error(`${role} rights split must total 100%; received ${total}%`)
  }
  if (splits.some((split) => split.percentage < 0 || split.percentage > 100)) throw new Error("Rights split percentages must be between 0 and 100")
  return true
}

export function summarizeRoyalties(entries: readonly RoyaltyLedgerEntry[]) {
  const byCurrency = new Map<string, number>()
  for (const entry of entries) byCurrency.set(entry.currency, (byCurrency.get(entry.currency) || 0) + entry.grossAmount)
  return { streams: entries.reduce((sum, entry) => sum + entry.streams, 0), byCurrency: Object.fromEntries(byCurrency), entries: entries.length }
}

export function confirmRoyaltyEntry(entry: RoyaltyLedgerEntry): RoyaltyLedgerEntry {
  if (entry.status !== "RECONCILED") throw new Error("Only reconciled royalties can be confirmed")
  return { ...entry, status: "CONFIRMED" }
}
