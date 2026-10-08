import test from 'node:test'
import assert from 'node:assert/strict'
import {
  certifyShadowPaperProductionEvidence,
  type ShadowProductionEvidence,
} from './shark-shadow-production-certification.js'

const now='2026-10-08T00:00:00.000Z'
const allHorizonCounts={'15M':3,'1H':3,'4H':3,'24H':3,'3D':3,'7D':3}
const runtime={
  observedAt:now,passed:true,gates:{
    first15mOutcome:true,first1hGrading:true,counterfactualLessons:true,
    performanceCalibration:true,learningMemory:true,continuousRuntime:true,
    networkVolume:true,historicalReplay:true,swlcRecoverySync:true,authorityBoundary:true,
  },blockers:[],authority:'CERTIFICATION_ONLY' as const,
  canExecute:false as const,canAuthorizeLive:false as const,
}
const cycles=[
  {runId:'watch-1',observedAt:'2026-10-07T23:20:00.000Z',healthy:true,
    authority:'SHADOW_LEARNING_ONLY' as const,canExecute:false as const,
    canSign:false as const,canBroadcast:false as const},
  {runId:'watch-2',observedAt:'2026-10-07T23:35:00.000Z',healthy:true,
    authority:'SHADOW_LEARNING_ONLY' as const,canExecute:false as const,
    canSign:false as const,canBroadcast:false as const},
  {runId:'watch-3',observedAt:'2026-10-07T23:50:00.000Z',healthy:true,
    authority:'SHADOW_LEARNING_ONLY' as const,canExecute:false as const,
    canSign:false as const,canBroadcast:false as const},
]
const digest='a'.repeat(64)
const evidence:ShadowProductionEvidence={
  observedAt:now,runtime,observations:allHorizonCounts,lessons:allHorizonCounts,
  gradeReviews:{invalid:0,unverified:0},watchdogCycles:cycles,
  volume:{attached:true,encryptedSnapshotRecovered:true,sourceSha256:digest,restoredSha256:digest},
  shadowToSwlc:{healthy:true,imported:10,acknowledged:10,rejected:0,pending:0},
  simulatedFills:{sampleSize:40,validatedFeeAndSlippage:40,unrealisticFillCount:0,liveSigningOrBroadcastCount:0},
  replay:{compared:6,mismatches:0,futureLeaks:0},
  memoryFeedback:{verifiedAffectedDecisions:2,invalidLessonsUsed:0,baseRejectedUpgrades:0},
  performanceMims:{status:'FAIL',sampleSize:20},
}
test('operational can be certified by independent evidence while simulated edge is FAIL',()=>{
  const report=certifyShadowPaperProductionEvidence(evidence)
  assert.equal(report.operationalPassed,true)
  assert.equal(report.performanceVerdict,'SIMULATED_EDGE_FAILED')
  assert.equal(report.realWorldProfitabilityProven,false)
  assert.equal(report.liveTradingAuthorized,false)
})
test('missing 7-day horizon blocks unattended operational certification',()=>{
  const report=certifyShadowPaperProductionEvidence({...evidence,observations:{...allHorizonCounts,'7D':0}})
  assert.equal(report.gates.allSixPointInTimeHorizons,false)
  assert.equal(report.operationalPassed,false)
})
test('quarantined old grades block paper operational claims without deleting evidence',()=>{
  const report=certifyShadowPaperProductionEvidence({...evidence,gradeReviews:{invalid:3,unverified:4}})
  assert.equal(report.gates.noUnreviewedLegacyGrades,false)
})
test('three watchdog receipts must be distinct, time-spaced and recent',()=>{
  const two=certifyShadowPaperProductionEvidence({...evidence,watchdogCycles:cycles.slice(0,2)})
  assert.equal(two.gates.watchdogAcrossMultipleCycles,false)
  const reused=certifyShadowPaperProductionEvidence({...evidence,watchdogCycles:[cycles[0]!,cycles[0]!,cycles[0]!]})
  assert.equal(reused.gates.watchdogAcrossMultipleCycles,false)
  const stale=certifyShadowPaperProductionEvidence({...evidence,
    observedAt:'2026-10-08T05:00:00.000Z'})
  assert.equal(stale.gates.watchdogAcrossMultipleCycles,false)
})
test('volume restore checks exact same SHA256 and SWLC requires acknowledged records',()=>{
  assert.equal(certifyShadowPaperProductionEvidence({...evidence,
    volume:{attached:true,encryptedSnapshotRecovered:true,sourceSha256:digest,restoredSha256:'b'.repeat(64)}})
    .gates.durableRecoveredVolume,false)
  assert.equal(certifyShadowPaperProductionEvidence({...evidence,
    shadowToSwlc:{healthy:true,imported:10,acknowledged:0,rejected:0,pending:10}})
    .gates.swlcReconciled,false)
})
test('slippage gaps, replay mismatches, invalid memory and base-rejection upgrade block proof',()=>{
  const result=certifyShadowPaperProductionEvidence({...evidence,
    simulatedFills:{...evidence.simulatedFills,unrealisticFillCount:1},
    replay:{...evidence.replay,mismatches:1},
    memoryFeedback:{...evidence.memoryFeedback,baseRejectedUpgrades:1}})
  assert.equal(result.gates.realisticSimulatedCosts,false)
  assert.equal(result.gates.deterministicReplay,false)
  assert.equal(result.gates.safeMemoryFeedback,false)
})
