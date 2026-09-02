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
    }, '2026-09-02T12:00:00.000Z')
    expect(evidence.source).toBe('dexscreener')
    expect(evidence.subjectId).toBe('Token111')
    expect(evidence.payload.volume24hUsd).toBe(500000)
  })

  it('rejects malformed numeric and identity input', () => {
    expect(() => normalizeDexScreenerPair({ chainId: 'solana', baseToken: { address: 'x' }, liquidity: { usd: 'nan' } })).toThrow()
    expect(() => normalizeDexScreenerPair({ chainId: 'solana' })).toThrow()
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
    expect(events).toEqual(['meme-market:solana:Token111:2026-09-02T12:00:00.000Z:100000:500000:120:80'])
  })
})
