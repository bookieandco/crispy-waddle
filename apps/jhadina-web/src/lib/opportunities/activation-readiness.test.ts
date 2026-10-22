import { describe,expect,it } from 'vitest'
import { normalizePublicBoardRows } from './public-job-board'
import { makeDiscoveredJobReview,verifyCanonicalImportReadback } from './job-import-acceptance'
import { calculateOpportunityActivationReadiness } from './activation-readiness'
import type { StoredCanonicalOpportunity } from './canonical'

const ts='2026-10-22T07:00:00Z'
const [job]=normalizePublicBoardRows({source:'lever',board:'acme'},[
  {id:'job-01',text:'Remote Research Analyst',hostedUrl:'https://jobs.lever.co/acme/job-01',categories:{location:'Remote US'}},
],ts)
describe('OCE verified activation evidence',()=>{
  it('shows listings as unverified eligibility and never authorized AI worker',()=>{
    const preview=makeDiscoveredJobReview(job)
    expect(preview.remoteMentioned).toBe(true)
    expect(preview.eligibilityVerified).toBe(false)
    expect(preview.aiPerformanceAuthorized).toBe(false)
    expect(preview.applicationAuthorized).toBe(false)
    expect(preview.nextReview.length).toBe(4)
  })
  it('requires canonical owner-specific read after import and tolerates saved status on replay',()=>{
    const original={userId:'owner:a',opportunity:{...job,status:'pursuing' as const}}
    expect(verifyCanonicalImportReadback({expectedId:job.id,expectedOwnerId:'owner:a',persisted:original})).toBe(true)
    expect(verifyCanonicalImportReadback({expectedId:job.id,expectedOwnerId:'owner:b',persisted:original})).toBe(false)
    expect(verifyCanonicalImportReadback({expectedId:job.id,expectedOwnerId:'owner:a'})).toBe(false)
    expect(verifyCanonicalImportReadback({expectedId:'wrong',expectedOwnerId:'owner:a',persisted:original})).toBe(false)
    expect(verifyCanonicalImportReadback({expectedId:job.id,expectedOwnerId:'owner:a',persisted:{
      ...original,opportunity:{...job,metadata:{...job.metadata,applicationAuthority:'AUTOMATIC'}}
    }})).toBe(false)
  })
  it('blocks empty database, missing source permission and agent persistence',()=>{
    const result=calculateOpportunityActivationReadiness({
      ownerId:'owner:a',stored:[],allowedSourceHosts:[],agentPersistenceConfigured:false,
    })
    expect(result.status).toBe('blocked')
    expect(result.blockers).toHaveLength(4)
    expect(result.privateIphoneCertified).toBe(false)
  })
  it('does not count other users or one-source listings as a research case',()=>{
    const stored:StoredCanonicalOpportunity[]=[
      {userId:'owner:b',triageState:'saved',opportunity:job},
      {userId:'owner:a',triageState:'saved',opportunity:job},
    ]
    const result=calculateOpportunityActivationReadiness({
      ownerId:'owner:a',stored,allowedSourceHosts:['example.com'],agentPersistenceConfigured:true,
    })
    expect(result.storedOpportunityCount).toBe(1)
    expect(result.publicJobCount).toBe(1)
    expect(result.potentiallyResearchableCount).toBe(0)
    expect(result.status).toBe('blocked')
  })
})
