import {createHash} from 'node:crypto'
import type {RunpodShadowLiveCertificationReport} from './shark-shadow-live-certification.js'

// Do not conflate "software is alive", "paper observations exist", and
// "simulated strategy may have an edge". None authorizes a real trade.
const HORIZONS=['15M','1H','4H','24H','3D','7D'] as const
type Horizon=typeof HORIZONS[number]
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const nonnegative=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0
const positive=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0

export type ShadowWatchdogCycle=Readonly<{
  runId:string
  observedAt:string
  healthy:boolean
  authority:'SHADOW_LEARNING_ONLY'
  canExecute:false
  canSign:false
  canBroadcast:false
}>
export type ShadowProductionEvidence=Readonly<{
  observedAt:string
  runtime:RunpodShadowLiveCertificationReport
  observations:Readonly<Record<Horizon,number>>
  lessons:Readonly<Record<Horizon,number>>
  // Independent point-in-time SQL audit of decision, sample and lesson IDs.
  // Aggregates alone cannot attest that the source evidence belongs to a horizon.
  pointInTime:Readonly<{
    verifiedObservations:Readonly<Record<Horizon,number>>
    verifiedLessons:Readonly<Record<Horizon,number>>
    lineageMismatches:number
  }>
  gradeReviews:Readonly<{invalid:number;unverified:number}>
  watchdogCycles:readonly ShadowWatchdogCycle[]
  volume:Readonly<{attached:boolean;encryptedSnapshotRecovered:boolean;restoredSha256?:string;sourceSha256?:string}>
  shadowToSwlc:Readonly<{healthy:boolean;imported:number;acknowledged:number;rejected:number;pending:number}>
  simulatedFills:Readonly<{sampleSize:number;validatedFeeAndSlippage:number;unrealisticFillCount:number;liveSigningOrBroadcastCount:number}>
  replay:Readonly<{compared:number;mismatches:number;futureLeaks:number}>
  memoryFeedback:Readonly<{verifiedAffectedDecisions:number;invalidLessonsUsed:number;baseRejectedUpgrades:number}>
  performanceMims:Readonly<{status:'PASS'|'REVIEW'|'FAIL'|'UNVERIFIED';sampleSize:number}>
}>
export type ShadowProductionCertification=Readonly<{
  reportId:string
  observedAt:string
  operationalPassed:boolean
  gates:Readonly<{
    previousRuntimeHealth:boolean
    allSixPointInTimeHorizons:boolean
    noUnreviewedLegacyGrades:boolean
    watchdogAcrossMultipleCycles:boolean
    durableRecoveredVolume:boolean
    swlcReconciled:boolean
    realisticSimulatedCosts:boolean
    deterministicReplay:boolean
    safeMemoryFeedback:boolean
  }>
  blockers:readonly string[]
  performanceVerdict:'SIMULATED_EDGE_SUPPORTED'|'SIMULATED_EDGE_FAILED'|'SIMULATED_EDGE_UNCERTAIN'
  performanceIndependentOfHealth:true
  realWorldProfitabilityProven:false
  liveTradingAuthorized:false
  authority:'CERTIFICATION_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

export function certifyShadowPaperProductionEvidence(
  evidence:ShadowProductionEvidence,
):ShadowProductionCertification{
  const now=Date.parse(evidence.observedAt)
  if(!Number.isFinite(now))throw new Error('SHADOW_P2_CERT_TIME_INVALID')
  const cycles=[...evidence.watchdogCycles]
    .filter(c=>c.healthy && c.authority==='SHADOW_LEARNING_ONLY'
      && c.canExecute===false && c.canSign===false && c.canBroadcast===false
      && Number.isFinite(Date.parse(c.observedAt))
      && Date.parse(c.observedAt)<=now
      && Date.parse(c.observedAt)>=now-2*60*60_000)
    .sort((a,b)=>a.observedAt.localeCompare(b.observedAt))
  const distinct=[...new Map(cycles.map(c=>[c.runId,c])).values()]
  const spaced:ShadowWatchdogCycle[]=[]
  for(const c of distinct){
    if(!spaced.length || Date.parse(c.observedAt)-Date.parse(spaced[spaced.length-1]!.observedAt)>=10*60_000){
      spaced.push(c)
    }
  }
  const first=Date.parse(spaced[0]?.observedAt??'')
  const last=Date.parse(spaced[spaced.length-1]?.observedAt??'')
  const allSix=evidence.pointInTime.lineageMismatches===0 && HORIZONS.every(h=>
    positive(evidence.observations[h]) && positive(evidence.lessons[h])
    && evidence.pointInTime.verifiedObservations[h]===evidence.observations[h]
    && evidence.pointInTime.verifiedLessons[h]===evidence.lessons[h])
  const volume=evidence.volume
  const sync=evidence.shadowToSwlc
  const fills=evidence.simulatedFills
  const replay=evidence.replay
  const memory=evidence.memoryFeedback
  const gates={
    previousRuntimeHealth:evidence.runtime.passed===true,
    allSixPointInTimeHorizons:allSix,
    noUnreviewedLegacyGrades:evidence.gradeReviews.invalid===0 && evidence.gradeReviews.unverified===0,
    watchdogAcrossMultipleCycles:spaced.length>=3 && last-first>=30*60_000
      && now-last>=0 && now-last<=20*60_000,
    durableRecoveredVolume:volume.attached && volume.encryptedSnapshotRecovered
      && Boolean(volume.sourceSha256?.match(/^[0-9a-f]{64}$/))
      && volume.sourceSha256===volume.restoredSha256,
    swlcReconciled:sync.healthy && nonnegative(sync.imported)
      && positive(sync.acknowledged) && sync.imported===sync.acknowledged
      && sync.pending===0 && sync.rejected===0,
    realisticSimulatedCosts:positive(fills.sampleSize)
      && fills.validatedFeeAndSlippage===fills.sampleSize
      && fills.unrealisticFillCount===0 && fills.liveSigningOrBroadcastCount===0,
    deterministicReplay:replay.compared>=6 && replay.mismatches===0 && replay.futureLeaks===0,
    safeMemoryFeedback:positive(memory.verifiedAffectedDecisions)
      && memory.invalidLessonsUsed===0 && memory.baseRejectedUpgrades===0,
  } as const
  const blockers=Object.entries(gates).filter(([,passed])=>!passed).map(([key])=>'SHADOW_P2_GATE_'+key)
  const performanceVerdict=evidence.performanceMims.status==='PASS' && evidence.performanceMims.sampleSize>=20
    ? 'SIMULATED_EDGE_SUPPORTED'
    : evidence.performanceMims.status==='FAIL'
      ? 'SIMULATED_EDGE_FAILED':'SIMULATED_EDGE_UNCERTAIN'
  return Object.freeze({
    reportId:'shadow-production-paper:'+sha({at:evidence.observedAt,gates,performanceVerdict}),
    observedAt:evidence.observedAt,operationalPassed:blockers.length===0,
    gates:Object.freeze(gates),blockers:Object.freeze(blockers),
    performanceVerdict,performanceIndependentOfHealth:true as const,
    realWorldProfitabilityProven:false as const,
    liveTradingAuthorized:false as const,authority:'CERTIFICATION_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const,
  })
}
