import {describe,expect,it} from 'vitest'
import {sealRecastEvidence} from './recast-review-digest'
import {prepareRecastOwnerRevocation} from './recast-owner-revocation'
import type {RecastUnpersistedReceipt} from './recast-review-insert-manifest'

const owner='00000000-0000-4000-8000-000000000001'
const editor='00000000-0000-4000-8000-000000000002'
const original='00000000-0000-4000-8000-000000000003'
const revocation='00000000-0000-4000-8000-000000000004'
const baseEvidence={approved:true,consentReceiptId:'consent:verified'}
const prior:RecastUnpersistedReceipt={
 id:original,project_id:'project:owner',owner_user_id:owner,kind:'rights',
 source_video_asset_id:'00000000-0000-4000-8000-000000000005',
 character_image_asset_id:'00000000-0000-4000-8000-000000000006',
 source_audio_asset_id:'00000000-0000-4000-8000-000000000007',
 source_video_sha256:'a'.repeat(64),character_image_sha256:'b'.repeat(64),
 source_audio_sha256:'c'.repeat(64),
 reviewed_by_user_id:editor,reviewed_at:'2026-10-21T18:00:00Z',
 expires_at:'2026-10-21T18:30:00Z',status:'approved',method:'human-review',
 evidence:baseEvidence,evidence_sha256:sealRecastEvidence(baseEvidence),
 disposition:'UNPERSISTED_INSERT_MANIFEST',
}
const request={
 trustedPrior:prior,newServerReceiptId:revocation,authenticatedOwnerUserId:owner,
 explicitOwnerRevocation:true as const,
 reason:'Owner rescinds likeness permission for preview rendering',
 reviewedAt:'2026-10-21T18:04:00Z',
 expiresAt:'2026-10-21T18:24:00Z',now:'2026-10-21T18:04:20Z',
}
describe('Recast owner revocation remains unpersisted and denies revoked media',()=>{
 it('creates owner-authenticated later rejection without reauthorizing a worker',()=>{
  const revoked=prepareRecastOwnerRevocation(request)
  expect(revoked).toMatchObject({id:revocation,status:'rejected',
    reviewed_by_user_id:owner,kind:'rights',disposition:'UNPERSISTED_INSERT_MANIFEST'})
  expect(revoked.evidence_sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(revoked.evidence).toMatchObject({previousReceiptId:original,explicitRevocation:true})
  expect(revoked).not.toHaveProperty('renderPermit')
 })
 it('rejects a forged owner, replayed ID, stale timestamp and unverified older consent',()=>{
  expect(()=>prepareRecastOwnerRevocation({...request,authenticatedOwnerUserId:editor})).toThrow()
  expect(()=>prepareRecastOwnerRevocation({...request,newServerReceiptId:original})).toThrow()
  expect(()=>prepareRecastOwnerRevocation({...request,now:'2026-10-21T19:00:00Z'})).toThrow()
  expect(()=>prepareRecastOwnerRevocation({...request,trustedPrior:{...prior,evidence:{approved:false}}})).toThrow()
 })
 it('rejects self-issued media-probe revocations (requires trusted probe reviewer)',()=>{
  expect(()=>prepareRecastOwnerRevocation({...request,trustedPrior:{...prior,kind:'media-probe',method:'trusted-media-probe'}})).toThrow()
 })
})