export type RoyaltyType = "master" | "publishing" | "performance" | "mechanical" | "neighboring_rights" | "youtube"
export type RoyaltyStatus = "ESTIMATED" | "REPORTED" | "RECONCILED" | "PAYABLE" | "PAID"

export type RoyaltyEntry = {
  id: string
  releaseId: string
  platform: string
  territory?: string
  period: string
  royaltyType: RoyaltyType
  isrc?: string
  streams?: number
  grossAmount: number
  currency: string
  status: RoyaltyStatus
  sourceStatementId?: string
  importedAt: string
}

export type RightsSplit = { party: string; percentage: number; role: "master" | "writer" | "publisher" }

export function validateRightsSplits(splits: RightsSplit[]) {
  const grouped = new Map<RightsSplit["role"], number>()
  for (const split of splits) grouped.set(split.role, (grouped.get(split.role) || 0) + split.percentage)
  for (const role of ["master", "writer", "publisher"] as const) {
    const total = grouped.get(role) || 0
    if (total !== 100) throw new Error(`${role} rights split must total 100%; received ${total}%`)
  }
  if (splits.some(s => s.percentage < 0 || s.percentage > 100)) throw new Error("Rights split percentages must be between 0 and 100")
  return true
}

export function summarizeRoyalties(entries: RoyaltyEntry[]) {
  const byCurrency = new Map<string, number>()
  for (const entry of entries) byCurrency.set(entry.currency, (byCurrency.get(entry.currency) || 0) + entry.grossAmount)
  const streams = entries.reduce((sum, e) => sum + (e.streams || 0), 0)
  return { streams, byCurrency: Object.fromEntries(byCurrency), entries: entries.length }
}

export function createRoyaltyEntry(input: Omit<RoyaltyEntry, "id" | "importedAt">): RoyaltyEntry {
  if (!input.releaseId || !input.platform || !input.period) throw new Error("releaseId, platform and period are required")
  if (input.grossAmount < 0) throw new Error("grossAmount cannot be negative")
  return { ...input, id: `royalty_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, importedAt: new Date().toISOString() }
}
