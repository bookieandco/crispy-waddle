import { createHash } from 'node:crypto'
import type { SportsLatentFactor } from './sports-correlated-monte-carlo.js'

export const NBA2K25_SLIDER_VIDEO_REFERENCE=Object.freeze({
  sourceUrl:'https://youtu.be/frB2eQ-_Vrs',
  sourceTitle:'NBA 2K25- CPU/Sliders Explanation/Discussion',
  publishedAt:'2025-06-13T16:26:32Z',
  sourceKind:'VIDEO_GAME_REFERENCE',
  calibrationEligible:false,
  realWorldTruth:false,
  use:'MECHANICS_TAXONOMY_AND_STRESS_TEST_REFERENCE_ONLY',
  authority:'REFERENCE_ONLY',
} as const)

export type BasketballEnvironmentProfile=Readonly<{
  profileId:string
  profileVersion:string
  competitionProfile:string
  observedAt:string
  paceBps:number
  fastPlayerSpeedBps:number
  slowPlayerSpeedBps:number
  fastPlayerAccelerationBps:number
  slowPlayerAccelerationBps:number
  staminaCapacityBps:number
  fatigueRateBps:number
  physicalContactSensitivityBps:number
  passSpeedBps:number
  onBallDefenseBps:number
  defensiveAwarenessBps:number
  defensiveConsistencyBps:number
  helpDefenseBps:number
  gatherContestImpactBps:number
  releaseContestImpactBps:number
  shootingFoulRateBps:number
  blockingFoulRateBps:number
  chargingFoulRateBps:number
  looseBallFoulRateBps:number
  illegalScreenFoulRateBps:number
  evidenceIds:readonly string[]
  sourceClass:'REAL_AS_OF'|'VIDEO_GAME_REFERENCE'|'SYNTHETIC_TEST'
  calibrationEligible:boolean
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

export type BasketballPlayerTendencyProfile=Readonly<{
  tendencyId:string
  playerId:string
  profileVersion:string
  observedAt:string
  insideShotBps:number
  closeShotBps:number
  midRangeShotBps:number
  threePointShotBps:number
  postShotBps:number
  rimAttackBps:number
  postUpSeekBps:number
  alleyOopPassBps:number
  dunkAttemptBps:number
  putbackAttemptBps:number
  backdoorCutBps:number
  transitionAttackBps:number
  hustleBps:number
  evidenceIds:readonly string[]
  sourceClass:'REAL_AS_OF'|'VIDEO_GAME_REFERENCE'|'SYNTHETIC_TEST'
  calibrationEligible:boolean
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

export type BasketballMechanicsBundle=Readonly<{
  bundleId:string
  environment:BasketballEnvironmentProfile
  playerTendencies:readonly BasketballPlayerTendencyProfile[]
  environmentFrozenBeforePlayerLayer:true
  videoGameReferenceCount:number
  realEvidenceCount:number
  calibrationEligible:boolean
  evidenceIds:readonly string[]
  authority:'SIMULATION_INPUT_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function assertBps(v:number,code:string):void{
  if(!Number.isInteger(v)||v<0||v>10000)throw new Error(code)
}
function assertTime(v:string,code:string):void{
  if(Number.isNaN(Date.parse(v)))throw new Error(code)
}

export function assertBasketballEnvironmentProfile(p:BasketballEnvironmentProfile):void{
  if(!p.profileId.trim()||!p.profileVersion.trim()||!p.competitionProfile.trim()||!p.evidenceIds.length)throw new Error('SPORT_SIM_BBALL_ENV_LINEAGE_REQUIRED')
  assertTime(p.observedAt,'SPORT_SIM_BBALL_ENV_TIME_INVALID')
  for(const [v,c] of [
    [p.paceBps,'SPORT_SIM_BBALL_PACE_INVALID'],
    [p.fastPlayerSpeedBps,'SPORT_SIM_BBALL_FAST_SPEED_INVALID'],
    [p.slowPlayerSpeedBps,'SPORT_SIM_BBALL_SLOW_SPEED_INVALID'],
    [p.fastPlayerAccelerationBps,'SPORT_SIM_BBALL_FAST_ACCEL_INVALID'],
    [p.slowPlayerAccelerationBps,'SPORT_SIM_BBALL_SLOW_ACCEL_INVALID'],
    [p.staminaCapacityBps,'SPORT_SIM_BBALL_STAMINA_INVALID'],
    [p.fatigueRateBps,'SPORT_SIM_BBALL_FATIGUE_INVALID'],
    [p.physicalContactSensitivityBps,'SPORT_SIM_BBALL_CONTACT_INVALID'],
    [p.passSpeedBps,'SPORT_SIM_BBALL_PASS_SPEED_INVALID'],
    [p.onBallDefenseBps,'SPORT_SIM_BBALL_ONBALL_INVALID'],
    [p.defensiveAwarenessBps,'SPORT_SIM_BBALL_DEF_AWARE_INVALID'],
    [p.defensiveConsistencyBps,'SPORT_SIM_BBALL_DEF_CONSIST_INVALID'],
    [p.helpDefenseBps,'SPORT_SIM_BBALL_HELP_DEF_INVALID'],
    [p.gatherContestImpactBps,'SPORT_SIM_BBALL_GATHER_CONTEST_INVALID'],
    [p.releaseContestImpactBps,'SPORT_SIM_BBALL_RELEASE_CONTEST_INVALID'],
    [p.shootingFoulRateBps,'SPORT_SIM_BBALL_SHOOTING_FOUL_INVALID'],
    [p.blockingFoulRateBps,'SPORT_SIM_BBALL_BLOCKING_FOUL_INVALID'],
    [p.chargingFoulRateBps,'SPORT_SIM_BBALL_CHARGING_FOUL_INVALID'],
    [p.looseBallFoulRateBps,'SPORT_SIM_BBALL_LOOSEBALL_FOUL_INVALID'],
    [p.illegalScreenFoulRateBps,'SPORT_SIM_BBALL_SCREEN_FOUL_INVALID'],
  ] as const)assertBps(v,c)
  if(p.sourceClass==='VIDEO_GAME_REFERENCE'&&p.calibrationEligible)throw new Error('SPORT_SIM_BBALL_GAME_REFERENCE_CANNOT_CALIBRATE')
  if(p.authority!=='SIMULATION_INPUT_ONLY'||p.canExecute!==false)throw new Error('SPORT_SIM_BBALL_ENV_AUTHORITY_INVALID')
}

export function assertBasketballPlayerTendencyProfile(p:BasketballPlayerTendencyProfile):void{
  if(!p.tendencyId.trim()||!p.playerId.trim()||!p.profileVersion.trim()||!p.evidenceIds.length)throw new Error('SPORT_SIM_BBALL_TENDENCY_LINEAGE_REQUIRED')
  assertTime(p.observedAt,'SPORT_SIM_BBALL_TENDENCY_TIME_INVALID')
  for(const [v,c] of [
    [p.insideShotBps,'SPORT_SIM_BBALL_INSIDE_INVALID'],
    [p.closeShotBps,'SPORT_SIM_BBALL_CLOSE_INVALID'],
    [p.midRangeShotBps,'SPORT_SIM_BBALL_MIDRANGE_INVALID'],
    [p.threePointShotBps,'SPORT_SIM_BBALL_THREE_INVALID'],
    [p.postShotBps,'SPORT_SIM_BBALL_POST_INVALID'],
    [p.rimAttackBps,'SPORT_SIM_BBALL_RIM_ATTACK_INVALID'],
    [p.postUpSeekBps,'SPORT_SIM_BBALL_POST_SEEK_INVALID'],
    [p.alleyOopPassBps,'SPORT_SIM_BBALL_ALLEY_INVALID'],
    [p.dunkAttemptBps,'SPORT_SIM_BBALL_DUNK_INVALID'],
    [p.putbackAttemptBps,'SPORT_SIM_BBALL_PUTBACK_INVALID'],
    [p.backdoorCutBps,'SPORT_SIM_BBALL_BACKDOOR_INVALID'],
    [p.transitionAttackBps,'SPORT_SIM_BBALL_TRANSITION_INVALID'],
    [p.hustleBps,'SPORT_SIM_BBALL_HUSTLE_INVALID'],
  ] as const)assertBps(v,c)
  if(p.sourceClass==='VIDEO_GAME_REFERENCE'&&p.calibrationEligible)throw new Error('SPORT_SIM_BBALL_GAME_REFERENCE_CANNOT_CALIBRATE')
  if(p.authority!=='SIMULATION_INPUT_ONLY'||p.canExecute!==false)throw new Error('SPORT_SIM_BBALL_TENDENCY_AUTHORITY_INVALID')
}

export function createBasketballMechanicsBundle(input:{
  environment:BasketballEnvironmentProfile
  playerTendencies:readonly BasketballPlayerTendencyProfile[]
}):BasketballMechanicsBundle{
  assertBasketballEnvironmentProfile(input.environment)
  const seen=new Set<string>()
  for(const p of input.playerTendencies){
    assertBasketballPlayerTendencyProfile(p)
    if(seen.has(p.playerId))throw new Error('SPORT_SIM_BBALL_DUPLICATE_PLAYER_TENDENCY')
    seen.add(p.playerId)
  }
  const all=[input.environment,...input.playerTendencies]
  const videoGameReferenceCount=all.filter(x=>x.sourceClass==='VIDEO_GAME_REFERENCE').length
  const realEvidenceCount=all.filter(x=>x.sourceClass==='REAL_AS_OF').length
  const calibrationEligible=
    videoGameReferenceCount===0
    && input.environment.calibrationEligible
    && input.playerTendencies.every(x=>x.calibrationEligible)
  return Object.freeze({
    bundleId:'basketball-mechanics:'+hash({
      env:input.environment.profileId,
      envVersion:input.environment.profileVersion,
      players:input.playerTendencies.map(p=>[p.playerId,p.profileVersion]).sort(),
    }),
    environment:input.environment,
    playerTendencies:Object.freeze([...input.playerTendencies]),
    environmentFrozenBeforePlayerLayer:true,
    videoGameReferenceCount,
    realEvidenceCount,
    calibrationEligible,
    evidenceIds:unique(all.flatMap(x=>x.evidenceIds)),
    authority:'SIMULATION_INPUT_ONLY',
    canExecute:false,
  })
}

function centered(v:number):number{return (v-5000)/5000}

export function basketballEnvironmentLatentFactors(
  environment:BasketballEnvironmentProfile,
):readonly SportsLatentFactor[]{
  assertBasketballEnvironmentProfile(environment)
  const make=(factorId:string,mean:number,evidenceIds:readonly string[]):SportsLatentFactor=>Object.freeze({
    factorId,
    mean,
    stdDev:environment.sourceClass==='REAL_AS_OF'?.2:.35,
    evidenceIds,
  })
  const defenseMean=(centered(environment.onBallDefenseBps)+centered(environment.defensiveAwarenessBps)+centered(environment.defensiveConsistencyBps))/3
  const movementMismatch=(centered(environment.fastPlayerSpeedBps)-centered(environment.slowPlayerSpeedBps)+centered(environment.fastPlayerAccelerationBps)-centered(environment.slowPlayerAccelerationBps))/2
  const contest=(centered(environment.gatherContestImpactBps)+centered(environment.releaseContestImpactBps))/2
  const foul=(centered(environment.shootingFoulRateBps)+centered(environment.blockingFoulRateBps)+centered(environment.chargingFoulRateBps))/3
  return Object.freeze([
    make('BBALL_PACE',centered(environment.paceBps),environment.evidenceIds),
    make('BBALL_MOVEMENT_MISMATCH',movementMismatch,environment.evidenceIds),
    make('BBALL_STAMINA',centered(environment.staminaCapacityBps)-centered(environment.fatigueRateBps),environment.evidenceIds),
    make('BBALL_CONTACT',centered(environment.physicalContactSensitivityBps),environment.evidenceIds),
    make('BBALL_PASS_SPEED',centered(environment.passSpeedBps),environment.evidenceIds),
    make('BBALL_DEFENSE',defenseMean,environment.evidenceIds),
    make('BBALL_HELP_DEFENSE',centered(environment.helpDefenseBps),environment.evidenceIds),
    make('BBALL_CONTEST',contest,environment.evidenceIds),
    make('BBALL_FOUL_ENVIRONMENT',foul,environment.evidenceIds),
  ])
}

export function basketballPlayerTendencyLatentFactors(
  tendency:BasketballPlayerTendencyProfile,
):readonly SportsLatentFactor[]{
  assertBasketballPlayerTendencyProfile(tendency)
  const ev=tendency.evidenceIds
  const make=(factorId:string,mean:number):SportsLatentFactor=>Object.freeze({
    factorId:factorId+':'+tendency.playerId,
    mean,
    stdDev:tendency.sourceClass==='REAL_AS_OF'?.2:.35,
    evidenceIds:ev,
  })
  return Object.freeze([
    make('BBALL_SHOT_RIM',centered(tendency.insideShotBps+tendency.closeShotBps>10000?10000:Math.round((tendency.insideShotBps+tendency.closeShotBps)/2))),
    make('BBALL_SHOT_MID',centered(tendency.midRangeShotBps)),
    make('BBALL_SHOT_THREE',centered(tendency.threePointShotBps)),
    make('BBALL_POST',centered(Math.round((tendency.postShotBps+tendency.postUpSeekBps)/2))),
    make('BBALL_RIM_ATTACK',centered(tendency.rimAttackBps)),
    make('BBALL_VERTICAL_ACTION',centered(Math.round((tendency.alleyOopPassBps+tendency.dunkAttemptBps+tendency.putbackAttemptBps)/3))),
    make('BBALL_BACKDOOR_CUT',centered(tendency.backdoorCutBps)),
    make('BBALL_TRANSITION_ATTACK',centered(tendency.transitionAttackBps)),
    make('BBALL_HUSTLE',centered(tendency.hustleBps)),
  ])
}
