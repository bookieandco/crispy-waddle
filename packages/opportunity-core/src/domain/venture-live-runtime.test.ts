import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import {
  buildVentureOpportunity,
  createVentureWorkflow,
  type VentureAgent,
  type VentureWorkItem,
} from './venture-factory.js'
import {
  appendVentureRuntimeReceipts,
  certifyVentureRuntime,
  createVentureRuntimeReceipt,
  deriveVentureLiveEvidence,
  initializeVentureRuntimeState,
  mergeVentureSignals,
  normalizeVentureScoutBatch,
  recordSpatialRuntimeProjection,
  recordSupervisorRepair,
  runVentureSupervisorRuntime,
} from './venture-live-runtime.js'

const now='2026-10-01T16:00:00.000Z'

const opportunity:Opportunity={
  id:'opportunity:venture-live',
  title:'Original personalized product',
  family:'business',
  type:'commercial',
  sourceUrl:'https://example.test',
  sourceName:'Fixture',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:0.8,
  riskFlags:[],
  status:'discovered',
  createdAt:now,
  updatedAt:now,
}

const venture=buildVentureOpportunity({
  opportunity,
  family:'pod_personalized_commerce',
  demandThesis:{
    buyer:'Gift buyer',
    jobToBeDone:'Buy an original personalized gift.',
    paidProblem:'Generic gifts lack personal relevance.',
    marketMechanic:'Personalization + nostalgia',
    unmetAngles:['Neighborhood-specific variants'],
    disconfirmingEvidence:['Potential seasonality'],
    evidenceRefs:['evidence:demand'],
  },
  signals:[
    {id:'signal:1',kind:'sales',sourceRef:'source:1',observedAt:now,value:1000,unit:'sales',note:'Paid demand',confidence:0.9},
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
    marketMechanics:['personalization'],
    competitorArtifactRefs:['competitor:1'],
    proposedCreative:'Original product language and original illustration.',
    evidenceRefs:['evidence:originality'],
  },
  evidenceRefs:['evidence:venture'],
  createdAt:now,
})

{
  const batch=normalizeVentureScoutBatch({
    scoutId:'scout:etsy',
    source:'marketplace',
    capturedAt:now,
    signals:[
      {id:'signal:2',kind:'reviews',sourceRef:'source:2',observedAt:now,value:500,unit:'reviews',note:'Review velocity',confidence:0.8},
    ],
    evidenceRefs:['scan:1'],
    externalMutationPerformed:false,
  })
  assert.equal(batch.externalMutationPerformed,false)
  const merged=mergeVentureSignals(venture.signals,[batch])
  assert.equal(merged.length,2)
}

let state=initializeVentureRuntimeState({venture})

{
  const receipt=createVentureRuntimeReceipt({
    ventureId:venture.id,
    kind:'experiment_proposal',
    occurredAt:now,
    evidenceRefs:['experiment:1'],
  })
  state={...state,receipts:appendVentureRuntimeReceipts(state.receipts,[receipt,receipt])}
  assert.equal(state.receipts.length,1)
}

{
  const work:VentureWorkItem={
    id:'work:stale',
    ventureId:venture.id,
    agentId:'agent:research',
    step:'market research',
    status:'running',
    createdAt:'2026-09-30T10:00:00.000Z',
    updatedAt:'2026-09-30T10:00:00.000Z',
    evidenceRefs:['work:1'],
    outputRefs:[],
    spendUsd:1,
    authorizationEffect:'NONE',
  }
  state={...state,workItems:[work]}
  state=runVentureSupervisorRuntime({
    state,
    now,
    evidenceRefs:['supervisor:scan'],
  })
  assert.ok(state.supervisorIssues.some((issue)=>issue.kind==='stalled'))
  const issue=state.supervisorIssues.find((candidate)=>candidate.kind==='stalled')!
  state=recordSupervisorRepair({
    state,
    issueId:issue.id,
    repairSummary:'Requeued work with a fresh lease.',
    evidenceRefs:['repair:1'],
    repairedAt:'2026-10-01T16:05:00.000Z',
  })
  assert.equal(state.receipts.filter((receipt)=>receipt.kind==='supervisor_repair').length,1)
}

{
  const agents:VentureAgent[]=[
    {id:'agent:research',name:'Scout',class:'market_scout',capabilities:['market_research'],executionOwners:['opportunity'],maxConcurrentWork:2,active:true},
  ]
  const workflow=createVentureWorkflow({
    id:'workflow:research',
    name:'Research line',
    nodes:[{id:'research',agentClass:'market_scout',capability:'market_research'}],
    edges:[],
    limits:{maxHops:4,maxUsdPerWorkItem:2},
  })
  state=recordSpatialRuntimeProjection({
    state,
    rooms:[{id:'room:research',name:'Research Lab',capabilityScope:['market_research'],agentIds:['agent:research'],workflowIds:['workflow:research']}],
    agents,
    workflows:[workflow],
    generatedAt:'2026-10-01T16:10:00.000Z',
    evidenceRefs:['spatial:receipt'],
  })
  assert.equal(state.hq?.law,'PROJECT_PROVABLE_RUNTIME_STATE_ONLY')
}

{
  const commercial=createVentureRuntimeReceipt({
    ventureId:venture.id,
    kind:'commercial_outcome',
    occurredAt:'2026-10-01T16:15:00.000Z',
    evidenceRefs:['order:1'],
  })
  state={
    ...state,
    venture:{...state.venture,signals:[
      ...state.venture.signals,
      {id:'signal:2',kind:'reviews',sourceRef:'source:2',observedAt:now,note:'Reviews',confidence:0.8},
      {id:'signal:3',kind:'search',sourceRef:'source:3',observedAt:now,note:'Search demand',confidence:0.8},
    ]},
    receipts:appendVentureRuntimeReceipts(state.receipts,[commercial]),
  }
  const live=deriveVentureLiveEvidence(state)
  assert.equal(live.discoveredSignals,3)
  assert.equal(live.boundedExperiments,1)
  assert.equal(live.realizedCommercialOutcomes,1)
  assert.equal(live.supervisorRepairReceipts,1)
  assert.equal(live.spatialRuntimeReceipts,1)

  const report=certifyVentureRuntime({
    state,
    software:{
      opportunitySchemaBound:true,
      marketSignalsBound:true,
      originalityGateBound:true,
      makeSenseVoteBound:true,
      experimentBridgeBound:true,
      lifecycleBound:true,
      supervisorBound:true,
      memoryBound:true,
      portfolioAllocatorBound:true,
      spatialProjectionBound:true,
      actionGovernanceBound:true,
      moneyAuthorityIsExternal:true,
      duplicateAuthorityPaths:0,
    },
  })
  assert.equal(report.status,'pass')
}

console.log('venture live runtime tests passed')
