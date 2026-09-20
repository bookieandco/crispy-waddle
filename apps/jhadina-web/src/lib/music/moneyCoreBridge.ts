import type { CanonicalFinancialAction } from "@jhadina/money-core"
import type { RoyaltyLedgerEntry } from "./royaltyLedger"

export type ConfirmedMusicIncome = { royaltyEntryId:string; statementId:string; source:string; amount:number; currency:string; receivedAt?:string; releaseId?:string; isrc?:string }

export type MusicIncomeObservation = Readonly<{
  id:string
  source:"JHADINA_MUSIC"
  kind:"MUSIC_ROYALTY_INCOME"
  amount:number
  currency:string
  externalReference:string
  evidence:Readonly<{ royaltyEntryId:string; platform:string; releaseId?:string; isrc?:string }>
}>

/**
 * Canonical Money boundary: music produces evidence/observations only.
 * It cannot manufacture a CanonicalFinancialAction or execution authority.
 */
export function toMoneyCoreIncomeObservation(entry: RoyaltyLedgerEntry): MusicIncomeObservation {
  if (entry.status !== "CONFIRMED") throw new Error("Only confirmed royalty income may cross into Money Core")
  if (!Number.isFinite(entry.grossAmount) || entry.grossAmount <= 0) throw new Error("Confirmed royalty amount must be greater than zero")
  return Object.freeze({ id:`music-income:${entry.id}`, source:"JHADINA_MUSIC", kind:"MUSIC_ROYALTY_INCOME", amount:entry.grossAmount, currency:entry.currency, externalReference:entry.statementId, evidence:{royaltyEntryId:entry.id,platform:entry.source,releaseId:entry.releaseId,isrc:entry.isrc} })
}

export function assertMusicCannotMintFinancialAction(_observation: MusicIncomeObservation): CanonicalFinancialAction | never {
  throw new Error("MUSIC_INCOME_REQUIRES_MONEY_CORE_INGRESS")
}

export function allocateConfirmedIncome(amount:number,rates={tax:0.25,survival:0.25,growth:0.2,owner:0.2,freedom:0.1}) {
  if (amount < 0) throw new Error("Income cannot be negative")
  const total=Object.values(rates).reduce((a,b)=>a+b,0); if(Math.abs(total-1)>0.000001) throw new Error("Allocation rates must total 100%")
  return Object.fromEntries(Object.entries(rates).map(([bucket,rate])=>[bucket,amount*rate]))
}
