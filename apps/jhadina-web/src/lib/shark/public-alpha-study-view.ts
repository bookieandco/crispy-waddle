export const ALPHA_PUBLIC_STUDY_SCHEMA = 'JHADINA-SHARK-ALPHA-PUBLIC-PAPER-STUDY-V1' as const

export type AlphaPublicEvent = Readonly<{
  type: string
  mint: string
  pair?: string
  availableAt: string
  dossierDigest: string
  priceUsd?: number
  liquidityUsd?: number
  priceOnlyReturnPct?: number | null
  liquidityChangePctReported?: number | null
  realizedFill?: false
}>

export type AlphaPublicStudy = Readonly<{
  schema: typeof ALPHA_PUBLIC_STUDY_SCHEMA
  caseId: string
  mint: string
  pair: string
  openedAt: string
  source: 'OWNER_SELECTED_PUBLIC_MARKET_NO_TELEGRAM'
  authority: 'RESEARCH_ONLY'
  status: 'OPEN' | 'CLOSED'
  canTrade: false
  canSign: false
  canBroadcast: false
  canAuthorizeLive: false
  backtestAuthorized: false
  lastDigest: string
  events: AlphaPublicEvent[]
}>

export type AlphaPublicView = Readonly<{
  study: AlphaPublicStudy
  series: Array<{availableAt: string; priceUsd: number}>
  lastMark: string
  priceOnlyReturnPct: number | null
  liquidityChangePctReported: number | null
  reviewedOutcomes: number
}>

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value) &&
  Number.isFinite(Date.parse(value))

const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Local display validation, not an independent cryptographic/provider audit.
 * No network calls or mutation. Never interpret arbitrary JSON as an alpha signal.
 */
export function parsePublicAlphaStudy(input: unknown): AlphaPublicView {
  const raw = asObject(input)
  if (!raw ||
    raw.schema !== ALPHA_PUBLIC_STUDY_SCHEMA ||
    raw.source !== 'OWNER_SELECTED_PUBLIC_MARKET_NO_TELEGRAM' ||
    raw.authority !== 'RESEARCH_ONLY' ||
    raw.canTrade !== false || raw.canSign !== false ||
    raw.canBroadcast !== false || raw.canAuthorizeLive !== false ||
    raw.backtestAuthorized !== false ||
    (raw.status !== 'OPEN' && raw.status !== 'CLOSED') ||
    typeof raw.caseId !== 'string' || !raw.caseId.startsWith('public-paper:') ||
    !/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(String(raw.mint ?? '')) ||
    !/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(String(raw.pair ?? '')) ||
    !validTime(raw.openedAt) ||
    typeof raw.lastDigest !== 'string' || !/^[a-f0-9]{64}$/.test(raw.lastDigest) ||
    !Array.isArray(raw.events) || raw.events.length < 1 || raw.events.length > 40
  ) throw new Error('Not a valid research-only public SHARK paper study.')

  const events: AlphaPublicEvent[] = []
  let lastTimestamp = -Infinity
  let terminal = false
  for (const [i, value] of raw.events.entries()) {
    const e = asObject(value)
    if (!e || e.mint !== raw.mint || !validTime(e.availableAt) ||
        typeof e.dossierDigest !== 'string' || !/^[a-f0-9]{64}$/.test(e.dossierDigest)) {
      throw new Error('Public study contains an invalid observation.')
    }
    const stamp = Date.parse(e.availableAt)
    if (stamp < lastTimestamp || (i > 0 && terminal)) {
      throw new Error('Public study observation order is invalid.')
    }
    lastTimestamp = stamp
    if (i === 0) {
      if (e.type !== 'FIRST_UNATTESTED_PUBLIC_MARKET' ||
          e.pair !== raw.pair || e.availableAt !== raw.openedAt ||
          !validNumber(e.priceUsd) || e.priceUsd <= 0 ||
          !validNumber(e.liquidityUsd) || e.liquidityUsd < 0) {
        throw new Error('Public study has no valid first observation.')
      }
    } else {
      const types = ['PRE_HORIZON_OBSERVATION', 'PRICE_ONLY_UNVERIFIED',
        'HORIZON_MISSED_CENSORED', 'PAIR_SWITCH_CENSORED',
        'MISSING_OR_INVALID_EVIDENCE_CENSORED']
      if (!types.includes(String(e.type)) || e.realizedFill !== false ||
          !validNumber(e.priceUsd) || e.priceUsd <= 0) {
        throw new Error('Public study contains invalid or executable claims.')
      }
      if (e.type === 'PRICE_ONLY_UNVERIFIED' &&
          (!validNumber(e.priceOnlyReturnPct) || e.pair !== raw.pair)) {
        throw new Error('Price-only mark is incomplete.')
      }
      if (e.type !== 'PRE_HORIZON_OBSERVATION') terminal = true
    }
    events.push(e as unknown as AlphaPublicEvent)
  }
  if ((raw.status === 'CLOSED') !== terminal) {
    throw new Error('Study terminal status is inconsistent.')
  }
  const last = events[events.length - 1]!
  const priced = last.type === 'PRICE_ONLY_UNVERIFIED'
  return {
    study: raw as unknown as AlphaPublicStudy,
    series: events.filter(e => validNumber(e.priceUsd) && e.priceUsd > 0)
      .map(e => ({availableAt: e.availableAt, priceUsd: e.priceUsd!})),
    lastMark: raw.status === 'OPEN' ? 'UNSCORED_OPEN' : last.type,
    priceOnlyReturnPct: priced && validNumber(last.priceOnlyReturnPct) ? last.priceOnlyReturnPct : null,
    liquidityChangePctReported: priced && validNumber(last.liquidityChangePctReported)
      ? last.liquidityChangePctReported : null,
    reviewedOutcomes: priced ? 1 : 0,
  }
}
