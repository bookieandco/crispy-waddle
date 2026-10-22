import {describe,expect,it,vi} from 'vitest'
import {sealRecastEvidence} from './recast-review-digest'
import {persistRecastReceiptInIsolatedStaging} from './recast-staging-receipt-sink'
import type {RecastUnpersistedReceipt} from './recast-review-insert-manifest'
const user='00000000-0000-4000-8000-000000000001'
const id='00000000-0000-4000-8000-000000000005'
const evidence={reviewed:true,source:'server-reviewed'}
const receipt:RecastUnpersistedReceipt={
  id,project_id:'project1',owner_user_id:user,kind:'rights',
  source_video_asset_id:'00000000-0000-4000-8000-000000000002',
  character_image_asset_id:'00000000-0000-4000-8000-000000000003',
  source_audio_asset_id:'00000000-0000-4000-8000-000000000004',
  source_video_sha256:'a'.repeat(64),character_image_sha256:'b'.repeat(64),
  source_audio_sha256:'c'.repeat(64),reviewed_by_user_id:user,
  reviewed_at:'2026-10-21T18:01:00Z',expires_at:'2026-10-21T18:21:00Z',
  status:'approved',method:'human-review',evidence,
  evidence_sha256:sealRecastEvidence(evidence),
  disposition:'UNPERSISTED_INSERT_MANIFEST',
}
const authorization={
  databaseEnvironment:'disposable-preview-branch' as const,
  productionProjectRef:'production-ref',branchProjectRef:'preview-ref',
  branchHealthy:true,schemaAndRlsAudited:true,independentReviewerAuthenticated:true,
  operatorWriteApprovalId:'operator-approval:1',reviewerUserId:user,explicitlyCommissioned:true,
}
describe('non-production Recast review receipt persistence adapter',()=>{
  it('rejects default uncommissioned, production-target and forged digest without contacting sink',async()=>{
    const insertReviewReceipt=vi.fn().mockResolvedValue({id})
    const readReviewReceipt=vi.fn().mockResolvedValue(receipt)
    const sink={insertReviewReceipt,readReviewReceipt}
    await expect(persistRecastReceiptInIsolatedStaging(receipt,{...authorization,explicitlyCommissioned:false},sink)).rejects.toThrow()
    await expect(persistRecastReceiptInIsolatedStaging(receipt,{...authorization,branchProjectRef:'production-ref'},sink)).rejects.toThrow()
    await expect(persistRecastReceiptInIsolatedStaging(receipt,{...authorization,schemaAndRlsAudited:false},sink)).rejects.toThrow()
    await expect(persistRecastReceiptInIsolatedStaging({...receipt,evidence:{...evidence,reviewed:false}},authorization,sink)).rejects.toThrow()
    expect(insertReviewReceipt).not.toHaveBeenCalled()
  })
  it('only calls explicitly injected isolated-staging sink after all review and operator gates',async()=>{
    const insertReviewReceipt=vi.fn().mockResolvedValue({id})
    const readReviewReceipt=vi.fn().mockResolvedValue(receipt)
    const result=await persistRecastReceiptInIsolatedStaging(receipt,authorization,{insertReviewReceipt,readReviewReceipt})
    expect(result).toMatchObject({stagedReceiptId:id,persistedTo:'ISOLATED_STAGING_ONLY',
      rendered:false,spent:false,published:false})
    expect(insertReviewReceipt).toHaveBeenCalledTimes(1)
    expect(readReviewReceipt).toHaveBeenCalledTimes(1)
    expect(insertReviewReceipt.mock.calls[0][0]).toBe('director_recast_review_receipts')
    expect(insertReviewReceipt.mock.calls[0][1].disposition).toBeUndefined()
  })
  it('does not report a successful insert without matching persisted receipt identity',async()=>{
    await expect(persistRecastReceiptInIsolatedStaging(receipt,authorization,{
      insertReviewReceipt:async()=>({id:'foreign'}),
      readReviewReceipt:async()=>receipt,
    })).rejects.toThrow('DIRECTOR_RECAST_STAGING_RECEIPT_INSERT_NOT_CONFIRMED')
    it('fails closed when insert acknowledgement exists but readback is missing or changed',async()=>{
    const insertReviewReceipt=vi.fn().mockResolvedValue({id})
    await expect(persistRecastReceiptInIsolatedStaging(receipt,authorization,{
      insertReviewReceipt,readReviewReceipt:async()=>null,
    })).rejects.toThrow('DIRECTOR_RECAST_STAGING_RECEIPT_READBACK_MISMATCH')
    await expect(persistRecastReceiptInIsolatedStaging(receipt,authorization,{
      insertReviewReceipt,readReviewReceipt:async()=>({...receipt,evidence_sha256:'f'.repeat(64)}),
    })).rejects.toThrow('DIRECTOR_RECAST_STAGING_RECEIPT_READBACK_MISMATCH')
  })
})
})