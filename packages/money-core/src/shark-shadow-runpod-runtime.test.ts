import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runpodShadowHorizonTarget,
  runpodShadowSample,
  scoreRunpodShadowCandidate,
  type RunpodShadowCandidate,
} from './shark-shadow-runpod-runtime.js'

const candidate:RunpodShadowCandidate={
  chainId:'solana',tokenAddress:'mint-1',pairAddress:'pair-1',dexId:'pumpfun',
  priceUsd:.01,liquidityUsd:150000,volume24hUsd:500000,buys24h:800,sells24h:300,priceChange1hPct:12,
  pairCreatedAt:'2026-10-03T12:00:00Z',discoveredAt:'2026-10-03T17:00:00Z',
  evidenceIds:['dexscreener:pair:pair-1'],raw:{pairAddress:'pair-1'},
}

test('RunPod shadow scoring admits liquid active evidence without execution authority',()=>{
  const score=scoreRunpodShadowCandidate(candidate,'2026-10-03T17:00:00Z')
  assert.equal(score.disposition,'ALLOCATED')
  assert.ok(score.confidence>=.55)
  const sample=runpodShadowSample(candidate)
  assert.equal(sample.priceUsd,.01)
  assert.equal(sample.tokenAddress,'mint-1')
})

test('RunPod shadow scoring turns thin evidence into NO_TRADE input',()=>{
  const score=scoreRunpodShadowCandidate({...candidate,liquidityUsd:1000,volume24hUsd:500,buys24h:2,sells24h:8},'2026-10-03T17:00:00Z')
  assert.equal(score.disposition,'PURSE_REJECTED')
  assert.ok(score.reasonCodes.includes('LIQUIDITY_BELOW_SHADOW_FLOOR'))
})

test('RunPod outcome windows remain non-overlapping',()=>{
  assert.deepEqual(runpodShadowHorizonTarget('2026-10-03T17:00:00Z','15M'),{
    dueAt:'2026-10-03T17:15:00.000Z',latestAt:'2026-10-03T17:59:59.999Z',
  })
  assert.deepEqual(runpodShadowHorizonTarget('2026-10-03T17:00:00Z','1H'),{
    dueAt:'2026-10-03T18:00:00.000Z',latestAt:'2026-10-03T20:59:59.999Z',
  })
})
