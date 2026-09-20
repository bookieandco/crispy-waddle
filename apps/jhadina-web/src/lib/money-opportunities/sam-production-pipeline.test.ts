import { describe, expect, it } from 'vitest'
import { adaptSamOpportunity, createFulfillmentProvider, advanceFulfillmentProviderStage, type FulfillmentProvider } from '@jhadina/opportunity-core'
import { buildSamProductionCandidate } from './sam-production-pipeline'

function provider(now:string):FulfillmentProvider{
  const evidence=[
    {id:'identity',kind:'entity_record' as const,relationship:'supports_identity' as const,sourceId:'sam',capturedAt:now,confidence:1},
    {id:'cap',kind:'capability_record' as const,relationship:'supports_capability' as const,sourceId:'award',capturedAt:now,confidence:1},
    {id:'capacity',kind:'capacity_record' as const,relationship:'supports_capacity' as const,sourceId:'attestation',capturedAt:now,confidence:1},
    {id:'geo',kind:'official_source' as const,relationship:'supports_geography' as const,sourceId:'sam',capturedAt:now,confidence:1},
  ]
  let p=createFulfillmentProvider({
    id:'provider:1',legalName:'Provider One',
    identifiers:[{type:'uei',value:'UEI1',verified:true,evidenceRefs:['identity']}],
    serviceAreas:[{country:'United States',evidenceRefs:['geo']}],
    capabilities:[{id:'cloud',name:'Cloud migration services',naicsCodes:['541512'],pscCodes:[],keywords:['cloud','migration','services'],confidence:1,verified:true,evidenceRefs:['cap']}],
    credentials:[],pastPerformance:[],
    capacity:{status:'available',evidenceRefs:['capacity']},
    evidence,sourceIds:['sam'],riskFlags:[],
  },now)
  p=advanceFulfillmentProviderStage(p,'evidence_collected',now)
  p=advanceFulfillmentProviderStage(p,'identity_verified',now)
  p=advanceFulfillmentProviderStage(p,'capability_verified',now)
  return advanceFulfillmentProviderStage(p,'verified',now)
}

describe('SAM production candidate pipeline',()=>{
  it('builds a reviewable candidate but never grants execution authority',()=>{
    const now='2026-09-20T00:00:00Z'
    const opportunity=adaptSamOpportunity({
      noticeId:'prod-1',title:'Cloud migration services',noticeType:'Solicitation',
      naicsCode:'541512',placeOfPerformance:'United States',responseDeadline:'2026-10-20T00:00:00Z',estimatedValue:100000,
      description:'Cloud migration services for secure application workloads with architecture implementation operations monitoring documentation transition planning and technical delivery requirements.',sourceUrl:'https://sam.gov/opp/prod-1/view',fetchedAt:now,
    })
    const result=buildSamProductionCandidate(opportunity,[provider(now)],now)
    expect(result.fulfillment.structure).toBe('direct_fulfillment')
    expect(result.executionAuthorized).toBe(false)
    expect(result.status).not.toBe('blocked')
  })
  it('fails closed when no provider can cover required work',()=>{
    const now='2026-09-20T00:00:00Z'
    const opportunity=adaptSamOpportunity({
      noticeId:'prod-2',title:'Cybersecurity assessment',noticeType:'Solicitation',
      description:'Cybersecurity assessment',sourceUrl:'https://sam.gov/opp/prod-2/view',fetchedAt:now,
    })
    const result=buildSamProductionCandidate(opportunity,[],now)
    expect(result.status).toBe('blocked')
    expect(result.executionAuthorized).toBe(false)
  })
})
