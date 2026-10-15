import { reconcileGrowthContribution, type GrowthContributionReceipt } from './business-growth-experiments.js'

/**
 * BIZ-GROWTH-LIVE.01–.06: a fail-closed, READ-ONLY commissioning evaluator.
 *
 * DO NOT expose raw input as a public API. Provenance IDs/statuses are not
 * digital signatures: the trusted server must construct each assertion from
 * its canonical registry, Google provider client, site audit, approval ledger,
 * publishing provider and Commerce settlement reader. This function only
 * reconciles those assertions; it grants no execution or approval authority.
 */
export type GrowthLiveProofKind =
  | 'OWNED_SITE' | 'SEARCH_CONSOLE' | 'SITE_INSPECTION'
  | 'CONTENT_APPROVAL' | 'PUBLISH_DELIVERY' | 'COMMERCE_SETTLEMENT'

export type GrowthLiveProof = {
  kind: GrowthLiveProofKind
  evidenceRef: string
  ventureId: string
  businessId: string
  website: string
  observedAt: string
  source: 'OWNER_REGISTRY' | 'GOOGLE_SEARCH_CONSOLE' | 'OWNED_SITE_AUDITOR'
    | 'CANONICAL_APPROVAL_LEDGER' | 'PUBLISH_PROVIDER' | 'COMMERCE_RECONCILER'
  // Values not sourced from a trusted server reader must NOT be set true.
  serverVerified: boolean
  approvalReceiptId?: string
  assetId?: string
  campaignId?: string
  providerDeliveryId?: string
  orderId?: string
}
export type GrowthLiveInput = {
  ventureId: string
  businessId: string
  ownedWebsite: string
  now: string
  proofs: GrowthLiveProof[]
  // Read only from the canonical Commerce reconciler; never from browser JSON.
  settlement?: GrowthContributionReceipt
  previouslyScoredOrderIds: readonly string[]
}
export type GrowthLiveGate = {
  code: GrowthLiveProofKind
  status: 'PASS' | 'BLOCKED'
  evidenceRef?: string
  blocker?: string
}
export type GrowthLiveAssessment = {
  ventureId: string
  businessId: string
  gates: GrowthLiveGate[]
  result: 'PROVEN_END_TO_END' | 'BLOCKED'
  verifiedConversionCents: number | null
  possibleEarnedXp: number
  status: 'EVIDENCE_EVALUATED_ONLY'
  productionPublicationAuthorized: false
  spendingAuthorized: false
  unattendedPublishingAuthorized: false
  externalExecutionAuthorized: false
}

const kinds: readonly GrowthLiveProofKind[] = [
  'OWNED_SITE', 'SEARCH_CONSOLE','SITE_INSPECTION',
  'CONTENT_APPROVAL','PUBLISH_DELIVERY','COMMERCE_SETTLEMENT',
]
const sources: Record<GrowthLiveProofKind,GrowthLiveProof['source']> = {
  OWNED_SITE:'OWNER_REGISTRY',
  SEARCH_CONSOLE:'GOOGLE_SEARCH_CONSOLE',
  SITE_INSPECTION:'OWNED_SITE_AUDITOR',
  CONTENT_APPROVAL:'CANONICAL_APPROVAL_LEDGER',
  PUBLISH_DELIVERY:'PUBLISH_PROVIDER',
  COMMERCE_SETTLEMENT:'COMMERCE_RECONCILER',
}
const maxAgeDays: Record<GrowthLiveProofKind,number> = {
  OWNED_SITE:90, SEARCH_CONSOLE:14, SITE_INSPECTION:14,
  CONTENT_APPROVAL:30, PUBLISH_DELIVERY:30, COMMERCE_SETTLEMENT:45,
}
const clean = (s: string) => typeof s === 'string' && !!s.trim()
function origin(value:string):string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== '/') throw new Error()
    return url.origin.toLowerCase()
  } catch { throw new Error('BIZ_GROWTH_LIVE_REGISTERED_ORIGIN_INVALID') }
}
function ms(iso:string): number {
  const t=Date.parse(iso)
  if (!Number.isFinite(t) || !/^\d{4}-\d\d-\d\dT/.test(iso)) {
    throw new Error('BIZ_GROWTH_LIVE_TIMESTAMP_INVALID')
  }
  return t
}

export function assessBusinessGrowthLiveCommissioning(input:GrowthLiveInput):GrowthLiveAssessment {
  if (!clean(input.ventureId) || !clean(input.businessId)) throw new Error('BIZ_GROWTH_LIVE_SCOPE_REQUIRED')
  const ownedSite=origin(input.ownedWebsite)
  const now=ms(input.now)
  if (!Array.isArray(input.proofs) || input.proofs.length>30 || !Array.isArray(input.previouslyScoredOrderIds)) {
    throw new Error('BIZ_GROWTH_LIVE_PROOF_SET_INVALID')
  }
  const byKind=new Map<GrowthLiveProofKind,GrowthLiveProof>()
  for(const proof of input.proofs) {
    if (!kinds.includes(proof.kind)) throw new Error('BIZ_GROWTH_LIVE_KIND_INVALID')
    if (byKind.has(proof.kind)) throw new Error('BIZ_GROWTH_LIVE_DUPLICATE_KIND')
    byKind.set(proof.kind,proof)
    // Scope errors cannot be ignored as ordinary missing evidence.
    if (proof.ventureId !== input.ventureId || proof.businessId !== input.businessId ||
      origin(proof.website) !== ownedSite) throw new Error('BIZ_GROWTH_LIVE_CROSS_BUSINESS_PROOF')
  }
  const gates:GrowthLiveGate[]=kinds.map(kind=>{
    const proof=byKind.get(kind)
    if (!proof) return {code:kind,status:'BLOCKED',blocker:'No canonical receipt recorded'}
    const delta=now-ms(proof.observedAt)
    if(delta<0 || delta>maxAgeDays[kind]*86400000) {
      return {code:kind,status:'BLOCKED',blocker:'Receipt future-dated or stale'}
    }
    if (!proof.serverVerified || proof.source!==sources[kind] || !clean(proof.evidenceRef)) {
      return {code:kind,status:'BLOCKED',blocker:'Trusted provider/ledger provenance unavailable'}
    }
    if (kind==='CONTENT_APPROVAL' &&
      (!clean(proof.approvalReceiptId??'') || !clean(proof.assetId??'') || !clean(proof.campaignId??''))) {
      return {code:kind,status:'BLOCKED',blocker:'Exact content, campaign and approval binding missing'}
    }
    if (kind==='PUBLISH_DELIVERY' &&
      (!clean(proof.approvalReceiptId??'') || !clean(proof.providerDeliveryId??'') ||
      !clean(proof.assetId??'') || !clean(proof.campaignId??''))) {
      return {code:kind,status:'BLOCKED',blocker:'Publisher delivery and approval correlation missing'}
    }
    if (kind==='COMMERCE_SETTLEMENT' &&
      (!clean(proof.orderId??'') || !clean(proof.assetId??'') || !clean(proof.campaignId??''))) {
      return {code:kind,status:'BLOCKED',blocker:'Order-to-asset attribution lineage missing'}
    }
    return {code:kind,status:'PASS',evidenceRef:proof.evidenceRef}
  })
  const gate=(kind:GrowthLiveProofKind)=>gates.find(g=>g.code===kind)!
  const approval=byKind.get('CONTENT_APPROVAL')
  const delivery=byKind.get('PUBLISH_DELIVERY')
  if (gate('CONTENT_APPROVAL').status==='PASS' && gate('PUBLISH_DELIVERY').status==='PASS') {
    if (approval!.approvalReceiptId!==delivery!.approvalReceiptId ||
      approval!.assetId!==delivery!.assetId || approval!.campaignId!==delivery!.campaignId ||
      ms(delivery!.observedAt)<ms(approval!.observedAt)) {
      const i=gates.findIndex(g=>g.code==='PUBLISH_DELIVERY')
      gates[i]={code:'PUBLISH_DELIVERY',status:'BLOCKED',blocker:'Publication does not match approved exact asset/campaign or predates approval'}
    }
  }
  const commerce=byKind.get('COMMERCE_SETTLEMENT')
  let verifiedConversionCents:number|null=null
  let possibleEarnedXp=0
  if (gate('PUBLISH_DELIVERY').status==='PASS' && gate('COMMERCE_SETTLEMENT').status==='PASS') {
    const linked=commerce!.assetId===delivery!.assetId &&
      commerce!.campaignId===delivery!.campaignId &&
      ms(commerce!.observedAt)>=ms(delivery!.observedAt) &&
      input.settlement?.orderId===commerce!.orderId
    const result=linked && input.settlement
      ? reconcileGrowthContribution(input.settlement,{
          businessId:input.businessId,missionId:input.settlement.missionId,
          experimentId:input.settlement.experimentId,
          orderIdsAlreadyScored:input.previouslyScoredOrderIds,
        })
      : null
    if (!result || result.status!=='VERIFIED_SETTLED_CONTRIBUTION' ||
        !result.evidenceRefs.includes(commerce!.evidenceRef)) {
      const i=gates.findIndex(g=>g.code==='COMMERCE_SETTLEMENT')
      gates[i]={code:'COMMERCE_SETTLEMENT',status:'BLOCKED',blocker:'Real reconciled settlement/order attribution unavailable'}
    } else {
      verifiedConversionCents=result.realizedCents
      possibleEarnedXp=result.earnedXp
    }
  } else if (gate('COMMERCE_SETTLEMENT').status==='PASS') {
    const i=gates.findIndex(g=>g.code==='COMMERCE_SETTLEMENT')
    gates[i]={code:'COMMERCE_SETTLEMENT',status:'BLOCKED',blocker:'Cannot attribute settlement without matched delivery'}
  }
  const proven=gates.every(g=>g.status==='PASS')
  return {
    ventureId:input.ventureId,businessId:input.businessId,gates,
    result:proven?'PROVEN_END_TO_END':'BLOCKED',
    verifiedConversionCents:proven?verifiedConversionCents:null,
    possibleEarnedXp:proven?possibleEarnedXp:0,
    status:'EVIDENCE_EVALUATED_ONLY',
    productionPublicationAuthorized:false,spendingAuthorized:false,
    unattendedPublishingAuthorized:false,externalExecutionAuthorized:false,
  }
}
