export type AmericanFootballCoverageShell='TWO_HIGH'|'SINGLE_HIGH'|'COVER_3'|'COVER_2'|'MAN'|'ZONE_OTHER'
export type SoccerLineupStatus='PROJECTED_STARTER'|'CONFIRMED_STARTER'|'BENCH'|'OUT'|'UNKNOWN'
export type SoccerSetPieceDuty='NONE'|'CORNERS'|'FREE_KICKS'|'PENALTIES'|'MULTIPLE'|'UNKNOWN'

export type AmericanFootballMatchupContext=Readonly<{
  contextId:string
  eventId:string
  playerId:string
  coverageRatesBps:Readonly<Partial<Record<AmericanFootballCoverageShell,number>>>
  yardsPerRouteRunByCoverage:Readonly<Partial<Record<AmericanFootballCoverageShell,number>>>
  routeParticipationBps:number
  snapShareBps:number
  targetShareBps?:number
  firstReadShareBps?:number
  expectedCarryShareBps?:number
  observedAt:string
  informationCutoff:string
  evidenceIds:readonly string[]
  authority:'SPECIALIST_CONTEXT_ONLY'
  canExecute:false
}>

export type SoccerPlayerRoleContext=Readonly<{
  contextId:string
  eventId:string
  playerId:string
  lineupStatus:SoccerLineupStatus
  formationRole:string
  projectedMinutes:number
  substitutionRiskBps:number
  expectedTeamPossessionBps:number
  setPieceDuty:SoccerSetPieceDuty
  shotsPer90?:number
  passesPer90?:number
  defensiveActionsPer90?:number
  observedAt:string
  informationCutoff:string
  evidenceIds:readonly string[]
  authority:'SPECIALIST_CONTEXT_ONLY'
  canExecute:false
}>

const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const bps=(v:number|undefined,c:string)=>{if(v!==undefined&&(!Number.isInteger(v)||v<0||v>10000))throw new Error(c)}
const rate=(v:number|undefined,c:string)=>{if(v!==undefined&&(!Number.isFinite(v)||v<0))throw new Error(c)}
const instant=(v:string,c:string)=>{nonEmpty(v,c);const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}

export function assertAmericanFootballMatchupContext(c:AmericanFootballMatchupContext):void{
  nonEmpty(c.contextId,'SPORT_PRED_NFL_CONTEXT_ID_REQUIRED')
  nonEmpty(c.eventId,'SPORT_PRED_NFL_EVENT_REQUIRED')
  nonEmpty(c.playerId,'SPORT_PRED_NFL_PLAYER_REQUIRED')
  bps(c.routeParticipationBps,'SPORT_PRED_NFL_ROUTE_PARTICIPATION_INVALID')
  bps(c.snapShareBps,'SPORT_PRED_NFL_SNAP_SHARE_INVALID')
  bps(c.targetShareBps,'SPORT_PRED_NFL_TARGET_SHARE_INVALID')
  bps(c.firstReadShareBps,'SPORT_PRED_NFL_FIRST_READ_SHARE_INVALID')
  bps(c.expectedCarryShareBps,'SPORT_PRED_NFL_CARRY_SHARE_INVALID')
  const coverageValues=Object.values(c.coverageRatesBps)
  for(const value of coverageValues)bps(value,'SPORT_PRED_NFL_COVERAGE_RATE_INVALID')
  const coverageTotal=coverageValues.reduce((sum,value)=>sum+(value??0),0)
  if(coverageTotal!==10000)throw new Error('SPORT_PRED_NFL_COVERAGE_RATES_MUST_SUM_TO_10000')
  for(const value of Object.values(c.yardsPerRouteRunByCoverage))rate(value,'SPORT_PRED_NFL_YPRR_INVALID')
  if(instant(c.observedAt,'SPORT_PRED_NFL_OBSERVED_AT_INVALID')>instant(c.informationCutoff,'SPORT_PRED_NFL_CUTOFF_INVALID'))throw new Error('SPORT_PRED_NFL_CONTEXT_AFTER_CUTOFF')
  if(!c.evidenceIds.length)throw new Error('SPORT_PRED_NFL_CONTEXT_EVIDENCE_REQUIRED')
  if(c.authority!=='SPECIALIST_CONTEXT_ONLY'||c.canExecute!==false)throw new Error('SPORT_PRED_NFL_CONTEXT_AUTHORITY_INVALID')
}

export function assertSoccerPlayerRoleContext(c:SoccerPlayerRoleContext):void{
  nonEmpty(c.contextId,'SPORT_PRED_SOCCER_CONTEXT_ID_REQUIRED')
  nonEmpty(c.eventId,'SPORT_PRED_SOCCER_EVENT_REQUIRED')
  nonEmpty(c.playerId,'SPORT_PRED_SOCCER_PLAYER_REQUIRED')
  nonEmpty(c.formationRole,'SPORT_PRED_SOCCER_FORMATION_ROLE_REQUIRED')
  if(!Number.isFinite(c.projectedMinutes)||c.projectedMinutes<0||c.projectedMinutes>130)throw new Error('SPORT_PRED_SOCCER_PROJECTED_MINUTES_INVALID')
  bps(c.substitutionRiskBps,'SPORT_PRED_SOCCER_SUB_RISK_INVALID')
  bps(c.expectedTeamPossessionBps,'SPORT_PRED_SOCCER_POSSESSION_INVALID')
  rate(c.shotsPer90,'SPORT_PRED_SOCCER_SHOTS_PER90_INVALID')
  rate(c.passesPer90,'SPORT_PRED_SOCCER_PASSES_PER90_INVALID')
  rate(c.defensiveActionsPer90,'SPORT_PRED_SOCCER_DEF_ACTIONS_PER90_INVALID')
  if(c.lineupStatus==='OUT'&&c.projectedMinutes!==0)throw new Error('SPORT_PRED_SOCCER_OUT_PLAYER_MINUTES_NONZERO')
  if(c.lineupStatus==='BENCH'&&c.projectedMinutes>=90)throw new Error('SPORT_PRED_SOCCER_BENCH_MINUTES_IMPLAUSIBLE')
  if(instant(c.observedAt,'SPORT_PRED_SOCCER_OBSERVED_AT_INVALID')>instant(c.informationCutoff,'SPORT_PRED_SOCCER_CUTOFF_INVALID'))throw new Error('SPORT_PRED_SOCCER_CONTEXT_AFTER_CUTOFF')
  if(!c.evidenceIds.length)throw new Error('SPORT_PRED_SOCCER_CONTEXT_EVIDENCE_REQUIRED')
  if(c.authority!=='SPECIALIST_CONTEXT_ONLY'||c.canExecute!==false)throw new Error('SPORT_PRED_SOCCER_CONTEXT_AUTHORITY_INVALID')
}
