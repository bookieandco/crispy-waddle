export type ExternalSignalPlatform='TELEGRAM'|'DISCORD'|'X'|'OTHER'
export type SharkMemoryTier='KNOWN'|'INFERRED'|'LEARNED'

export type ExternalSignalCandidate=Readonly<{
  kind:'SOLANA_ADDRESS'|'SOLSCAN_TX'|'DEXSCREENER_SOLANA'|'BIRDEYE_SOLANA'
  value:string
  confidence:number
}>

export type ExternalSignalObservation=Readonly<{
  observationId:string
  platform:ExternalSignalPlatform
  sourceHandle:string
  channelId?:string
  observedAt:string
  availableAt:string
  textHash:string
  candidates:readonly ExternalSignalCandidate[]
  memoryTier:'KNOWN'
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

const solanaAddress=/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g
const solscanTx=/https?:\/\/(?:www\.)?solscan\.io\/tx\/([1-9A-HJ-NP-Za-km-z]{32,120})/gi
const dexscreener=/https?:\/\/dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{20,120})/gi
const birdeye=/https?:\/\/(?:www\.)?birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:\?[^\s]*)?/gi

const assertIso=(v:string,c:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(c)}
const stableHash=(value:string):string=>{
  let a=0x811c9dc5,b=0x9e3779b9
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i)
    a=Math.imul(a^code,0x01000193)>>>0
    b=Math.imul((b+code+(i<<6))>>>0,0x85ebca6b)>>>0
  }
  return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')
}
const push=(out:ExternalSignalCandidate[],kind:ExternalSignalCandidate['kind'],value:string,confidence:number)=>{
  if(!out.some(x=>x.kind===kind&&x.value===value))out.push(Object.freeze({kind,value,confidence}))
}

export function ingestExternalSignal(input:{
  observationId:string
  platform:ExternalSignalPlatform
  sourceHandle:string
  channelId?:string
  text:string
  observedAt:string
  availableAt:string
}):ExternalSignalObservation{
  if(!input.observationId.trim()||!input.sourceHandle.trim()||!input.text.trim())throw new Error('shark_signal_identity_required')
  assertIso(input.observedAt,'shark_signal_observed_at_invalid');assertIso(input.availableAt,'shark_signal_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('shark_signal_availability_invalid')
  const candidates:ExternalSignalCandidate[]=[]
  for(const m of input.text.matchAll(solscanTx))push(candidates,'SOLSCAN_TX',m[1]!,.95)
  for(const m of input.text.matchAll(dexscreener))push(candidates,'DEXSCREENER_SOLANA',m[1]!,.9)
  for(const m of input.text.matchAll(birdeye))push(candidates,'BIRDEYE_SOLANA',m[1]!,.9)
  for(const m of input.text.matchAll(solanaAddress))push(candidates,'SOLANA_ADDRESS',m[0],.55)
  const textHash=stableHash(input.text)
  return Object.freeze({
    observationId:input.observationId,platform:input.platform,sourceHandle:input.sourceHandle,channelId:input.channelId,
    observedAt:input.observedAt,availableAt:input.availableAt,textHash,
    candidates:Object.freeze(candidates.sort((a,b)=>b.confidence-a.confidence||a.kind.localeCompare(b.kind)||a.value.localeCompare(b.value))),
    memoryTier:'KNOWN',authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
  })
}

export type SignalHypothesis=Readonly<{
  hypothesisId:string
  signalObservationId:string
  tokenCandidate:string
  rationale:string
  evidenceIds:readonly string[]
  memoryTier:'INFERRED'
  authority:'RESEARCH_ONLY'
  canAuthorizeTrade:false
}>

export function createSignalHypothesis(input:{
  observation:ExternalSignalObservation
  tokenCandidate:string
  rationale:string
  evidenceIds:readonly string[]
}):SignalHypothesis{
  if(input.observation.authority!=='EVIDENCE_ONLY'||input.observation.canAuthorizeTrade!==false)throw new Error('shark_signal_authority_invalid')
  if(!input.tokenCandidate.trim()||!input.rationale.trim()||!input.evidenceIds.length)throw new Error('shark_signal_hypothesis_incomplete')
  return Object.freeze({
    hypothesisId:`signal-hypothesis:${stableHash(JSON.stringify({o:input.observation.observationId,t:input.tokenCandidate,r:input.rationale,e:[...input.evidenceIds].sort()}))}`,
    signalObservationId:input.observation.observationId,tokenCandidate:input.tokenCandidate,rationale:input.rationale,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),memoryTier:'INFERRED',authority:'RESEARCH_ONLY',canAuthorizeTrade:false,
  })
}
