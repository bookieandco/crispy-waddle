import { createHash } from 'node:crypto'
import type { SolanaDexVenueProvider } from './solana-dex-runtime-contracts.js'

export const DEX_ROUTER_FINAL_VERSION='DEX-ROUTER-FINAL-v1' as const

export type DexVenueBuilderKind='JUPITER_ULTRA_MANAGED'|'VENDOR_SDK'|'INTERNAL_PROTOCOL_BUILDER'

export type DexVenueCommissionEvidence=Readonly<{
 provider:SolanaDexVenueProvider
 implementationId:string
 implementationKind:DexVenueBuilderKind
 implementationVersion:string
 transactionBuilderVerified:boolean
 mainnetBindingVerified:boolean
 slippageBindingVerified:boolean
 quoteBindingVerified:boolean
 signedBroadcastVerified:boolean
 evidenceClass:'REAL_INTEGRATION'|'TEST_FIXTURE'
 evidenceIds:readonly string[]
 authority:'ROUTER_COMMISSION_EVIDENCE_ONLY'
 canAuthorizeTrade:false
}>

export type DexRouterFinalReport=Readonly<{
 reportId:string
 version:typeof DEX_ROUTER_FINAL_VERSION
 status:'ROUTER_SURFACE_READY_DIRECT_BUILDERS_REQUIRED'|'DEX_ROUTER_COMMISSIONED'
 passed:boolean
 jupiterPrimaryVerified:boolean
 raydiumDirectVerified:boolean
 meteoraDirectVerified:boolean
 fallbackOrder:readonly ['jupiter-ultra','raydium-direct','meteora-direct']
 blockerCodes:readonly string[]
 evidenceIds:readonly string[]
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ONLY'
 canAuthorizeTrade:false
}>

const ORDER=['jupiter-ultra','raydium-direct','meteora-direct'] as const

function hash(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function unique(values:readonly string[]):readonly string[]{return Object.freeze([...new Set(values)].sort())}

function verified(e:DexVenueCommissionEvidence|undefined,provider:SolanaDexVenueProvider):boolean{
 if(!e||e.provider!==provider||e.authority!=='ROUTER_COMMISSION_EVIDENCE_ONLY'||e.canAuthorizeTrade!==false)return false
 if(!e.implementationId.trim()||!e.implementationVersion.trim()||!e.evidenceIds.length)return false
 if(e.evidenceClass!=='REAL_INTEGRATION')return false
 if(!e.transactionBuilderVerified||!e.mainnetBindingVerified||!e.slippageBindingVerified||!e.quoteBindingVerified||!e.signedBroadcastVerified)return false
 if(provider==='jupiter-ultra')return e.implementationKind==='JUPITER_ULTRA_MANAGED'
 return e.implementationKind==='VENDOR_SDK'||e.implementationKind==='INTERNAL_PROTOCOL_BUILDER'
}

export function certifyDexRouterFinal(input:{
 venueEvidence:readonly DexVenueCommissionEvidence[]
 fallbackOrder?:readonly SolanaDexVenueProvider[]
}):DexRouterFinalReport{
 const blockers:string[]=[]
 const fallback=[...(input.fallbackOrder??ORDER)]
 if(JSON.stringify(fallback)!==JSON.stringify(ORDER))blockers.push('DEX_ROUTER_PRIMARY_FALLBACK_ORDER_INVALID')
 const byProvider=new Map<SolanaDexVenueProvider,DexVenueCommissionEvidence>()
 for(const evidence of input.venueEvidence){
  if(byProvider.has(evidence.provider))blockers.push('DEX_ROUTER_DUPLICATE_VENUE_EVIDENCE:'+evidence.provider)
  else byProvider.set(evidence.provider,evidence)
 }
 const jupiter=verified(byProvider.get('jupiter-ultra'),'jupiter-ultra')
 const raydium=verified(byProvider.get('raydium-direct'),'raydium-direct')
 const meteora=verified(byProvider.get('meteora-direct'),'meteora-direct')
 if(!jupiter)blockers.push('DEX_ROUTER_JUPITER_PRIMARY_NOT_COMMISSIONED')
 if(!raydium)blockers.push('DEX_ROUTER_RAYDIUM_DIRECT_BUILDER_NOT_COMMISSIONED')
 if(!meteora)blockers.push('DEX_ROUTER_METEORA_DIRECT_BUILDER_NOT_COMMISSIONED')
 const evidenceIds=unique(input.venueEvidence.flatMap(e=>e.evidenceIds))
 const blockerCodes=unique(blockers)
 const passed=blockerCodes.length===0
 return Object.freeze({
  reportId:'dex-router-final:'+hash({
   version:DEX_ROUTER_FINAL_VERSION,
   fallbackOrder:ORDER,
   venueEvidence:input.venueEvidence.map(e=>({provider:e.provider,implementationId:e.implementationId,implementationVersion:e.implementationVersion,evidenceClass:e.evidenceClass,evidenceIds:e.evidenceIds})),
   blockerCodes,
  }),
  version:DEX_ROUTER_FINAL_VERSION,
  status:passed?'DEX_ROUTER_COMMISSIONED' as const:'ROUTER_SURFACE_READY_DIRECT_BUILDERS_REQUIRED' as const,
  passed,
  jupiterPrimaryVerified:jupiter,
  raydiumDirectVerified:raydium,
  meteoraDirectVerified:meteora,
  fallbackOrder:ORDER,
  blockerCodes,
  evidenceIds,
  unrestrictedLiveAuthorized:false as const,
  authority:'CERTIFICATION_ONLY' as const,
  canAuthorizeTrade:false as const,
 })
}
