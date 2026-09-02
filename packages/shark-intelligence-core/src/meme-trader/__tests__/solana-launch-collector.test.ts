import { describe, expect, it } from 'vitest'
import { collectHeliusLaunch } from '../solana-launch-collector'

describe('Solana launch collector', () => {
  it('normalizes a live Helius token event into canonical launch ingestion', () => {
    const result = collectHeliusLaunch({
      type: 'TOKEN_MINT',
      signature: 'sig-123',
      timestamp: 1788307200,
      slot: 123,
      feePayer: 'DEV111',
      events: { token: { mint: 'MINT111', decimals: 9 } },
    })
    expect(result?.observation.source).toBe('helius-webhook')
    expect(result?.observation.tokenAddress).toBe('MINT111')
    expect(result?.observation.deployerWalletId).toBe('DEV111')
    expect(result?.ingested.launch.outcome).toBe('UNKNOWN')
    expect(result?.ingested.graph.edges.some(edge => edge.relation === 'deployed')).toBe(true)
  })

  it('refuses arbitrary webhook payloads without a token mint', () => {
    expect(collectHeliusLaunch({ signature: 'sig-only' })).toBeNull()
  })

  it('does not fabricate USD liquidity from token transfer amounts', () => {
    const result = collectHeliusLaunch({
      signature: 'sig-456',
      tokenTransfers: [{ mint: 'MINT222', tokenAmount: 1_000_000 }],
    })
    expect(result?.observation.initialLiquidityUsd).toBeUndefined()
  })
})
