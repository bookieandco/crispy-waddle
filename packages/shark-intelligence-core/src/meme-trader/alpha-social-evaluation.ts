import {
 assessExternalSignalIndependence,
 type ExternalSignalIndependenceAssessment,
} from './external-signal-independence'
import type {ExternalSignalObservation,ExternalSignalPlatform} from './external-signal-ingest'
import type {AlphaEvidenceV2} from './alpha-evidence-v2'

export type AlphaSocialResearchSignal=ExternalSignalObservation&Readonly<{provenance:AlphaEvidenceV2}>
export type AlphaSourceHealthReceipt=Readonly<{
 platform:ExternalSignalPlatform
 capturedAt:string
 status:'OK'|'PARTIAL'|'DENIED'|'FAILED'|'NOT_CONNECTED'
 requested:number
 admitted:number
 ignored:number
 accessEvidenceIds:readonly string[]
}>
export type AlphaSourceHealth=Readonly<{
 platform:ExternalSignalPlatform
 lastCheckedAt?:string
 status:'OK'|'PARTIAL'|'DENIED'|'FAILED'|'NOT_CONNECTED'
 captures:number
 postsRequested:number
 postsAdmitted:number
 postsIgnored:number
 acceptanceRate?:number
 coverage:'UNKNOWN_NOT_ALL_PLATFORM_POSTS'
 sampleSize:number
 evidenceIds:readonly string[]
 authority:'DESCRIPTIVE_ONLY'
 canTrade:false
}>
const timestamp=(s:string)=>Number.isFinite(Date.parse(s))
export function summarizeAlphaSourceHealth(
 platform:ExternalSignalPlatform,receipts:readonly AlphaSourceHealthReceipt[],
):AlphaSourceHealth{
 if(receipts.length>1000)throw new Error('alpha_source_health_too_many')
 const own=receipts.filter(x=>x.platform===platform)
 for(const x of own){
  if(!timestamp(x.capturedAt)||![x.requested,x.admitted,x.ignored].every(Number.isSafeInteger)||
     x.requested<0||x.admitted<0||x.ignored<0||x.admitted+x.ignored>x.requested)
    throw new Error('alpha_source_health_receipt_invalid')
 }
 const recent=[...own].sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt))[0]
 const requested=own.reduce((sum,x)=>sum+x.requested,0)
 const admitted=own.reduce((sum,x)=>sum+x.admitted,0)
 const ignored=own.reduce((sum,x)=>sum+x.ignored,0)
 return Object.freeze({
  platform,lastCheckedAt:recent?.capturedAt,status:recent?.status??'NOT_CONNECTED',
  captures:own.length,postsRequested:requested,postsAdmitted:admitted,postsIgnored:ignored,
  acceptanceRate:requested?admitted/requested:undefined,
  coverage:'UNKNOWN_NOT_ALL_PLATFORM_POSTS' as const,
  sampleSize:admitted,
  evidenceIds:Object.freeze([...new Set(own.flatMap(x=>x.accessEvidenceIds))].sort()),
  authority:'DESCRIPTIVE_ONLY' as const,canTrade:false as const,
 })
}
export type AlphaOnchainCreateEvidence=Readonly<{
 mint:string
 eventId:string
 signature:string
 observedAt:string
 availableAt:string
 evidenceIds:readonly string[]
 eventKind:'PUMP_CREATE_EVENT'
 mode:'LIVE'|'RETROSPECTIVE'
}>
export type AlphaJoinedMention=Readonly<{
 sourceId:string
 platform:ExternalSignalPlatform
 sourceHandle:string
 publishedAt:string
 availableAt:string
 relativeToChainAvailabilityMs:number
 evidenceIds:readonly string[]
}>
export type AlphaMintSocialComparison=Readonly<{
 mint:string
 chainEventId:string
 asOf:string
 matchCount:number
 independentOriginCount:number
 duplicateRisk:'LOW'|'MEDIUM'|'HIGH'|'NO_SOCIAL_EVIDENCE'
 earliestSocialAvailableAt?:string
 firstAvailabilityLeadMs?:number
 timing:'SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT'|'CHAIN_RECEIPT_FIRST'|'NO_SOCIAL_EVIDENCE'
 retrospectiveOnly:boolean
 caveats:readonly string[]
 mentions:readonly AlphaJoinedMention[]
 sourceIndependence?:ExternalSignalIndependenceAssessment
 authority:'RESEARCH_ONLY'
 canAuthorizeTrade:false
 canAutoCopy:false
}>
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/** Availability comparison is NOT executable alpha, price evidence, on-chain
 * finality, or an assertion that a third party knew a mint before launch.
 * Compare only exact candidate addresses against one admitted Pump CreateEvent.
 */
export function compareAlphaSocialWithPumpCreate(input:Readonly<{
 chain:AlphaOnchainCreateEvidence
 signals:readonly AlphaSocialResearchSignal[]
 asOf:string
}>):AlphaMintSocialComparison{
 const {chain,signals,asOf}=input
 if(!BASE58.test(chain.mint)||!chain.eventId.trim()||!chain.signature.trim()||
    !timestamp(chain.observedAt)||!timestamp(chain.availableAt)||!timestamp(asOf)||
    Date.parse(chain.availableAt)<Date.parse(chain.observedAt)||
    Date.parse(asOf)<Date.parse(chain.availableAt)||!chain.evidenceIds.length||
    chain.eventKind!=='PUMP_CREATE_EVENT'||signals.length>500)
   throw new Error('alpha_social_onchain_evidence_invalid')
 const cut=Date.parse(asOf)
 const joined=signals.filter(signal=>{
  if(signal.authority!=='EVIDENCE_ONLY'||signal.canAuthorizeTrade!==false||
     signal.provenance.schemaVersion!=='SHARK_ALPHA_EVIDENCE_V2'||
     signal.provenance.sourceFamily!=='SOCIAL'||signal.provenance.availableAt!==signal.availableAt||
     Date.parse(signal.availableAt)>cut||
     !signal.candidates.some(candidate=>candidate.kind==='SOLANA_ADDRESS'&&candidate.value===chain.mint))
     return false
  return true
 }).sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.observationId.localeCompare(b.observationId))
 const nodes=joined.map(signal=>({
  sourceId:signal.observationId,platform:signal.platform,
  sourceFamilyId:signal.platform+':'+signal.sourceHandle,
  upstreamOriginId:signal.provenance.originalEventId,
  contentFingerprint:signal.provenance.contentFingerprint,
  evidenceIds:[signal.observationId,...signal.provenance.evidenceIds],
 }))
 const independent=nodes.length?assessExternalSignalIndependence(nodes):undefined
 const first=joined[0]
 const lead=first?Date.parse(chain.availableAt)-Date.parse(first.availableAt):undefined
 const mentions=joined.map(signal=>Object.freeze({
  sourceId:signal.observationId,platform:signal.platform,sourceHandle:signal.sourceHandle,
  publishedAt:signal.observedAt,availableAt:signal.availableAt,
  relativeToChainAvailabilityMs:Date.parse(signal.availableAt)-Date.parse(chain.availableAt),
  evidenceIds:Object.freeze([...signal.provenance.evidenceIds]),
 }))
 return Object.freeze({
  mint:chain.mint,chainEventId:chain.eventId,asOf,
  matchCount:joined.length,independentOriginCount:independent?.independentGroupCount??0,
  duplicateRisk:independent?.duplicateRisk??'NO_SOCIAL_EVIDENCE',
  earliestSocialAvailableAt:first?.availableAt,
  firstAvailabilityLeadMs:lead,
  timing:!first?'NO_SOCIAL_EVIDENCE' as const:lead!>0?'SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT' as const:'CHAIN_RECEIPT_FIRST' as const,
  retrospectiveOnly:chain.mode==='RETROSPECTIVE',
  caveats:Object.freeze([
   'Provider clock and availability are reported, not independently attested',
   'Matches are candidate mentions, never mint/account or token safety certification',
   'Unavailable social sources and missing messages remain unmeasured, not zero activity',
   'No trading fills, exits, executable profits or predictive accuracy established',
   ...(chain.mode==='RETROSPECTIVE'?['Retrospective chain recovery cannot prove an early live call']:[]),
  ]),
  mentions:Object.freeze(mentions),sourceIndependence:independent,
  authority:'RESEARCH_ONLY' as const,canAuthorizeTrade:false as const,canAutoCopy:false as const,
 })
}
