export type RunpodShadowLiveCertificationSnapshot=Readonly<{
  observationCounts:Readonly<Record<string,number>>
  lessonCounts:Readonly<Record<string,number>>
  calibrationCount:number
  memoryCount:number
  pendingSync:number
  firstObservationAt?:string
  firstLessonAt?:string
  latestCalibration?:any
  latestMemory?:any
}>

export type RunpodShadowLiveFinalReport=Readonly<{
  reportId:string
  observedAt:string
  passed:boolean
  gates:Readonly<{
    first15mOutcome:boolean
    first1hGrading:boolean
    counterfactualLessons:boolean
    performanceMims:boolean
    memoryCreated:boolean
    memoryFeedback:boolean
    watchdogHealthy:boolean
    networkVolume:boolean
    replay:boolean
    swlcSyncReady:boolean
    authorityBoundary:boolean
  }>
  reasonCodes:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
  canSign:false
  canBroadcast:false
  canAuthorizeLive:false
}>

const bool=(v:unknown)=>v===true
const str=(v:unknown)=>typeof v==='string'?v:''
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'?v as Record<string,any>:{}

export function certifyRunpodShadowLive(input:Readonly<{
  observedAt:string
  snapshot:RunpodShadowLiveCertificationSnapshot
  lastLive?:unknown
  lastOutcomes?:unknown
  service?:unknown
  lastReplay?:unknown
  networkVolumeAttached:boolean
  swlcSyncReady:boolean
}>):RunpodShadowLiveFinalReport{
  const live=record(input.lastLive)
  const outcomes=record(input.lastOutcomes)
  const service=record(input.service)
  const replay=record(input.lastReplay)
  const calibration=record(input.snapshot.latestCalibration)
  const memory=record(input.snapshot.latestMemory)
  const serviceUpdated=str(service.updatedAt)
  const serviceAgeMs=serviceUpdated?Date.parse(input.observedAt)-Date.parse(serviceUpdated):Number.POSITIVE_INFINITY
  const authorityBoundary=
    live.canExecute===false&&live.canSign===false&&live.canBroadcast===false&&
    outcomes.canExecute===false&&outcomes.canAuthorizeLive===false&&
    calibration.canAuthorizeLive!==true&&calibration.canMutateMandate!==true&&
    memory.canAuthorizeLive!==true

  const gates=Object.freeze({
    first15mOutcome:(input.snapshot.observationCounts['15M']??0)>0&&(input.snapshot.lessonCounts['15M']??0)>0,
    first1hGrading:(input.snapshot.observationCounts['1H']??0)>0&&(input.snapshot.lessonCounts['1H']??0)>0,
    counterfactualLessons:Object.values(input.snapshot.lessonCounts).reduce((a,b)=>a+b,0)>0,
    performanceMims:input.snapshot.calibrationCount>0&&Boolean(record(calibration.performanceMims).status),
    memoryCreated:input.snapshot.memoryCount>0,
    memoryFeedback:Number(live.memoryApplied??0)>0,
    watchdogHealthy:service.status==='ready'&&Number.isFinite(serviceAgeMs)&&serviceAgeMs>=0&&serviceAgeMs<=15*60_000,
    networkVolume:input.networkVolumeAttached,
    replay:Boolean(replay.replayId)&&replay.canExecute===false&&replay.canAuthorizeLive===false,
    swlcSyncReady:input.swlcSyncReady,
    authorityBoundary,
  })
  const reasonCodes=Object.entries(gates).filter(([,v])=>!v).map(([k])=>'GATE_PENDING:'+k)
  return Object.freeze({
    reportId:'shadow-live-final:'+input.observedAt,
    observedAt:input.observedAt,
    passed:reasonCodes.length===0,
    gates,
    reasonCodes:Object.freeze(reasonCodes),
    authority:'CERTIFICATION_ONLY',
    canExecute:false,canSign:false,canBroadcast:false,canAuthorizeLive:false,
  })
}
