import {describe, expect, it} from 'vitest'
import {parsePublicAlphaStudy, ALPHA_PUBLIC_STUDY_SCHEMA} from './public-alpha-study-view'

const mint = 'So11111111111111111111111111111111111111113'
const pair = 'So11111111111111111111111111111111111111114'
const hash = 'a'.repeat(64)
const first = {
  type: 'FIRST_UNATTESTED_PUBLIC_MARKET', mint, pair,
  availableAt: '2026-10-17T00:00:00Z', dossierDigest: hash,
  priceUsd: 0.001, liquidityUsd: 12000,
}
const study = {
  schema: ALPHA_PUBLIC_STUDY_SCHEMA, caseId: 'public-paper:' + hash,
  mint, pair, openedAt: '2026-10-17T00:00:00Z',
  source: 'OWNER_SELECTED_PUBLIC_MARKET_NO_TELEGRAM',
  authority: 'RESEARCH_ONLY', status: 'OPEN',
  canTrade: false, canSign: false, canBroadcast: false,
  canAuthorizeLive: false, backtestAuthorized: false,
  lastDigest: hash, events: [first],
}

describe('SHARK public alpha study client preview', () => {
  it('displays an honest empty/open price-only state', () => {
    const r = parsePublicAlphaStudy(study)
    expect(r.lastMark).toBe('UNSCORED_OPEN')
    expect(r.priceOnlyReturnPct).toBeNull()
    expect(r.reviewedOutcomes).toBe(0)
    expect(r.series).toEqual([{availableAt: first.availableAt, priceUsd: first.priceUsd}])
  })
  it('shows a closed same-pair 24h spot move, not executable P&L', () => {
    const next = { ...study, status: 'CLOSED', events: [...study.events, {
      type: 'PRICE_ONLY_UNVERIFIED', mint, pair,
      availableAt: '2026-10-18T00:00:00Z', dossierDigest: 'b'.repeat(64),
      priceUsd: 0.0012, liquidityUsd: 13200, realizedFill: false,
      priceOnlyReturnPct: 20, liquidityChangePctReported: 10,
    }] }
    const r = parsePublicAlphaStudy(next)
    expect(r.reviewedOutcomes).toBe(1)
    expect(r.priceOnlyReturnPct).toBe(20)
    expect(r.liquidityChangePctReported).toBe(10)
  })
  it('does not mistake censored or early reads for profitable outcomes', () => {
    const censored = { ...study, status: 'CLOSED', events: [...study.events, {
      type: 'PAIR_SWITCH_CENSORED', mint, pair: 'So11111111111111111111111111111111111111115',
      availableAt: '2026-10-18T00:00:00Z', dossierDigest: 'b'.repeat(64),
      priceUsd: 5, realizedFill: false, priceOnlyReturnPct: null,
    }] }
    expect(parsePublicAlphaStudy(censored).priceOnlyReturnPct).toBeNull()
    expect(parsePublicAlphaStudy(censored).lastMark).toBe('PAIR_SWITCH_CENSORED')
  })
  it('refuses Telegram or trade-authority escalation', () => {
    expect(() => parsePublicAlphaStudy({...study, source: 'TELEGRAM'})).toThrow()
    expect(() => parsePublicAlphaStudy({...study, canTrade: true})).toThrow()
    expect(() => parsePublicAlphaStudy({...study, backtestAuthorized: true})).toThrow()
    expect(() => parsePublicAlphaStudy({...study, events: []})).toThrow()
  })
  it('refuses out-of-order receipts and fake terminal state', () => {
    const bad = { ...study, status: 'CLOSED' }
    expect(() => parsePublicAlphaStudy(bad)).toThrow()
    const reordered = { ...study, events: [first, {
      type: 'PRE_HORIZON_OBSERVATION', mint, pair,
      availableAt: '2026-10-16T00:00:00Z', dossierDigest: 'b'.repeat(64),
      priceUsd: 1, realizedFill: false,
    }] }
    expect(() => parsePublicAlphaStudy(reordered)).toThrow()
  })
})
