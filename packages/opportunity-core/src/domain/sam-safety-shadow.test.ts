import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import { runSamSafetyShadow, type SamSafetyShadowSource } from './sam-safety-shadow.js'
import { SAM_RECEIPT_SOURCES, type SamReceiptPage } from './sam-readonly-receipt-feed.js'
import { digestSamReceiptObservation, samCheckpointSigningPayload,
  type SamReceiptCheckpoint } from './sam-receipt-checkpoint.js'
import type {SamExternalSource} from './sam-external-safety-audit.js'

const window={from:'2026-10-17T00:00:00Z',through:'2026-10-17T23:59:59Z'}
const at='2026-10-17T12:00:00Z'
const pair=generateKeyPairSync('ed25519')
const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString()
const events:string[]=[]
function goodSource(source:SamExternalSource):SamSafetyShadowSource{
  const page:SamReceiptPage={
    source,window,snapshotId:'snapshot:'+source,totalCount:0,receipts:[],
    nextCursor:null,readOnly:true,
  }
  const checkpointUnsigned:Omit<SamReceiptCheckpoint,'signatureBase64'>={
    source,window,snapshotId:page.snapshotId,totalCount:0,
    sha256:digestSamReceiptObservation({
      source,window,snapshotId:page.snapshotId,totalCount:0,receipts:[],
      observedPages:1,internallyConsistent:true,independentlyVerified:false,
      productionAuthority:false,
    }),
    readFence:'trusted-read-fence:'+source,signerId:'operator-key',
    signedAt:'2026-10-17T08:00:00Z',expiresAt:'2026-10-18T08:00:00Z',
  }
  const checkpoint:SamReceiptCheckpoint={
    ...checkpointUnsigned,
    signatureBase64:sign(null,samCheckpointSigningPayload(checkpointUnsigned),pair.privateKey).toString('base64'),
  }
  return {
    source,pinnedSignerId:'operator-key',pinnedPublicKeyPem:publicKeyPem,
    async readPage(){events.push('GET_PAGE:'+source);return page},
    async readCheckpoint(){events.push('GET_CHECKPOINT:'+source);return checkpoint},
  }
}
const seven=SAM_RECEIPT_SOURCES.map(goodSource)
const report=await runSamSafetyShadow({window,sources:seven,verifiedAt:at})
assert.equal(report.status,'blocked')
assert.equal(report.readOnly,true)
assert.equal(report.sourceResults.length,7)
assert.equal(report.coverage.verifiedSources.length,7)
assert.deepEqual(report.coverage.missingSources,[])
assert.ok(report.sourceResults.every(r=>r.status==='verified_integrity_only'))
assert.equal(report.unknownUnauthorizedExternalActions,null)
assert.equal(report.unknownSilentFallbacks,null)
assert.equal(report.permissionToSend,false)
assert.equal(report.permissionToBid,false)
assert.equal(report.permissionToSign,false)
assert.equal(report.permissionToPay,false)
assert.equal(events.length,14)

const notConfigured=await runSamSafetyShadow({window,sources:[],verifiedAt:at})
assert.equal(notConfigured.status,'blocked')
assert.equal(notConfigured.coverage.verifiedSources.length,0)
assert.equal(notConfigured.sourceResults.length,7)
assert.ok(notConfigured.sourceResults.every(x=>x.blockers.includes('SAM_SHADOW_SOURCE_NOT_CONFIGURED')))
const missing=await runSamSafetyShadow({window,sources:seven.slice(0,1),verifiedAt:at})
assert.equal(missing.coverage.verifiedSources.length,1)
assert.equal(missing.coverage.missingSources.length,6)

const noKey=goodSource('provider_transport')
noKey.pinnedPublicKeyPem=''
const noKeyReport=await runSamSafetyShadow({window,sources:[noKey],verifiedAt:at})
assert.equal(noKeyReport.sourceResults[0].checkpointVerified,false)
assert.ok(noKeyReport.sourceResults[0].blockers.includes('SAM_SHADOW_OPERATOR_TRUST_ANCHOR_MISSING'))

const wrongSigner=goodSource('provider_transport')
wrongSigner.pinnedSignerId='different-operator'
const wrongReport=await runSamSafetyShadow({window,sources:[wrongSigner],verifiedAt:at})
assert.ok(wrongReport.sourceResults[0].blockers.includes('SAM_SHADOW_SIGNER_ID_MISMATCH'))

const failedPage=goodSource('provider_transport')
failedPage.readPage=async()=>{throw new Error('transport unavailable')}
const failedReport=await runSamSafetyShadow({window,sources:[failedPage],verifiedAt:at})
assert.equal(failedReport.sourceResults[0].status,'blocked')
assert.ok(failedReport.sourceResults[0].blockers.includes('transport unavailable'))
assert.equal(failedReport.coverage.verifiedSources.length,0)

await assert.rejects(runSamSafetyShadow({window,sources:[goodSource('provider_transport'),goodSource('provider_transport')],verifiedAt:at}),/SAM_SHADOW_DUPLICATE_SOURCE/)
await assert.rejects(runSamSafetyShadow({window:{from:window.through,through:window.from},sources:[],verifiedAt:at}),/SAM_RECEIPT_WINDOW_INVALID/)
await assert.rejects(runSamSafetyShadow({window,sources:[],verifiedAt:'not-a-date'}),/SAM_SHADOW_CLOCK_INVALID/)
console.log('SAM-SAFETY-LEDGER.17–.20 shadow: 7 feeds, bad signer, absent DB feeds and fail-closed tests passed')
