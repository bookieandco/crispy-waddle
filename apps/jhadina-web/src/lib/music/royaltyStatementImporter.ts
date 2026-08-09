import type { RoyaltyLedgerEntry } from "./royaltyLedger"

export type RoyaltyStatementRow = {
  statementId: string
  periodStart: string
  periodEnd: string
  platform: string
  releaseId?: string
  isrc?: string
  streams?: number
  grossAmount: number
  currency: string
}

export function normalizeRoyaltyRows(rows: RoyaltyStatementRow[]): RoyaltyLedgerEntry[] {
  return rows.map(row => ({
    id: `royalty_${row.statementId}_${row.isrc || row.releaseId || Math.random().toString(36).slice(2, 8)}`,
    statementId: row.statementId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    source: row.platform,
    releaseId: row.releaseId,
    isrc: row.isrc,
    streams: row.streams || 0,
    grossAmount: row.grossAmount,
    currency: row.currency,
    status: "REPORTED",
  }))
}

export function reconcileRoyaltyRows(entries: RoyaltyLedgerEntry[]) {
  return entries.map(entry => ({
    ...entry,
    status: entry.releaseId || entry.isrc ? "RECONCILED" : "NEEDS_MATCHING",
  }))
}
