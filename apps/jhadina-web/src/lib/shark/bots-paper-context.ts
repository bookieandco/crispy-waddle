/**
 * SHARK-BOTS.PAPER.01 — point-in-time evidence boundary for both bot specialists.
 *
 * Caller-asserted evidence references are NOT cryptographically proven here;
 * provenance must be checked upstream before any privileged admission.
 * This module cannot sign, trade, launch, send funds or alter risk policies.
 */
export const SHARK_BOTS_PAPER_SCHEMA = 'SHARK-BOTS-PAPER-01' as const
export const SHARK_BOTS_PAPER_AUTHORITY = Object.freeze({
  mode: 'PAPER_ONLY' as const,
  canExecute: false as const,
  canTrade: false as const,
  canLaunch: false as const,
  canSign: false as const,
  canBroadcast: false as const,
  canSpend: false as const,
  canPublish: false as const,
  canChangePolicies: false as const,
  externallyVerified: false as const,
})

export type SharkBotResearchSource = Readonly<{
  sourceClass: 'SHARK_CANONICAL_RESEARCH' | 'DEXSCREENER_INDICATIVE'
  evidenceId: string
  eventDigest: string
  chainId: 'solana'
  tokenMint: string
  pairAddress: string
  observedAt: string
  availableAt: string
  evidenceIds: readonly string[]
}>

export type SharkBotPaperContext = Readonly<{
  caseId: string
  asOf: string
  source: SharkBotResearchSource
}>

export type ValidatedSharkBotPaperContext = Readonly<{
  caseId: string
  asOf: string
  asOfMs: number
  availableAtMs: number
  source: SharkBotResearchSource
  receiptIdentity: string
  authority: typeof SHARK_BOTS_PAPER_AUTHORITY
  safetyScope: 'UNVERIFIED_RESEARCH_NOT_EXECUTION'
}>

const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const digest64 = /^[a-f0-9]{64}$/
const opaqueId = /^[a-zA-Z0-9:_./-]{2,160}$/

export function parseResearchUtc(value: string, field: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error('SHARK_BOTS_INVALID_' + field)
  }
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new Error('SHARK_BOTS_INVALID_' + field)
  }
  return time
}

export function validateSharkBotPaperContext(context: SharkBotPaperContext): ValidatedSharkBotPaperContext {
  if (!context || !context.source || !opaqueId.test(context.caseId ?? '')) {
    throw new Error('SHARK_BOTS_IDENTITY_REQUIRED')
  }
  const source = context.source
  if (!['SHARK_CANONICAL_RESEARCH', 'DEXSCREENER_INDICATIVE'].includes(source.sourceClass) ||
      source.chainId !== 'solana' || !solanaAddress.test(source.tokenMint ?? '') ||
      !solanaAddress.test(source.pairAddress ?? '') ||
      !opaqueId.test(source.evidenceId ?? '') ||
      !digest64.test(source.eventDigest ?? '')) {
    throw new Error('SHARK_BOTS_SOURCE_IDENTITY_INVALID')
  }
  if (!Array.isArray(source.evidenceIds) || source.evidenceIds.length === 0 ||
      source.evidenceIds.length > 100 ||
      source.evidenceIds.some(id => typeof id !== 'string' || !opaqueId.test(id)) ||
      new Set(source.evidenceIds).size !== source.evidenceIds.length ||
      !source.evidenceIds.includes(source.evidenceId)) {
    throw new Error('SHARK_BOTS_SOURCE_EVIDENCE_INVALID')
  }
  const observed = parseResearchUtc(source.observedAt, 'OBSERVED_AT')
  const available = parseResearchUtc(source.availableAt, 'AVAILABLE_AT')
  const cutoff = parseResearchUtc(context.asOf, 'AS_OF')
  if (observed > available || available > cutoff) {
    throw new Error('SHARK_BOTS_SOURCE_LOOKAHEAD_FORBIDDEN')
  }
  return Object.freeze({
    caseId: context.caseId,
    asOf: context.asOf,
    asOfMs: cutoff,
    availableAtMs: available,
    source: Object.freeze({ ...source, evidenceIds: Object.freeze([...source.evidenceIds]) }),
    receiptIdentity: `shark-paper:${context.caseId}:${source.eventDigest}`,
    authority: SHARK_BOTS_PAPER_AUTHORITY,
    safetyScope: 'UNVERIFIED_RESEARCH_NOT_EXECUTION' as const,
  })
}
