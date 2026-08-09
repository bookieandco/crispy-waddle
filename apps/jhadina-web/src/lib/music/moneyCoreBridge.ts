export type ConfirmedMusicIncome = {
  royaltyEntryId: string
  statementId: string
  source: string
  amount: number
  currency: string
  receivedAt?: string
  releaseId?: string
  isrc?: string
}

export type MoneyCoreTransaction = {
  id: string
  type: "MUSIC_ROYALTY_INCOME"
  source: "JHADINA_MUSIC"
  amount: number
  currency: string
  status: "CONFIRMED"
  externalReference: string
  metadata: Record<string, string | number | undefined>
  createdAt: string
}

/** Converts only confirmed/reconciled music income into a Money Core transaction. */
export function toMoneyCoreTransaction(income: ConfirmedMusicIncome): MoneyCoreTransaction {
  if (!Number.isFinite(income.amount) || income.amount <= 0) throw new Error("Confirmed royalty amount must be greater than zero")
  return {
    id: `money_music_${income.royaltyEntryId}`,
    type: "MUSIC_ROYALTY_INCOME",
    source: "JHADINA_MUSIC",
    amount: income.amount,
    currency: income.currency,
    status: "CONFIRMED",
    externalReference: income.statementId,
    metadata: { royaltyEntryId: income.royaltyEntryId, releaseId: income.releaseId, isrc: income.isrc, platform: income.source, receivedAt: income.receivedAt },
    createdAt: new Date().toISOString(),
  }
}

export function allocateConfirmedIncome(amount: number, rates = { tax: 0.25, survival: 0.25, growth: 0.2, owner: 0.2, freedom: 0.1 }) {
  if (amount < 0) throw new Error("Income cannot be negative")
  const total = Object.values(rates).reduce((a, b) => a + b, 0)
  if (Math.abs(total - 1) > 0.000001) throw new Error("Allocation rates must total 100%")
  return Object.fromEntries(Object.entries(rates).map(([bucket, rate]) => [bucket, amount * rate]))
}
