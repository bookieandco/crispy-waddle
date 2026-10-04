import test from 'node:test'
import assert from 'node:assert/strict'
import {parseRunpodShadowReplayRecord} from './shark-shadow-runpod-replay.js'

test('RunPod replay parser preserves point-in-time market evidence',()=>{
  const row=parseRunpodShadowReplayRecord({
    tokenAddress:'mint',pairAddress:'pair',dexId:'pumpfun',observedAt:'2026-10-01T00:00:00Z',
    priceUsd:.02,liquidityUsd:50000,volume24hUsd:100000,buys24h:100,sells24h:50,
  })
  assert.equal(row.chainId,'solana')
  assert.equal(row.priceUsd,.02)
  assert.equal(row.discoveredAt,'2026-10-01T00:00:00Z')
  assert.ok(row.evidenceIds.includes('runpod-shadow-replay-import:v1'))
})

test('RunPod replay parser rejects missing prices',()=>{
  assert.throws(()=>parseRunpodShadowReplayRecord({
    tokenAddress:'mint',pairAddress:'pair',dexId:'pumpfun',observedAt:'2026-10-01T00:00:00Z',
    liquidityUsd:50000,volume24hUsd:100000,buys24h:100,sells24h:50,
  }),/RUNPOD_SHADOW_REPLAY_FIELD_INVALID:priceUsd/)
})
