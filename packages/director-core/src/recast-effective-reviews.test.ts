import {describe,expect,it} from 'vitest'
import type {RecastReviewReceipt} from './recast-review-ledger'
import {resolveEffectiveRecastReviews} from './recast-effective-reviews'
const date='2026-10-21T19:00:00Z'
const make=(kind:RecastReviewReceipt['kind'],id:string,reviewedAt='2026-10-21T18:00:00Z',status:'approved'|'rejected'='approved'):RecastReviewReceipt=>({
  id,projectId:'p',ownerUserId:'u',kind,sourceVideoAssetId:'v',
  characterImageAssetId:'i',sourceAudioAssetId:'a',
  sourceVideoSha256:'a'.repeat(64),characterImageSha256:'b'.repeat(64),sourceAudioSha256:'c'.repeat(64),
  reviewerId:'u',reviewedAt,expiresAt:'2026-10-21T19:30:00Z',
  status,method:kind==='media-probe'?'trusted-media-probe':'human-review',evidence:{reviewed:true},
})
const rows=()=>[
  make('media-probe','media'),make('tracking','track'),make('voice','voice'),make('rights','rights'),
]
describe('append-only Recast effective review selection',()=>{
  it('allows fresh distinct re-review without letting old receipts reauthorize',()=>{
    const latest=make('voice','voice:renewed','2026-10-21T18:40:00Z')
    const r=resolveEffectiveRecastReviews([...rows(),latest],date)
    expect(r.complete).toBe(true)
    expect(r.reviews.find(x=>x.kind==='voice')?.id).toBe('voice:renewed')
    expect(r.reviewHistoryObserved).toBe(5)
  })
  it('retains latest rejection and never chooses earlier approval',()=>{
    const last=make('rights','rights:revoked','2026-10-21T18:40:00Z','rejected')
    const r=resolveEffectiveRecastReviews([...rows(),last],date)
    expect(r.complete).toBe(true)
    expect(r.reviews.find(x=>x.kind==='rights')?.status).toBe('rejected')
  })
  it('fails closed for duplicate IDs, tied clocks, future timestamps and truncation',()=>{
    expect(resolveEffectiveRecastReviews([...rows(),rows()[0]],date).complete).toBe(false)
    expect(resolveEffectiveRecastReviews([...rows(),make('tracking','tracking:tie')],date).blockers)
      .toContain('DIRECTOR_RECAST_TRACKING_REVIEW_TIE')
    expect(resolveEffectiveRecastReviews([...rows(),make('voice','voice:future','2026-10-21T20:00:00Z')],date).complete).toBe(false)
    expect(resolveEffectiveRecastReviews(rows(),date,true).blockers)
      .toContain('DIRECTOR_RECAST_REVIEW_HISTORY_INCOMPLETE')
  })
  it('uses server append order over an older reviewedAt field for vetoes',()=>{
    const existing=rows().map(r=>({...r,createdAt:'2026-10-21T18:05:00Z'}))
    const veto={...make('rights','rights:later-veto','2026-10-21T17:50:00Z','rejected'),
      createdAt:'2026-10-21T18:20:00Z'}
    const decision=resolveEffectiveRecastReviews([...existing,veto],date)
    expect(decision.complete).toBe(true)
    expect(decision.reviews.find(r=>r.kind==='rights')?.status).toBe('rejected')
  })
  it('never fabricates absent review kinds',()=>{
    expect(resolveEffectiveRecastReviews(rows().slice(0,3),date).complete).toBe(false)
  })
})