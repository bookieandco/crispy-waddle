/** SHARK-ALPHA.FABRIC.02 — immutable, point-in-time research evidence. No trade authority. */
export type AlphaEvidenceSource = 'CHAIN'|'SOCIAL'|'MARKET'
export type AlphaEvidenceV2 = Readonly<{
  schemaVersion:'SHARK_ALPHA_EVIDENCE_V2'
  sourceEventId:string
  sourceFamily:AlphaEvidenceSource
  sourceHandle:string
  sourceUrl?:string
  originalEventId?:string
  authorId?:string
  contentFingerprint?:string
  occurredAt:string
  publishedAt?:string
  receivedAt:string
  availableAt:string
  latencyMs:number
  publicationStatus:'SOURCE_TIMESTAMP_PRESENT'|'UNVERIFIED'
  evidenceIds:readonly string[]
  providerAttestation:'UNVERIFIED'
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
  canAutoCopy:false
}>
export type AlphaEvidenceInput = Readonly<{
  sourceEventId:string
  sourceFamily:AlphaEvidenceSource
  sourceHandle:string
  sourceUrl?:string
  originalEventId?:string
  authorId?:string
  contentFingerprint?:string
  occurredAt:string
  publishedAt?:string
  receivedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>
const iso = (value:string,code:string):number => {
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value))
    throw new Error(code)
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error(code)
  return parsed
}
export function createAlphaEvidenceV2(input:AlphaEvidenceInput):AlphaEvidenceV2 {
  if(!input.sourceEventId?.trim()||!input.sourceHandle?.trim()||!input.evidenceIds?.length ||
    input.evidenceIds.some(value=>!value.trim()))throw new Error('alpha_evidence_identity_required')
  if(!['CHAIN','SOCIAL','MARKET'].includes(input.sourceFamily))throw new Error('alpha_evidence_family_invalid')
  const occurred=iso(input.occurredAt,'alpha_evidence_occurred_at_invalid')
  const received=iso(input.receivedAt,'alpha_evidence_received_at_invalid')
  const available=iso(input.availableAt,'alpha_evidence_available_at_invalid')
  if(occurred>received||received>available)throw new Error('alpha_evidence_clock_order_invalid')
  if(input.publishedAt!==undefined){
    const published=iso(input.publishedAt,'alpha_evidence_published_at_invalid')
    if(published>received||published>occurred)throw new Error('alpha_evidence_publication_clock_invalid')
  }
  const evidenceIds=Object.freeze([...new Set(input.evidenceIds)].sort())
  return Object.freeze({
    schemaVersion:'SHARK_ALPHA_EVIDENCE_V2' as const,
    sourceEventId:input.sourceEventId.trim(),
    sourceFamily:input.sourceFamily,
    sourceHandle:input.sourceHandle.trim(),
    sourceUrl:input.sourceUrl?.trim()||undefined,
    originalEventId:input.originalEventId?.trim()||undefined,
    authorId:input.authorId?.trim()||undefined,
    contentFingerprint:input.contentFingerprint?.trim()||undefined,
    occurredAt:input.occurredAt,
    publishedAt:input.publishedAt,
    receivedAt:input.receivedAt,
    availableAt:input.availableAt,
    latencyMs:available-occurred,
    publicationStatus:input.publishedAt?'SOURCE_TIMESTAMP_PRESENT' as const:'UNVERIFIED' as const,
    evidenceIds,
    providerAttestation:'UNVERIFIED' as const,
    authority:'EVIDENCE_ONLY' as const,
    canAuthorizeTrade:false as const,
    canAutoCopy:false as const,
  })
}
