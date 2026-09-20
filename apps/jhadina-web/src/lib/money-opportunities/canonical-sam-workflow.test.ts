import { describe,expect,it } from 'vitest'
import { buildCanonicalSamPreview, canonicalizeSamNotice, CANONICAL_SAM_BOUNDARY } from './canonical-sam-workflow'
describe('canonical SAM app boundary',()=>{
  it('adapts into Opportunity Core without user-scoped domain ids',()=>{
    const o=canonicalizeSamNotice({noticeId:'N1',title:'Cloud services',responseDeadline:'2026-10-01',naicsCode:'541512',uiLink:'https://sam.gov/opp/N1/view'},'2026-09-20T00:00:00Z')
    expect(o.id).toBe('sam:N1');expect(o.type).toBe('contract');expect(o.metadata?.requiresUserApproval).toBe(true)
  })
  it('builds canonical requirement preview and preserves authorization boundary',()=>{
    const x=buildCanonicalSamPreview({noticeId:'N2',title:'Security services',description:'Security services in California',uiLink:'https://sam.gov/opp/N2/view'},'2026-09-20T00:00:00Z')
    expect(x.requirements.opportunityId).toBe('sam:N2');expect(CANONICAL_SAM_BOUNDARY.callerControlledUserId).toBe(false)
  })
})
