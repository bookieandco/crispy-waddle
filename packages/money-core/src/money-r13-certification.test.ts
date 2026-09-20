import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindActionCoreAuthority } from './action-core-authority-bridge.js'
import { assertCanonicalPortfolio } from './canonical-financial-state.js'
import { assertPointInTimeObservation } from './market-provenance-contracts.js'
import { assertReplayableSimulation } from './risk-simulation-contracts.js'
import { assertProposalEligible } from './decision-workflow-contracts.js'

test('R13: authority cannot be inferred from an eligible-looking financial decision',()=>{
  assert.throws(()=>assertProposalEligible({caseId:'c',evidenceStatus:'VALID',freshnessStatus:'VALID',riskStatus:'PASS',stressStatus:'PASS',simulationStatus:'PASS',liquidityStatus:'PASS',calibrationStatus:'PASS',authorityStatus:'MISSING',disposition:'PROPOSAL_ELIGIBLE'}),/AUTHORITY_MISSING/)
})
test('R13: canonical portfolio rejects cross-account position injection',()=>{
 const m={coefficient:0n,scale:2,currency:'USD'}; assert.throws(()=>assertCanonicalPortfolio({portfolioId:'p',accountId:'a',cash:{accountId:'a',cash:m,settled:m,unsettled:m,reserved:m,available:m,buyingPower:m,asOf:'t',evidenceRefs:['e']},positions:[{accountId:'b',instrumentId:'i',side:'LONG',quantity:'1',lotIds:[],asOf:'t',evidenceRefs:['e']}],lots:[],asOf:'t',sourceEventIds:['event'],stateHash:'h'}),/ACCOUNT_MISMATCH/)
})
test('R13: point-in-time boundary rejects future evidence',()=>assert.throws(()=>assertPointInTimeObservation({observationId:'o',instrumentId:'i',provider:'p',observationType:'quote',value:'1',observedAt:'t',receivedAt:'t',effectiveAt:'t',availableAt:'2026-09-21',qualityStatus:'VALID',evidenceRef:'e',provenanceHash:'h'},'2026-09-20'),/FUTURE_LEAK/))
test('R13: replay requires deterministic simulation seed',()=>assert.throws(()=>assertReplayableSimulation({simulationId:'s',portfolioSnapshotId:'p',marketSnapshotId:'m',modelId:'x',modelVersion:'1',methodologyVersion:'1',randomSeed:'',pathCount:100,horizon:'1d',status:'COMPLETE',provenanceHash:'h'}),/NOT_REPLAYABLE/))
