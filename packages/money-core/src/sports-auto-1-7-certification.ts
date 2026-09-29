import {createHash} from 'node:crypto'

export const SPORT_AUTO_1_7_VERSION='SPORT-AUTO.1-7' as const

export type SportAuto1To7CaseName=
  |'historical-warehouse-point-in-time'
  |'historical-stats-feed-simulation-module'
  |'live-reality-bus-ordered'
  |'director-live-watch-inference-firewall'
  |'automatic-paper-league'
  |'paper-settlement-progressive-learning'
  |'durable-sports-memory'
  |'shark-style-thesis-reuse-no-authority'
  |'continuous-pregame-live-shadow'
  |'shadow-idempotency-and-settlement-review'
  |'director-authorized-frame-watcher-service'
  |'automatic-discovery-resolution-feedback-loop'
  |'restart-safe-paper-shadow-runtime-state'

export type SportAuto1To7CertificationCase=Readonly<{
  caseId:string
  name:SportAuto1To7CaseName
  passed:boolean
  evidenceIds:readonly string[]
}>

export type SportAuto1To7Certification=Readonly<{
  certificationId:string
  version:typeof SPORT_AUTO_1_7_VERSION
  cases:readonly SportAuto1To7CertificationCase[]
  softwarePassed:boolean
  completedStages:readonly ['SPORT-AUTO.1','SPORT-AUTO.2','SPORT-AUTO.3','SPORT-AUTO.4','SPORT-AUTO.5','SPORT-AUTO.6','SPORT-AUTO.7']
  status:'BLOCKED_SOFTWARE'|'SOFTWARE_COMPLETE_REAL_FORWARD_INPUTS_REQUIRED'
  realHistoricalBackfillRequired:boolean
  commissionedLiveFeedRequired:boolean
  realForwardShadowSoakRequired:boolean
  liveBettingAuthorityGranted:false
  productionAutonomousBettingEnabled:false
  canExecute:false
  blockers:readonly string[]
  authority:'CERTIFICATION_ONLY'
}>

export const SPORT_AUTO_REFERENCE_ADAPTATIONS=Object.freeze([
  Object.freeze({
    repository:'electronicarts/SimpleTeamSportsSimulator',
    adaptation:'compact state/action environment and seeded multi-agent simulation boundary',
    implementation:'sports live reality snapshots + simulation module registry',
    codeCopied:false,
  }),
  Object.freeze({
    repository:'softwaredeveloperca/sportsimulator',
    adaptation:'data-driven per-sport module interface instead of one hard-coded sport engine',
    implementation:'SportsSimulationModuleSpec and registry',
    codeCopied:false,
  }),
  Object.freeze({
    repository:'KoalaColo99/Curling-Ice-Lab',
    adaptation:'Monte Carlo uncertainty, tunable control surfaces, and replayable outcome logging',
    implementation:'scenario sliders + historical base outcomes + paper/shadow episode logs',
    codeCopied:false,
  }),
] as const)

const REQUIRED:readonly SportAuto1To7CaseName[]=Object.freeze([
  'historical-warehouse-point-in-time',
  'historical-stats-feed-simulation-module',
  'live-reality-bus-ordered',
  'director-live-watch-inference-firewall',
  'automatic-paper-league',
  'paper-settlement-progressive-learning',
  'durable-sports-memory',
  'shark-style-thesis-reuse-no-authority',
  'continuous-pregame-live-shadow',
  'shadow-idempotency-and-settlement-review',
  'director-authorized-frame-watcher-service',
  'automatic-discovery-resolution-feedback-loop',
  'restart-safe-paper-shadow-runtime-state',
])

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values)].sort())

export function certifySportAuto1To7(input:{
  cases:readonly SportAuto1To7CertificationCase[]
  realHistoricalBackfillPresent?:boolean
  commissionedLiveFeedPresent?:boolean
  realForwardShadowSoakPresent?:boolean
}):SportAuto1To7Certification{
  const passedNames=new Set(input.cases.filter(item=>item.passed).map(item=>item.name))
  const softwarePassed=REQUIRED.every(name=>passedNames.has(name))&&input.cases.every(item=>item.passed&&item.evidenceIds.length>0)
  const realHistoricalBackfillRequired=input.realHistoricalBackfillPresent!==true
  const commissionedLiveFeedRequired=input.commissionedLiveFeedPresent!==true
  const realForwardShadowSoakRequired=input.realForwardShadowSoakPresent!==true
  const blockers:string[]=[]
  if(!softwarePassed)blockers.push('SPORT_AUTO_1_7_SOFTWARE_INCOMPLETE')
  if(realHistoricalBackfillRequired)blockers.push('REAL_HISTORICAL_BACKFILL_REQUIRED')
  if(commissionedLiveFeedRequired)blockers.push('COMMISSIONED_LIVE_SPORTS_FEED_REQUIRED')
  if(realForwardShadowSoakRequired)blockers.push('REAL_AS_OF_CONTINUOUS_SHADOW_SOAK_REQUIRED')
  return Object.freeze({
    certificationId:'sport-auto-1-7:'+hash({cases:input.cases,realHistoricalBackfillRequired,commissionedLiveFeedRequired,realForwardShadowSoakRequired}),
    version:SPORT_AUTO_1_7_VERSION,
    cases:Object.freeze([...input.cases]),
    softwarePassed,
    completedStages:Object.freeze(['SPORT-AUTO.1','SPORT-AUTO.2','SPORT-AUTO.3','SPORT-AUTO.4','SPORT-AUTO.5','SPORT-AUTO.6','SPORT-AUTO.7'] as const),
    status:softwarePassed?'SOFTWARE_COMPLETE_REAL_FORWARD_INPUTS_REQUIRED':'BLOCKED_SOFTWARE',
    realHistoricalBackfillRequired,
    commissionedLiveFeedRequired,
    realForwardShadowSoakRequired,
    liveBettingAuthorityGranted:false,
    productionAutonomousBettingEnabled:false,
    canExecute:false,
    blockers:unique(blockers),
    authority:'CERTIFICATION_ONLY',
  })
}
