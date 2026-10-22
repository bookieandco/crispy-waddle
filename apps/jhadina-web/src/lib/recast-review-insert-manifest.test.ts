import {describe,expect,it} from 'vitest'
import {prepareRecastUnpersistedInsert} from './recast-review-insert-manifest'
import type {RecastStagedReview} from './recast-review-submission'
const owner='00000000-0000-4000-8000-000000000001'
const video='00000000-0000-4000-8000-000000000002'
const image='00000000-0000-4000-8000-000000000003'
const audio='00000000-0000-4000-8000-000000000004'
const receipt='00000000-0000-4000-8000-000000000005'
const stage:RecastStagedReview={
  project_id:'director-project-a',owner_user_id:owner,
  kind:'rights',source_video_asset_id:video,
  character_image_asset_id:image,source_audio_asset_id:audio,
  source_video_sha256:'a'.repeat(64),
  character_image_sha256:'b'.repeat(64),
  source_audio_sha256:'c'.repeat(64),
  reviewed_by_user_id:owner,reviewed_at:'2026-10-21T21:00:00Z',
  expires_at:'2026-10-21T21:15:00Z',
  status:'approved',method:'human-review',
  evidence:{approved:true,consentReceiptId:'consent-owner-reference'},
  disposition:'UNPERSISTED_REVIEW_PROPOSAL',
}
describe('Recast append-only insert preparation, no database write',()=>{
  it('prepares UUID-bound staged SQL row with SHA-256 evidence and no persistence',()=>{
    const row=prepareRecastUnpersistedInsert(stage,receipt,owner)
    expect(row).toMatchObject({
      id:receipt,owner_user_id:owner,reviewed_by_user_id:owner,
      disposition:'UNPERSISTED_INSERT_MANIFEST',
    })
    expect(row.evidence_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.keys(row)).not.toContain('renderPermit')
    expect(row).not.toHaveProperty('serviceRoleToken')
  })
  it('rejects forged reviewer, foreign asset and browser supplied ID formats',()=>{
    expect(()=>prepareRecastUnpersistedInsert(stage,receipt,'00000000-0000-4000-8000-000000000099')).toThrow()
    expect(()=>prepareRecastUnpersistedInsert({...stage,source_audio_asset_id:'audio:bogus'},receipt,owner)).toThrow()
    expect(()=>prepareRecastUnpersistedInsert(stage,'client:fake',owner)).toThrow()
  })
  it('rejects unapproved or expired and bogus-evidence staging',()=>{
    expect(()=>prepareRecastUnpersistedInsert({...stage,expires_at:'2026-10-20T21:00:00Z'},receipt,owner)).toThrow()
    expect(()=>prepareRecastUnpersistedInsert({...stage,disposition:'CLIENT_APPROVED' as RecastStagedReview['disposition']},receipt,owner)).toThrow()
    expect(()=>prepareRecastUnpersistedInsert({...stage,evidence:null},receipt,owner)).toThrow()
  })
})
