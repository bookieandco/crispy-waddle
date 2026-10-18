import type {
  AlphaMintSocialComparison,AlphaSourceHealth,
  AlphaCohortReport,AlphaProspectiveBaselineReport,
} from '@jhadina/shark-intelligence-core/meme-trader'

const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ALLOWED=['X','REDDIT','BLUESKY'] as const
const isObj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const iso=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s))
export type AlphaBoardSource=Readonly<{
  platform:'X'|'REDDIT'|'BLUESKY'
  status:'OK'|'PARTIAL'|'DENIED'|'FAILED'|'NOT_CONNECTED'
  captures:number
  postsAdmitted:number
  coverage:'UNKNOWN_NOT_ALL_PLATFORM_POSTS'
}>
export type AlphaBoardCandidate=Readonly<{
  mint:string
  chainEventId:string
  matchCount:number
  independentOriginCount:number
  duplicateRisk:'LOW'|'MEDIUM'|'HIGH'|'NO_SOCIAL_EVIDENCE'
  firstAvailabilityLeadMs?:number
  timing:'SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT'|'CHAIN_RECEIPT_FIRST'|'NO_SOCIAL_EVIDENCE'
  retrospectiveOnly:boolean
  canAuthorizeTrade:false
}>
export type AlphaBoardEvaluation=Readonly<{
 observedLaunches:number
 eligibleProspectiveLaunches:number
 markedPriceOnlyOutcomes:number
 missedPriceOnly2x:number
 censoredOutcomes:number
 baselineCohort:number
 pairedPriceOnlyMarks:number
 coverage:'UNKNOWN_INCOMPLETE'
 executableProfitsVerified:false
 canTrade:false
}>
export type AlphaBoardSnapshot=Readonly<{
  schema:'SHARK_ALPHA_BOARD_V1'
  generatedAt:string
  mode:'LOCAL_OWNER_RESEARCH_ONLY'
  sources:readonly AlphaBoardSource[]
  candidates:readonly AlphaBoardCandidate[]
  evaluation?:AlphaBoardEvaluation
  persistence:'BROWSER_SESSION_ONLY'
  coverage:'INCOMPLETE'
  verifiedLiveDelivery:false
  executableProfitsVerified:false
  canAuthorizeTrade:false
}>
/** Serialize only aggregate source health, mint matches and timestamps,
 * never social post text, Telegram identities, credentials, private chat data,
 * wallet secrets or individual social author handles. */
export function buildAlphaBoardSnapshot(input:Readonly<{
  generatedAt:string
  sourceHealth:readonly AlphaSourceHealth[]
  comparisons:readonly AlphaMintSocialComparison[]
  cohort?:AlphaCohortReport
  baselines?:AlphaProspectiveBaselineReport
}>):AlphaBoardSnapshot{
 if(!iso(input.generatedAt)||input.sourceHealth.length>20||input.comparisons.length>100)
   throw new Error('shark_alpha_board_input_invalid')
 if(Boolean(input.cohort)!==Boolean(input.baselines))throw new Error('shark_alpha_board_evaluation_pair_required')
 if(input.cohort&&input.baselines&&(
   input.cohort.asOf>input.generatedAt||input.baselines.asOf>input.generatedAt||
   input.cohort.eligibleProspectiveLaunches!==input.baselines.cohortMintCount||
   input.cohort.canTrade!==false||input.baselines.canTrade!==false||
   input.baselines.executablePnlVerified!==false
 ))throw new Error('shark_alpha_board_evaluation_invalid')
 const evaluation:AlphaBoardEvaluation|undefined=input.cohort&&input.baselines?Object.freeze({
  observedLaunches:input.cohort.observedLaunches,
  eligibleProspectiveLaunches:input.cohort.eligibleProspectiveLaunches,
  markedPriceOnlyOutcomes:input.cohort.markedOutcomeCoverage,
  missedPriceOnly2x:input.cohort.missedMarkedUp2xCount,
  censoredOutcomes:input.cohort.missingOrCensored,
  baselineCohort:input.baselines.cohortMintCount,
  pairedPriceOnlyMarks:input.baselines.comparablePairedPriceMarks,
  coverage:'UNKNOWN_INCOMPLETE' as const,
  executableProfitsVerified:false as const,canTrade:false as const,
 }):undefined
 return Object.freeze({
  schema:'SHARK_ALPHA_BOARD_V1' as const,generatedAt:input.generatedAt,
  mode:'LOCAL_OWNER_RESEARCH_ONLY' as const,
  sources:Object.freeze(input.sourceHealth
    .filter(s=>(ALLOWED as readonly string[]).includes(s.platform))
    .map(s=>Object.freeze({
      platform:s.platform as AlphaBoardSource['platform'],
      status:s.status,captures:s.captures,postsAdmitted:s.postsAdmitted,coverage:s.coverage,
    }))),
  candidates:Object.freeze(input.comparisons.map(c=>Object.freeze({
    mint:c.mint,chainEventId:c.chainEventId,matchCount:c.matchCount,
    independentOriginCount:c.independentOriginCount,duplicateRisk:c.duplicateRisk,
    firstAvailabilityLeadMs:c.firstAvailabilityLeadMs,
    timing:c.timing,retrospectiveOnly:c.retrospectiveOnly,canAuthorizeTrade:false as const,
  }))),
  evaluation,
  persistence:'BROWSER_SESSION_ONLY' as const,coverage:'INCOMPLETE' as const,
  verifiedLiveDelivery:false as const,executableProfitsVerified:false as const,
  canAuthorizeTrade:false as const,
 })
}
export function parseAlphaBoardSnapshot(input:unknown):AlphaBoardSnapshot{
 if(!isObj(input)||input.schema!=='SHARK_ALPHA_BOARD_V1'||!iso(input.generatedAt)||
    input.mode!=='LOCAL_OWNER_RESEARCH_ONLY'||input.persistence!=='BROWSER_SESSION_ONLY'||
    input.coverage!=='INCOMPLETE'||input.verifiedLiveDelivery!==false||
    input.executableProfitsVerified!==false||input.canAuthorizeTrade!==false||
    !Array.isArray(input.sources)||input.sources.length>20||
    !Array.isArray(input.candidates)||input.candidates.length>100)
   throw new Error('shark_alpha_board_schema_invalid')
 const sources:AlphaBoardSource[]=input.sources.map((v:unknown)=>{
   if(!isObj(v)||!ALLOWED.includes(v.platform as AlphaBoardSource['platform'])||
     !['OK','PARTIAL','DENIED','FAILED','NOT_CONNECTED'].includes(String(v.status))||
     !Number.isSafeInteger(v.captures)||Number(v.captures)<0||
     !Number.isSafeInteger(v.postsAdmitted)||Number(v.postsAdmitted)<0||
     v.coverage!=='UNKNOWN_NOT_ALL_PLATFORM_POSTS')
     throw new Error('shark_alpha_board_source_invalid')
   return Object.freeze({
     platform:v.platform as AlphaBoardSource['platform'],
     status:v.status as AlphaBoardSource['status'],captures:Number(v.captures),
     postsAdmitted:Number(v.postsAdmitted),
     coverage:'UNKNOWN_NOT_ALL_PLATFORM_POSTS' as const,
   })
 })
 let evaluation:AlphaBoardEvaluation|undefined
 if(input.evaluation!==undefined){
   const e=input.evaluation
   if(!isObj(e)||![
    e.observedLaunches,e.eligibleProspectiveLaunches,e.markedPriceOnlyOutcomes,
    e.missedPriceOnly2x,e.censoredOutcomes,e.baselineCohort,e.pairedPriceOnlyMarks,
   ].every(v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)||
     Number(e.eligibleProspectiveLaunches)>Number(e.observedLaunches)||
     Number(e.markedPriceOnlyOutcomes)+Number(e.censoredOutcomes)>Number(e.eligibleProspectiveLaunches)||
     Number(e.missedPriceOnly2x)>Number(e.markedPriceOnlyOutcomes)||
     Number(e.baselineCohort)!==Number(e.eligibleProspectiveLaunches)||
     Number(e.pairedPriceOnlyMarks)>Number(e.baselineCohort)||
     e.coverage!=='UNKNOWN_INCOMPLETE'||e.executableProfitsVerified!==false||e.canTrade!==false)
       throw new Error('shark_alpha_board_evaluation_invalid')
   evaluation=Object.freeze({
     observedLaunches:Number(e.observedLaunches),
     eligibleProspectiveLaunches:Number(e.eligibleProspectiveLaunches),
     markedPriceOnlyOutcomes:Number(e.markedPriceOnlyOutcomes),
     missedPriceOnly2x:Number(e.missedPriceOnly2x),
     censoredOutcomes:Number(e.censoredOutcomes),
     baselineCohort:Number(e.baselineCohort),
     pairedPriceOnlyMarks:Number(e.pairedPriceOnlyMarks),
     coverage:'UNKNOWN_INCOMPLETE' as const,
     executableProfitsVerified:false as const,canTrade:false as const,
   })
 }
 const seen=new Set<string>()
 const candidates:AlphaBoardCandidate[]=input.candidates.map((v:unknown)=>{
   if(!isObj(v)||typeof v.mint!=='string'||!BASE58.test(v.mint)||
     typeof v.chainEventId!=='string'||v.chainEventId.length>200||!v.chainEventId.trim()||
     !Number.isSafeInteger(v.matchCount)||Number(v.matchCount)<0||
     !Number.isSafeInteger(v.independentOriginCount)||Number(v.independentOriginCount)<0||
     Number(v.independentOriginCount)>Number(v.matchCount)||
     !['LOW','MEDIUM','HIGH','NO_SOCIAL_EVIDENCE'].includes(String(v.duplicateRisk))||
     !['SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT','CHAIN_RECEIPT_FIRST','NO_SOCIAL_EVIDENCE'].includes(String(v.timing))||
     typeof v.retrospectiveOnly!=='boolean'||v.canAuthorizeTrade!==false||
     (v.firstAvailabilityLeadMs!==undefined&&(
       typeof v.firstAvailabilityLeadMs!=='number'||!Number.isFinite(v.firstAvailabilityLeadMs)
     ))||seen.has(v.mint))
     throw new Error('shark_alpha_board_candidate_invalid')
   seen.add(v.mint)
   return Object.freeze({
     mint:v.mint,chainEventId:v.chainEventId,
     matchCount:Number(v.matchCount),independentOriginCount:Number(v.independentOriginCount),
     duplicateRisk:v.duplicateRisk as AlphaBoardCandidate['duplicateRisk'],
     firstAvailabilityLeadMs:v.firstAvailabilityLeadMs as number|undefined,
     timing:v.timing as AlphaBoardCandidate['timing'],
     retrospectiveOnly:v.retrospectiveOnly,canAuthorizeTrade:false as const,
   })
 })
 return Object.freeze({
   schema:'SHARK_ALPHA_BOARD_V1' as const,generatedAt:input.generatedAt,
   mode:'LOCAL_OWNER_RESEARCH_ONLY' as const,
   sources:Object.freeze(sources),candidates:Object.freeze(candidates),evaluation,
   persistence:'BROWSER_SESSION_ONLY' as const,coverage:'INCOMPLETE' as const,
   verifiedLiveDelivery:false as const,executableProfitsVerified:false as const,
   canAuthorizeTrade:false as const,
 })
}
