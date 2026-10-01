import { describe, expect, it } from 'vitest'
import type { Opportunity, SideHustleExperiment, VentureScoutBatch } from '@jhadina/opportunity-core'
import {
  createAndPersistVentureRuntime,
  createAndPersistVentureValidationExperiment,
  loadVentureRuntimeState,
  recordAndPersistVentureCommercialOutcome,
  runAndPersistVentureScoutCycle,
  ventureRuntimeSoftwareEvidence,
  type VentureRuntimeRepository,
} from './venture-runtime'
import type { StoredCanonicalOpportunity } from './canonical'

const now='2026-10-01T17:00:00.000Z'

function baseOpportunity():Opportunity{
  return {
    id:'opportunity:venture-app',
    title:'Original neighborhood gift',
    family:'business',
    type:'commercial',
    sourceUrl:'https://example.test/opportunity',
    sourceName:'Fixture',
    claims:[],
    evidence:[{
      id:'evidence:canonical',
      sourceId:'source:canonical',
      sourceUrl:'https://example.test/opportunity',
      sourceName:'Fixture',
      sourceType:'user',
      capturedAt:now,
      confidence:0.9,
    }],
    verificationStatus:'unverified',
    sourceConfidence:0.9,
    riskFlags:[],
    metadata:{
      sideHustleProfile:{
        family:'pod_personalized_commerce',
        role:'standalone',
        automationMaturity:'unvalidated',
        executionOwners:['pupsonstuff','commerce'],
        monetizationModels:['print_on_demand_margin'],
      },
    },
    status:'discovered',
    createdAt:now,
    updatedAt:now,
  }
}

function repositoryFixture(){
  let stored:StoredCanonicalOpportunity={
    userId:'user:1',
    opportunity:baseOpportunity(),
    triageState:'review',
  }
  const experiments:SideHustleExperiment[]=[]
  const repository:VentureRuntimeRepository={
    async get(id){
      return stored.opportunity.id===id ? structuredClone(stored) : undefined
    },
    async upsert(userId,opportunity){
      stored={...stored,userId,opportunity:structuredClone(opportunity)}
      return structuredClone(stored)
    },
    async createSideHustleExperiment(experiment){
      experiments.push(structuredClone(experiment))
      return structuredClone(experiment)
    },
  }
  return {repository,getStored:()=>stored,getExperiments:()=>experiments}
}

function buildInput(opportunity:Opportunity):Parameters<typeof createAndPersistVentureRuntime>[1]{
  return {
    opportunity,
    family:'pod_personalized_commerce',
    demandThesis:{
      buyer:'Gift buyer',
      jobToBeDone:'Buy a personalized neighborhood gift.',
      paidProblem:'Generic gifts lack personal relevance.',
      marketMechanic:'Personalization + local nostalgia',
      unmetAngles:['Neighborhood variants'],
      disconfirmingEvidence:['Seasonality may matter'],
      evidenceRefs:['evidence:demand'],
    },
    signals:[
      {id:'signal:1',kind:'sales',sourceRef:'source:sales',observedAt:now,value:1200,unit:'sales',note:'Paid demand',confidence:0.9},
    ],
    scoreFactors:{
      demandProof:85,grossMarginPotential:80,automationPotential:90,competitionHeadroom:70,differentiation:85,
      startupEfficiency:90,timeToEvidence:85,repeatability:88,legalPlatformSafety:95,crossJhadinaLeverage:92,
    },
    makeSense:{
      coherence:90,causalLogic:88,chronology:85,incentives:90,baseRates:80,contradictionHandling:82,
      alternativesConsidered:84,evidenceQuality:86,notes:['Fixture'],evidenceRefs:['evidence:mitms'],
    },
    originalityInput:{
      marketMechanics:['personalization','local nostalgia'],
      competitorArtifactRefs:['competitor:1'],
      proposedCreative:'Original visual system and original copy.',
      evidenceRefs:['evidence:originality'],
    },
    evidenceRefs:['evidence:venture'],
    createdAt:now,
  }
}

describe('venture runtime persistence',()=>{
  it('persists the venture state into the canonical opportunity metadata',async()=>{
    const fixture=repositoryFixture()
    const result=await createAndPersistVentureRuntime('user:1',buildInput(fixture.getStored().opportunity),fixture.repository)
    expect(result.state.venture.opportunityId).toBe('opportunity:venture-app')
    expect(result.state.receipts.some((receipt)=>receipt.kind==='venture_snapshot')).toBe(true)
    const loaded=await loadVentureRuntimeState('opportunity:venture-app',fixture.repository)
    expect(loaded?.venture.id).toBe(result.state.venture.id)
  })

  it('runs read-only scouts and persists deduplicated signals plus receipts',async()=>{
    const fixture=repositoryFixture()
    await createAndPersistVentureRuntime('user:1',buildInput(fixture.getStored().opportunity),fixture.repository)
    const scan:VentureScoutBatch={
      scoutId:'scout:marketplace',
      source:'marketplace',
      capturedAt:'2026-10-01T17:05:00.000Z',
      signals:[
        {id:'signal:2',kind:'reviews',sourceRef:'source:reviews',observedAt:'2026-10-01T17:05:00.000Z',value:300,unit:'reviews',note:'Review velocity',confidence:0.8},
        {id:'signal:3',kind:'search',sourceRef:'source:search',observedAt:'2026-10-01T17:05:00.000Z',value:70,unit:'index',note:'Search demand',confidence:0.8},
      ],
      evidenceRefs:['scan:1'],
      externalMutationPerformed:false,
    }
    const result=await runAndPersistVentureScoutCycle({
      userId:'user:1',
      opportunityId:'opportunity:venture-app',
      scouts:[{id:'scout:marketplace',async scan(){return scan}}],
      capturedAt:scan.capturedAt,
      repository:fixture.repository,
    })
    expect(result.state.venture.signals).toHaveLength(3)
    expect(result.state.receipts.filter((receipt)=>receipt.kind==='market_scan')).toHaveLength(1)
  })

  it('creates a real canonical side-hustle experiment and records the bounded-experiment receipt',async()=>{
    const fixture=repositoryFixture()
    await createAndPersistVentureRuntime('user:1',buildInput(fixture.getStored().opportunity),fixture.repository)
    const result=await createAndPersistVentureValidationExperiment({
      userId:'user:1',
      opportunityId:'opportunity:venture-app',
      generatedAt:'2026-10-01T17:10:00.000Z',
      repository:fixture.repository,
    })
    expect(fixture.getExperiments()).toHaveLength(1)
    expect(result.experiment.requiresApproval).toBe(true)
    expect(result.state.receipts.some((receipt)=>receipt.kind==='experiment_proposal')).toBe(true)
  })

  it('records commercial outcome evidence without creating money authority',async()=>{
    const fixture=repositoryFixture()
    await createAndPersistVentureRuntime('user:1',buildInput(fixture.getStored().opportunity),fixture.repository)
    const result=await recordAndPersistVentureCommercialOutcome({
      userId:'user:1',
      opportunityId:'opportunity:venture-app',
      outcomeRef:'commerce:order:123',
      occurredAt:'2026-10-01T17:15:00.000Z',
      amount:34,
      currency:'usd',
      repository:fixture.repository,
    })
    const receipt=result.state.receipts.find((candidate)=>candidate.kind==='commercial_outcome')
    expect(receipt?.authorizationEffect).toBe('NONE')
    expect(receipt?.details?.currency).toBe('USD')
  })

  it('reports a complete software binding with no duplicate authority',()=>{
    const evidence=ventureRuntimeSoftwareEvidence()
    expect(evidence.duplicateAuthorityPaths).toBe(0)
    expect(evidence.moneyAuthorityIsExternal).toBe(true)
    expect(evidence.actionGovernanceBound).toBe(true)
  })
})
