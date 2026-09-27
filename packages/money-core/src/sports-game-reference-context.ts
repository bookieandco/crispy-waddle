import { createHash } from 'node:crypto'

export const FC25_LIVE_EDITOR_REFERENCE=Object.freeze({
  repository:'https://github.com/xAranaktu/FC-25-Live-Editor',
  auditedCommit:'0c012a7b4abfeff085de3d9b96cee594646aec9f',
  license:'GPL-3.0',
  archived:true,
  codeImportAllowed:false,
  use:'SOCCER_GAME_STATE_AND_STRESS_TEST_CONCEPT_REFERENCE_ONLY',
  authority:'REFERENCE_ONLY',
} as const)

export const LOCKDOWN_BOXER_REFERENCE=Object.freeze({
  repository:'https://github.com/kuntal-bhusan/lockdown_boxer',
  auditedCommit:'504cee57dd5e86fa072fe543279d5211f90da0cd',
  license:'NO_LICENSE_DETECTED',
  archived:false,
  codeImportAllowed:false,
  use:'BOXING_POSE_AND_MOTION_CONCEPT_REFERENCE_ONLY',
  authority:'REFERENCE_ONLY',
} as const)

export type SoccerVideoGameReferenceProfile=Readonly<{
  profileId:string
  gameVersion:string
  playerId:string
  position?:string
  formationRole?:string
  squadRole?:string
  overall?:number
  form?:number
  sharpness?:number
  morale?:number
  fitness?:number
  playstyleTags:readonly string[]
  startingXi?:boolean
  observedAt:string
  evidenceIds:readonly string[]
  sourceClass:'VIDEO_GAME_REFERENCE'
  realWorldTruth:false
  calibrationEligible:false
  stressTestOnly:true
  authority:'CONTEXT_ONLY'
  canExecute:false
}>

export type BoxingPosePoint=Readonly<{
  x:number
  y:number
  confidence:number
}>

export type BoxingPoseFrame=Readonly<{
  frameId:string
  athleteId:string
  observedAt:string
  leftShoulder:BoxingPosePoint
  rightShoulder:BoxingPosePoint
  leftWrist:BoxingPosePoint
  rightWrist:BoxingPosePoint
  evidenceIds:readonly string[]
}>

export type BoxingPunchCandidate=Readonly<{
  candidateId:string
  athleteId:string
  side:'LEFT'|'RIGHT'
  observedAt:string
  wristSpeedPerSecond:number
  crossedAboveShoulder:boolean
  confidence:number
  classification:'PUNCH_CANDIDATE'
  landedPunch:false
  scoringPunch:false
  authority:'INFERRED_VISUAL_EVIDENCE_ONLY'
  canExecute:false
  evidenceIds:readonly string[]
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const unit=(v:number,c:string)=>{if(!Number.isFinite(v)||v<0||v>1)throw new Error(c)}

export function assertSoccerVideoGameReferenceProfile(p:SoccerVideoGameReferenceProfile):void{
  if(!p.profileId.trim()||!p.gameVersion.trim()||!p.playerId.trim()||!p.evidenceIds.length)throw new Error('SPORT_SIM_FC25_PROFILE_LINEAGE_REQUIRED')
  if(Number.isNaN(Date.parse(p.observedAt)))throw new Error('SPORT_SIM_FC25_PROFILE_TIME_INVALID')
  for(const [value,code] of [
    [p.overall,'SPORT_SIM_FC25_OVERALL_INVALID'],
    [p.form,'SPORT_SIM_FC25_FORM_INVALID'],
    [p.sharpness,'SPORT_SIM_FC25_SHARPNESS_INVALID'],
    [p.morale,'SPORT_SIM_FC25_MORALE_INVALID'],
    [p.fitness,'SPORT_SIM_FC25_FITNESS_INVALID'],
  ] as const){
    if(value!==undefined&&(!Number.isFinite(value)||value<0||value>100))throw new Error(code)
  }
  if(p.sourceClass!=='VIDEO_GAME_REFERENCE'||p.realWorldTruth!==false||p.calibrationEligible!==false||p.stressTestOnly!==true||p.authority!=='CONTEXT_ONLY'||p.canExecute!==false)throw new Error('SPORT_SIM_FC25_PROFILE_AUTHORITY_INVALID')
}

function assertPoint(p:BoxingPosePoint):void{
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('SPORT_SIM_BOXING_POSE_COORDINATE_INVALID')
  unit(p.confidence,'SPORT_SIM_BOXING_POSE_CONFIDENCE_INVALID')
}

function pointSpeed(a:BoxingPosePoint,b:BoxingPosePoint,dtSeconds:number):number{
  return Math.hypot(b.x-a.x,b.y-a.y)/dtSeconds
}

export function detectBoxingPunchCandidates(input:{
  previous:BoxingPoseFrame
  current:BoxingPoseFrame
  minimumConfidence:number
  minimumWristSpeedPerSecond:number
}):readonly BoxingPunchCandidate[]{
  if(input.previous.athleteId!==input.current.athleteId)throw new Error('SPORT_SIM_BOXING_POSE_ATHLETE_MISMATCH')
  const t0=Date.parse(input.previous.observedAt),t1=Date.parse(input.current.observedAt)
  if(Number.isNaN(t0)||Number.isNaN(t1)||t1<=t0)throw new Error('SPORT_SIM_BOXING_POSE_TIME_INVALID')
  unit(input.minimumConfidence,'SPORT_SIM_BOXING_POSE_MIN_CONFIDENCE_INVALID')
  if(!Number.isFinite(input.minimumWristSpeedPerSecond)||input.minimumWristSpeedPerSecond<=0)throw new Error('SPORT_SIM_BOXING_POSE_SPEED_THRESHOLD_INVALID')
  if(!input.previous.evidenceIds.length||!input.current.evidenceIds.length)throw new Error('SPORT_SIM_BOXING_POSE_EVIDENCE_REQUIRED')
  for(const p of [input.previous.leftShoulder,input.previous.rightShoulder,input.previous.leftWrist,input.previous.rightWrist,input.current.leftShoulder,input.current.rightShoulder,input.current.leftWrist,input.current.rightWrist])assertPoint(p)
  const dt=(t1-t0)/1000
  const pairs=[
    {side:'LEFT' as const,prevWrist:input.previous.leftWrist,currWrist:input.current.leftWrist,prevShoulder:input.previous.leftShoulder,currShoulder:input.current.leftShoulder},
    {side:'RIGHT' as const,prevWrist:input.previous.rightWrist,currWrist:input.current.rightWrist,prevShoulder:input.previous.rightShoulder,currShoulder:input.current.rightShoulder},
  ]
  const candidates:BoxingPunchCandidate[]=[]
  for(const pair of pairs){
    const confidence=Math.min(pair.currWrist.confidence,pair.currShoulder.confidence)
    const previouslyAbove=pair.prevWrist.y<pair.prevShoulder.y
    const nowAbove=pair.currWrist.y<pair.currShoulder.y
    const crossedAboveShoulder=!previouslyAbove&&nowAbove
    const speed=pointSpeed(pair.prevWrist,pair.currWrist,dt)
    if(confidence<input.minimumConfidence||!crossedAboveShoulder||speed<input.minimumWristSpeedPerSecond)continue
    candidates.push(Object.freeze({
      candidateId:'boxing-punch-candidate:'+hash({athleteId:input.current.athleteId,side:pair.side,frame:input.current.frameId}),
      athleteId:input.current.athleteId,
      side:pair.side,
      observedAt:input.current.observedAt,
      wristSpeedPerSecond:speed,
      crossedAboveShoulder:true,
      confidence,
      classification:'PUNCH_CANDIDATE',
      landedPunch:false,
      scoringPunch:false,
      authority:'INFERRED_VISUAL_EVIDENCE_ONLY',
      canExecute:false,
      evidenceIds:unique([...input.previous.evidenceIds,...input.current.evidenceIds]),
    }))
  }
  return Object.freeze(candidates)
}
