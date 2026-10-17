import type { SamExternalSource } from './sam-external-safety-audit.js'
import { SAM_RECEIPT_SOURCES, assertSamReceiptWindow, loadSamReceiptObservation,
  type SamReceiptObservation, type SamReceiptPageReader, type SamReceiptWindow
} from './sam-readonly-receipt-feed.js'
import { assessSamReceiptCoverage, verifySamReceiptCheckpoint,
  type SamReceiptCheckpoint, type SamCheckpointVerification,
  type SamReceiptCoverageReport
} from './sam-receipt-checkpoint.js'

/** SAM-SAFETY-LEDGER.18–.19. Strictly READ-ONLY source admission.
 * Checkpoint signing keys are supplied by a separate operator-controlled
 * authority; no key taken from a feed response can establish trust.
 */
export type SamSafetyShadowSource={
  source:SamExternalSource
  readPage:SamReceiptPageReader
  readCheckpoint:(window:SamReceiptWindow)=>Promise<SamReceiptCheckpoint>
  pinnedSignerId:string
  pinnedPublicKeyPem:string
}
export type SamSafetyShadowSourceResult={
  source:SamExternalSource
  status:'verified_integrity_only'|'blocked'
  receiptsObserved:number|null
  checkpointVerified:boolean
  blockers:string[]
}
export type SamSafetyShadowReport={
  status:'blocked'
  readOnly:true
  sourceResults:SamSafetyShadowSourceResult[]
  coverage:SamReceiptCoverageReport
  unknownUnauthorizedExternalActions:null
  unknownSilentFallbacks:null
  permissionToSend:false
  permissionToBid:false
  permissionToSign:false
  permissionToPay:false
}

export async function runSamSafetyShadow(input:{
  window:SamReceiptWindow
  sources:readonly SamSafetyShadowSource[]
  verifiedAt:string
}):Promise<SamSafetyShadowReport>{
  assertSamReceiptWindow(input.window)
  if(!Number.isFinite(Date.parse(input.verifiedAt)))throw new Error('SAM_SHADOW_CLOCK_INVALID')
  const observations:SamReceiptObservation[]=[]
  const checks:SamCheckpointVerification[]=[]
  const sourceResults:SamSafetyShadowSourceResult[]=[]
  const seen=new Set<SamExternalSource>()
  for(const source of input.sources){
    if(!SAM_RECEIPT_SOURCES.includes(source.source))throw new Error('SAM_SHADOW_SOURCE_UNKNOWN')
    if(seen.has(source.source))throw new Error('SAM_SHADOW_DUPLICATE_SOURCE')
    seen.add(source.source)
    const result:SamSafetyShadowSourceResult={
      source:source.source,status:'blocked',receiptsObserved:null,
      checkpointVerified:false,blockers:[],
    }
    try{
      if(!source.pinnedSignerId.trim()||!source.pinnedPublicKeyPem.trim()){
        throw new Error('SAM_SHADOW_OPERATOR_TRUST_ANCHOR_MISSING')
      }
      const observation=await loadSamReceiptObservation({
        source:source.source,window:input.window,readPage:source.readPage,
      })
      result.receiptsObserved=observation.totalCount
      const checkpoint=await source.readCheckpoint(input.window)
      if(checkpoint.signerId!==source.pinnedSignerId){
        throw new Error('SAM_SHADOW_SIGNER_ID_MISMATCH')
      }
      const proof=verifySamReceiptCheckpoint({
        observation,checkpoint,verifiedAt:input.verifiedAt,
        trustedPublicKeys:{[source.pinnedSignerId]:source.pinnedPublicKeyPem},
      })
      if(!proof.integrityVerified){
        result.blockers.push(...proof.reasons)
      }else{
        result.status='verified_integrity_only'
        result.checkpointVerified=true
      }
      observations.push(observation)
      checks.push(proof)
    }catch(error){
      // The result remains blocked. Never retry via another source or silently
      // convert a failed read into an empty successful snapshot.
      result.blockers.push(error instanceof Error?error.message:'SAM_SHADOW_SOURCE_READ_FAILED')
    }
    sourceResults.push(result)
  }
  for(const source of SAM_RECEIPT_SOURCES){
    if(!seen.has(source))sourceResults.push({
      source,status:'blocked',receiptsObserved:null,
      checkpointVerified:false,blockers:['SAM_SHADOW_SOURCE_NOT_CONFIGURED'],
    })
  }
  const coverage=assessSamReceiptCoverage({
    window:input.window,observations,checkpoints:checks,
  })
  return {
    status:'blocked',readOnly:true,sourceResults,coverage,
    unknownUnauthorizedExternalActions:null,unknownSilentFallbacks:null,
    permissionToSend:false,permissionToBid:false,
    permissionToSign:false,permissionToPay:false,
  }
}
