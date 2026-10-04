export type RunpodShadowLiveCertificationSnapshot=Readonly<{
  observationCounts:Readonly<Record<string,number>>
  lessonCounts:Readonly<Record<string,number>>
  calibrationCount:number
  memoryCount:number
  pendingSync:number
  firstObservationAt?:string
  firstLessonAt?:string
  latestCalibration?:unknown
  latestMemory?:unknown
}>

export type RunpodShadowLiveCertificationReport=Readonly<{
  observedAt:string
  passed:boolean
  gates:Readonly<{
    first15mOutcome:boolean
    first1hGrading:boolean
    counterfactualLessons:boolean
    performanceCalibration:boolean
    learningMemory:boolean
    continuousRuntime:boolean
    networkVolume:boolean
    historicalReplay:boolean
    swlcRecoverySync:boolean
    authorityBoundary:boolean
  }>
  blockers:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const bool=(value:unknown)=>value===true
const text=(value:unknown)=>typeof value==='string'?value:''
const count=(record:Readonly<Record<string,number>>,key:string)=>Number(record[key]??0)

export function certifyRunpodShadowLive(input:Readonly<{
  observedAt:string
  snapshot:RunpodShadowLiveCertificationSnapshot
  lastLive?:unknown
  lastOutcomes?:unknown
  service?:unknown
  lastReplay?:unknown
  networkVolumeAttached:boolean
  swlcSyncReady:boolean
}>):RunpodShadowLiveCertificationReport{
  if(!input.observedAt||Number.isNaN(Date.parse(input.observedAt)))throw new Error('SHADOW_LIVE_CERT_OBSERVED_AT_INVALID')
  const calibration=row(input.snapshot.latestCalibration)
  const memory=row(input.snapshot.latestMemory)
  const performance=row(calibration.performanceMims)
  const service=row(input.service)
  const live=row(input.lastLive)
  const outcomes=row(input.lastOutcomes)
  const replay=row(input.lastReplay)

  const gates={
    first15mOutcome:count(input.snapshot.observationCounts,'15M')>=1,
    first1hGrading:count(input.snapshot.observationCounts,'1H')>=1,
    counterfactualLessons:count(input.snapshot.lessonCounts,'1H')>=1,
    performanceCalibration:
      input.snapshot.calibrationCount>=1
      && text(calibration.authority)==='LEARNING_ONLY'
      && calibration.canAuthorizeLive===false
      && ['PASS','REVIEW','FAIL'].includes(text(performance.status)),
    learningMemory:
      input.snapshot.memoryCount>=1
      && text(memory.authority)==='LEARNING_MEMORY_ONLY'
      && memory.canAuthorizeLive===false,
    continuousRuntime:
      text(service.status)==='ready'
      && text(service.authority)==='SHADOW_LEARNING_ONLY'
      && service.canExecute===false
      && service.canSign===false
      && service.canBroadcast===false
      && Object.keys(live).length>0
      && Object.keys(outcomes).length>0,
    networkVolume:input.networkVolumeAttached,
    historicalReplay:
      Object.keys(replay).length>0
      && text(replay.authority)==='RESEARCH_REPLAY_ONLY'
      && replay.canExecute===false
      && replay.canAuthorizeLive===false,
    swlcRecoverySync:input.swlcSyncReady,
    authorityBoundary:
      calibration.canAuthorizeLive!==true
      && memory.canAuthorizeLive!==true
      && replay.canExecute!==true
      && replay.canAuthorizeLive!==true,
  } as const

  const labels:Record<keyof typeof gates,string>={
    first15mOutcome:'SHADOW_LIVE_15M_OUTCOME_REQUIRED',
    first1hGrading:'SHADOW_LIVE_1H_GRADING_REQUIRED',
    counterfactualLessons:'SHADOW_LIVE_COUNTERFACTUAL_REQUIRED',
    performanceCalibration:'SHADOW_LIVE_PERFORMANCE_CALIBRATION_REQUIRED',
    learningMemory:'SHADOW_LIVE_MEMORY_REQUIRED',
    continuousRuntime:'SHADOW_LIVE_CONTINUOUS_RUNTIME_REQUIRED',
    networkVolume:'SHADOW_LIVE_NETWORK_VOLUME_REQUIRED',
    historicalReplay:'SHADOW_LIVE_HISTORICAL_REPLAY_REQUIRED',
    swlcRecoverySync:'SHADOW_LIVE_SWLC_SYNC_REQUIRED',
    authorityBoundary:'SHADOW_LIVE_AUTHORITY_BOUNDARY_FAILED',
  }
  const blockers=(Object.keys(gates) as (keyof typeof gates)[]).filter(key=>!gates[key]).map(key=>labels[key])
  return Object.freeze({
    observedAt:input.observedAt,
    passed:blockers.length===0,
    gates:Object.freeze(gates),
    blockers:Object.freeze(blockers),
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
    canAuthorizeLive:false,
  })
}
