import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {digestSamReceiptObservation,samCheckpointSigningPayload,
  verifySamReceiptCheckpoint,assessSamReceiptCoverage,type SamReceiptCheckpoint}
from './sam-receipt-checkpoint.js'
import {SAM_RECEIPT_SOURCES,type SamReceiptObservation} from './sam-readonly-receipt-feed.js'

const window={from:'2026-10-17T00:00:00Z',through:'2026-10-17T23:59:59Z'}
const observation:SamReceiptObservation={
  source:'external_provider',window,snapshotId:'checkpoint:123',totalCount:1,
  observedPages:1,internallyConsistent:true,independentlyVerified:false,productionAuthority:false,
  receipts:[{id:'r1',operationId:'send1',surface:'provider_outreach',
    source:'external_provider',status:'completed',observedAt:'2026-10-17T12:00:00Z',
    externalRef:'external:1',authorizationId:'approval:1',destinationRef:'provider@example.test'}],
}
const a=generateKeyPairSync('ed25519')
const b=generateKeyPairSync('ed25519')
const trusted={operatorA:a.publicKey.export({type:'spki',format:'pem'}).toString()}
const signedAt='2026-10-17T10:00:00Z',expiresAt='2026-10-18T10:00:00Z'
const baseline:Omit<SamReceiptCheckpoint,'signatureBase64'>={
  source:observation.source,window:observation.window,snapshotId:observation.snapshotId,
  totalCount:observation.totalCount,sha256:digestSamReceiptObservation(observation),
  readFence:'remote-checkpoint:ABC',signerId:'operatorA',signedAt,expiresAt,
}
const signCheckpoint=(payload:Omit<SamReceiptCheckpoint,'signatureBase64'>,key=a.privateKey)=>{
  return {...payload,signatureBase64:sign(null,samCheckpointSigningPayload(payload),key).toString('base64')}
}
const checkpoint=signCheckpoint(baseline)
const verify=(c:SamReceiptCheckpoint,o=observation,keys=trusted)=>
  verifySamReceiptCheckpoint({checkpoint:c,observation:o,trustedPublicKeys:keys,
    verifiedAt:'2026-10-17T13:00:00Z'})
const accepted=verify(checkpoint)
assert.equal(accepted.integrityVerified,true)
assert.equal(accepted.safetyEvidenceComplete,false)
assert.equal(accepted.productionAuthority,false)
assert.deepEqual(accepted.reasons,[])

const tampered:SamReceiptObservation=structuredClone(observation)
tampered.receipts[0].destinationRef='somebody-else@example.test'
assert.ok(verify(checkpoint,tampered).reasons.includes('SAM_CHECKPOINT_DIGEST_MISMATCH'))
assert.equal(verify({...checkpoint,sha256:'0'.repeat(64)}).integrityVerified,false)
assert.equal(verify({...checkpoint,source:'payment_processor'}).integrityVerified,false)
assert.equal(verify({...checkpoint,snapshotId:'altered'}).integrityVerified,false)
assert.equal(verify({...checkpoint,readFence:''}).integrityVerified,false)
assert.equal(verify({...checkpoint,signerId:'untrusted'}).integrityVerified,false)
assert.equal(verify(signCheckpoint(baseline,b.privateKey)).integrityVerified,false)
assert.equal(verify({...checkpoint,signatureBase64:'not a signature'}).integrityVerified,false)
assert.equal(verify(checkpoint,observation,{}).integrityVerified,false)
assert.equal(verifySamReceiptCheckpoint({checkpoint,observation,trustedPublicKeys:trusted,
  verifiedAt:'2026-10-20T10:00:00Z'}).integrityVerified,false)

const coverage=assessSamReceiptCoverage({window,observations:[observation],checkpoints:[accepted]})
assert.equal(coverage.status,'blocked')
assert.equal(coverage.safetyEvidenceComplete,false)
assert.equal(coverage.productionAuthority,false)
assert.equal(coverage.verifiedSources.length,1)
assert.ok(coverage.missingSources.includes('fallback_observer'))
assert.ok(coverage.gaps.some(x=>x.includes('END_TO_END')))
const everySource=SAM_RECEIPT_SOURCES.map(source=>({...observation,source,
  receipts:[] as SamReceiptObservation['receipts'],totalCount:0}))
const everyVerification=SAM_RECEIPT_SOURCES.map(source=>({...accepted,source}))
const apparentlyComplete=assessSamReceiptCoverage({window,observations:everySource,
  checkpoints:everyVerification})
assert.deepEqual(apparentlyComplete.missingSources,[])
assert.equal(apparentlyComplete.status,'blocked')
assert.equal(apparentlyComplete.productionAuthority,false)
const duplicated=assessSamReceiptCoverage({window,observations:[observation,observation],
  checkpoints:[accepted]})
assert.ok(duplicated.gaps.some(x=>x.includes('MISSING_OR_DUPLICATE_SOURCE')))
const mismatched=assessSamReceiptCoverage({window,observations:[{...observation,
  window:{...window,from:'2026-10-16T00:00:00Z'}}],checkpoints:[accepted]})
assert.equal(mismatched.verifiedSources.length,0)
console.log('SAM-SAFETY-LEDGER.14–.16 signed witness and coverage tests passed')
