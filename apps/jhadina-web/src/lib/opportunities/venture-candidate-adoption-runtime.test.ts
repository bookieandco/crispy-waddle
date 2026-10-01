import { describe, expect, it } from 'vitest'
import type { VentureDiscoveryCandidate } from '@jhadina/opportunity-core'
import { normalizeDiscoveryPolicy, runVentureCandidateAutoAdoption } from './venture-candidate-adoption-runtime'

const candidate:VentureDiscoveryCandidate={
  id:'venture-candidate:test',
  seedId:'test',
  family:'software_apps',
  title:'Test candidate',
  demandThesis:{
    buyer:'buyer',jobToBeDone:'job',paidProblem:'problem',marketMechanic:'mechanic',
    unmetAngles:['angle'],disconfirmingEvidence:['unknown profit'],evidenceRefs:['https://a.example'],
  },
  signalIds:['s1','s2','s3'],
  sourceRefs:['https://a.example','https://b.example','https://c.example'],
  score:{signalCount:3,averageConfidence:80,sourceDiversity:100,kindDiversity:100,recency:100,total:86},
  recommendation:'research',
  blockers:[],
  createdAt:'2026-10-01T18:00:00.000Z',
  updatedAt:'2026-10-01T18:00:00.000Z',
  externalActionAuthorized:false,
  automaticExperimentAuthorized:false,
  directCreativeReplicationAuthorized:false,
}

describe('venture candidate auto adoption',()=>{
  it('adopts only policy-eligible research candidates into Opportunity, not execution',async()=>{
    let calls=0
    const policy=normalizeDiscoveryPolicy({
      ownerUserId:'user-1',
      enabled:true,
      autoAdoptCandidates:true,
      minimumCandidateScore:75,
      allowedFamilies:['software_apps'],
      maxAdoptionsPerRun:2,
      updatedAt:'2026-10-01T18:00:00.000Z',
    })
    const result=await runVentureCandidateAutoAdoption({} as never,{
      repository:{
        async listAutoAdoptPolicies(){return[policy]},
        async listCandidates(){return[candidate]},
        async listCandidateAdoptions(){return[]},
      },
      async adopt(owner,candidateValue,opportunity){
        calls+=1
        expect(owner).toBe('user-1')
        expect(opportunity.status).toBe('discovered')
        expect(opportunity.metadata?.ventureCandidateId).toBe(candidateValue.id)
        return{adopted:true,candidateId:candidateValue.id,opportunityId:opportunity.id}
      },
    })
    expect(calls).toBe(1)
    expect(result.adopted).toBe(1)
    expect(result.ventureLaunchAuthorized).toBe(false)
    expect(result.automaticExperimentAuthorized).toBe(false)
    expect(result.moneyMovementAuthorized).toBe(false)
  })

  it('does not re-adopt existing candidates',async()=>{
    const policy=normalizeDiscoveryPolicy({ownerUserId:'user-1',enabled:true,autoAdoptCandidates:true,updatedAt:'2026-10-01T18:00:00.000Z'})
    const result=await runVentureCandidateAutoAdoption({} as never,{
      repository:{
        async listAutoAdoptPolicies(){return[policy]},
        async listCandidates(){return[candidate]},
        async listCandidateAdoptions(){return[{ownerUserId:'user-1',candidateId:candidate.id,opportunityId:'o',status:'adopted',adoptedAt:'2026-10-01T18:00:00.000Z',payload:{}}]},
      },
      async adopt(){throw new Error('should not be called')},
    })
    expect(result.considered).toBe(0)
    expect(result.adopted).toBe(0)
  })
})
