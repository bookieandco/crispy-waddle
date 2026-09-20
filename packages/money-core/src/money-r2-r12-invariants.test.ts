import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertCanonicalPortfolio } from './canonical-financial-state.js'
import { assertPointInTimeObservation } from './market-provenance-contracts.js'
import { assertReplayableSimulation } from './risk-simulation-contracts.js'
import { buildMacroSnapshotV2 } from './macro-economic-contracts-v2.js'

test('canonical state requires source lineage',()=>assert.throws(()=>assertCanonicalPortfolio({portfolioId:'p',accountId:'a',cash:{} as never,positions:[],lots:[],asOf:'t',sourceEventIds:[],stateHash:''}),/UNPROVEN/))
test('future market evidence is rejected',()=>assert.throws(()=>assertPointInTimeObservation({observationId:'o',instrumentId:'i',provider:'p',observationType:'price',value:'1',observedAt:'1',receivedAt:'1',effectiveAt:'1',availableAt:'2026-02-01',qualityStatus:'VALID',evidenceRef:'e',provenanceHash:'h'},'2026-01-01'),/FUTURE_LEAK/))
test('simulation must be replayable',()=>assert.throws(()=>assertReplayableSimulation({simulationId:'s',portfolioSnapshotId:'p',marketSnapshotId:'m',modelId:'x',modelVersion:'1',methodologyVersion:'1',randomSeed:'',pathCount:1,horizon:'1d',status:'COMPLETE',provenanceHash:'h'}),/NOT_REPLAYABLE/))
test('macro snapshot excludes future artifacts',()=>{const s=buildMacroSnapshotV2('2026-01-01',[{artifactId:'a',kind:'REGIME',availableAt:'2025-12-31',evidenceRefs:['e'],provenanceHash:'h'},{artifactId:'future',kind:'POLICY_EVENT',availableAt:'2026-02-01',evidenceRefs:['e'],provenanceHash:'h'}],'v1','hash');assert.deepEqual(s.artifactIds,['a'])})
