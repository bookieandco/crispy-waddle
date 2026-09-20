import { describe, expect, it } from 'vitest'
import { DexScreenerEventIngestor, normalizeDexScreenerPair } from '../dexscreener-event-ingest'

describe('normalizeDexScreenerPair', () => {
  it('validates and normalizes an untrusted pair', () => {
    const evidence = normalizeDexScreenerPair({
      chainId: 'solana',
      baseToken: { address: 'Token111' },
      liquidity: { usd: 100000 },
      volume: { h24: 500000 },
      txns: { h24: { buys: 120, sells: 80 } },
      priceUsd: '0.25',
      pairCreatedAt: Date.parse('2026-09-02T10:00:00.000Z'),
    }, '2026-09-02T12:00:00.000Z')
    expect(evidence.source).toBe('dexscreener')
    expect(evidence.subjectId).toBe('Token111')
    expect(evidence.payload.volume24hUsd).toBe(500000)
    expect(evidence.observedAt).toBe('2026-09-02T12:00:00.000Z')
    expect(evidence.payload.pairAgeHours).toBe(2)
  })

  it('rejects malformed numeric and identity input', () => {
    expect(() => normalizeDexScreenerPair({ chainId: 'solana', baseToken: { address: 'x' }, liquidity: { usd: 'nan' } })).toThrow()
    expect(() => normalizeDexScreenerPair({ chainId: 'solana' })).toThrow()
  })

  it('does not suppress a price-only change at the same poll timestamp', async () => {
    const events: string[] = []
    const ingestor = new DexScreenerEventIngestor({ publish: async event => { events.push(event.id) } })
    const base = { chainId: 'solana', baseToken: { address: 'Token111' }, liquidity: { usd: 100000 }, volume: { h24: 500000 }, txns: { h24: { buys: 120, sells: 80 } } }
    const first = await ingestor.ingest({ ...base, priceUsd: '0.25' }, '2026-09-02T12:00:00.000Z')
    const second = await ingestor.ingest({ ...base, priceUsd: '0.26' }, '2026-09-02T12:00:00.000Z')
    expect(first.status).toBe('published')
    expect(second.status).toBe('published')
    expect(events).toHaveLength(2)
  })

})
describe('DexScreenerEventIngestor', () => {
  it('publishes once and suppresses duplicate observation IDs', async () => {
    const events: string[] = []
    const ingestor = new DexScreenerEventIngestor({ publish: async (event) => { events.push(event.id) } })
    const pair = { chainId: 'solana', baseToken: { address: 'Token111' }, liquidity: { usd: 100000 }, volume: { h24: 500000 }, txns: { h24: { buys: 120, sells: 80 } }, priceUsd: 0.25 }
    const first = await ingestor.ingest(pair, '2026-09-02T12:00:00.000Z')
    const second = await ingestor.ingest(pair, '2026-09-02T12:00:00.000Z')
    expect(first.status).toBe('published')
    expect(second.status).toBe('duplicate')
    expect(events).toEqual(['meme-market:solana:Token111:2026-09-02T12:00:00.000Z:100000:500000:120:80:0.25:'])
  })
})
