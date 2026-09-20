import { describe,expect,it } from 'vitest'
import { adaptSamOpportunity } from '@jhadina/opportunity-core'
import { auditSamProductionIngestion } from './sam-production-audit'
describe('SAM production ingestion audit',()=>{
 it('detects duplicates before persistence',()=>{
  const o=adaptSamOpportunity({noticeId:'1',title:'Cloud',sourceUrl:'https://sam.gov/opp/1/view',fetchedAt:'2026-09-20T00:00:00Z'})
  const result=auditSamProductionIngestion([o,o],'2026-09-20T00:00:00Z')
  expect(result.status).toBe('blocked')
  expect(result.duplicateIds).toEqual(['sam:1'])
 })
 it('flags expired notices for review without granting authority',()=>{
  const o=adaptSamOpportunity({noticeId:'2',title:'Cloud',responseDeadline:'2026-09-19T00:00:00Z',sourceUrl:'https://sam.gov/opp/2/view',fetchedAt:'2026-09-18T00:00:00Z'})
  expect(auditSamProductionIngestion([o],'2026-09-20T00:00:00Z').status).toBe('review_required')
 })
})
