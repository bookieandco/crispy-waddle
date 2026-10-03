import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import type { OpportunityPursuitCase, PursuitTaskKind } from './pursuit.js'
import {
  buildSideHustleDiscoveryProvenance,
  buildSideHustleProfile,
} from './side-hustles.js'
import {
  completeSideHustleExperiment,
  createSideHustleExperiment,
  startSideHustleExperiment,
  type SideHustleExperimentEvaluation,
} from './side-hustle-experiment.js'
import { calculateOpportunityOutcome } from './outcome.js'
import {
  applySideHustleLabValidationEvaluation,
  assessSideHustleLabValidationAdmission,
  buildSideHustleLabOutcomeLearning,
  certifySideHustleLiveFinal,
  completeSideHustleLabResearch,
  projectSideHustleLabPortfolioLearning,
} from './side-hustle-lab.js'

const now='2026-10-02T18:00:00.000Z'
const gateRefs={
  demand:'evidence:demand',
  mitms:'evidence:mitms',
  originality:'evidence:originality',
}

const discovery=buildSideHustleDiscoveryProvenance({
  candidateId:'venture-candidate:lab-test',
  recommendation:'research',
  signalIds:['signal:1','signal:2','signal:3'],
  sourceRefs:['source:1','source:2','source:3'],
  evidenceScore:88,
})

const opportunity:Opportunity={
  id:'opportunity:venture-candidate:lab-test',
  title:'Original neighborhood gift',
  family:'business',
  type:'commercial',
  description:'An original personalized gift for a defined local buyer.',
  sourceUrl:'https://example.test/venture',
  sourceName:'Jhadina Venture Discovery',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:.88,
  fitScore:88,
  riskFlags:['requires_make_it_make_sense','requires_originality_gate','requires_bounded_validation'],
  metadata:{
    sideHustleProfile:buildSideHustleProfile({family:'pod_personalized_commerce'}),
    sideHustleDiscovery:{...discovery,stage:'researching'},
    ventureLabResearchIntake:{
      origin:'venture_factory',
      candidateId:discovery.candidateId,
      researchCaseId:'research:opportunity:venture-candidate:lab-test',
      stage:'researching',
      approvedAt:'2026-10-02T17:00:00.000Z',
      authority:'RESEARCH_ONLY',
      requiredGates:['demand_thesis','make_it_make_sense','originality_ip'],
      externalActionAuthorized:false,
      automaticExperimentAuthorized:false,
      moneyMovementAuthorized:false,
    },
  },
  status:'ready',
  createdAt:'2026-10-02T16:00:00.000Z',
  updatedAt:'2026-10-02T18:00:00.000Z',
}

const taskKinds:PursuitTaskKind[]=[
  'verify_source','verify_economics','verify_requirements','verify_deadline',
  'verify_provider','assess_margin','assess_capability','assess_competition','assess_compliance',
  'assess_demand_thesis','assess_make_it_make_sense','assess_originality_ip',
]
const pursuitCase:OpportunityPursuitCase={
  id:'research:opportunity:venture-candidate:lab-test',
  opportunityId:opportunity.id,
  title:'Research: Original neighborhood gift',
  status:'ready',
  tasks:taskKinds.map((kind,index)=>({
    id:`research:lab:task:${index+1}`,
    kind,
    title:kind,
    required:true,
    status:'completed',
    createdAt:'2026-10-02T17:00:00.000Z',
    completedAt:'2026-10-02T17:30:00.000Z',
    evidenceRefs:[
      kind==='assess_demand_thesis'?gateRefs.demand:
      kind==='assess_make_it_make_sense'?gateRefs.mitms:
      kind==='assess_originality_ip'?gateRefs.originality:
      `evidence:${kind}`
    ],
  })),
  createdAt:'2026-10-02T17:00:00.000Z',
  updatedAt:'2026-10-02T17:30:00.000Z',
}

const signals=[
  {id:'signal:1',kind:'sales' as const,sourceRef:'source:1',observedAt:now,value:100,unit:'sales',note:'Paid demand',confidence:.9},
  {id:'signal:2',kind:'reviews' as const,sourceRef:'source:2',observedAt:now,value:75,unit:'reviews',note:'Review demand',confidence:.85},
  {id:'signal:3',kind:'buyer_pain' as const,sourceRef:'source:3',observedAt:now,note:'Buyer wants more local personalization',confidence:.8},
]

const synthesis={
  signals,
  demandThesis:{
    buyer:'Local gift buyers',
    jobToBeDone:'Find a personal gift that feels specific to the recipient.',
    paidProblem:'Generic gifts do not feel personal enough.',
    marketMechanic:'Personalization plus local identity.',
    unmetAngles:['Original neighborhood-specific options'],
    disconfirmingEvidence:['Demand could be seasonal.'],
    evidenceRefs:[gateRefs.demand],
  },
  unitEconomics:{
    currency:'USD',
    expectedPrice:40,
    expectedVariableCost:18,
    expectedGrossMargin:.55,
  },
  scoreFactors:{
    demandProof:90,
    grossMarginPotential:82,
    automationPotential:88,
    competitionHeadroom:78,
    differentiation:90,
    startupEfficiency:90,
    timeToEvidence:88,
    repeatability:86,
    legalPlatformSafety:96,
    crossJhadinaLeverage:94,
  },
  makeSense:{
    coherence:90,
    causalLogic:88,
    chronology:85,
    incentives:90,
    baseRates:82,
    contradictionHandling:84,
    alternativesConsidered:86,
    evidenceQuality:90,
    notes:['Demand is supported by multiple observed signals.'],
    evidenceRefs:[gateRefs.mitms],
  },
  originalityInput:{
    marketMechanics:['personalization','local identity'],
    competitorArtifactRefs:['competitor:listing:1'],
    proposedCreative:'Original typography, original illustration, and original neighborhood-specific copy.',
    evidenceRefs:[gateRefs.originality],
  },
  evidenceRefs:['evidence:research-complete'],
  synthesizedAt:now,
}

const completed=completeSideHustleLabResearch({
  opportunity,
  pursuitCase,
  synthesis,
})
assert.equal(completed.venture.lifecycle,'researched')
assert.equal(completed.completion.decision,'eligible_for_validation')
assert.equal(completed.completion.authority,'RESEARCH_ONLY')
assert.equal(completed.completion.externalActionAuthorized,false)

const admission=assessSideHustleLabValidationAdmission({
  opportunity,
  pursuitCase,
  venture:completed.venture,
  completion:completed.completion,
  admittedAt:'2026-10-02T18:05:00.000Z',
})
assert.equal(admission.decision,'eligible')
assert.equal(admission.requiresApproval,true)
assert.equal(admission.authorizationEffect,'NONE')
assert.ok(admission.proposal)

const proposal=admission.proposal!
let experiment=createSideHustleExperiment({
  opportunity,
  hypothesis:proposal.hypothesis,
  targetCustomer:proposal.targetCustomer,
  channel:proposal.channel,
  offer:proposal.offer,
  maxSpend:proposal.maxSpend,
  currency:proposal.currency,
  maxHours:proposal.maxHours,
  maxDurationDays:proposal.maxDurationDays,
  minimumObservations:proposal.minimumObservations,
  successCriteria:proposal.successCriteria,
  killCriteria:proposal.killCriteria,
  evidenceRefs:proposal.evidenceRefs,
  createdAt:'2026-10-02T18:10:00.000Z',
})
experiment=startSideHustleExperiment(experiment,'2026-10-02T18:11:00.000Z')
experiment=completeSideHustleExperiment(experiment,'2026-10-02T18:20:00.000Z')
const evaluation:SideHustleExperimentEvaluation={
  experimentId:experiment.id,
  opportunityId:opportunity.id,
  decision:'promote',
  observationCount:50,
  totalSpend:25,
  totalHours:2,
  successCriteriaMet:experiment.successCriteria.map((criterion)=>criterion.id),
  successCriteriaMissed:[],
  killCriteriaMet:[],
  evidenceRefs:['evidence:paid-order','transaction:order-1'],
  reasons:['Observed paid order within bounded validation.'],
  evaluatedAt:'2026-10-02T18:21:00.000Z',
}

const validation=applySideHustleLabValidationEvaluation({
  venture:completed.venture,
  admission,
  experiment,
  evaluation,
  recordedAt:'2026-10-02T18:22:00.000Z',
})
assert.equal(validation.venture.lifecycle,'validated')
assert.equal(validation.lifecycleEffect,'validated')

const outcome=calculateOpportunityOutcome({
  id:'outcome:lab:1',
  opportunityId:opportunity.id,
  result:'won',
  currency:'USD',
  grossRevenue:40,
  directCosts:18,
  fees:2,
  refunds:0,
  hours:1,
  sourceOwner:'commerce',
  evidenceRefs:['evidence:paid-order'],
  transactionRefs:['transaction:order-1'],
  executionRef:'execution:commerce:1',
  observedAt:'2026-10-02T18:25:00.000Z',
})
const wonOpportunity={...opportunity,status:'won' as const,updatedAt:outcome.observedAt}
const learning=buildSideHustleLabOutcomeLearning({
  opportunity:wonOpportunity,
  venture:validation.venture,
  experiment,
  evaluation,
  outcome,
  assessedAt:'2026-10-02T18:26:00.000Z',
})
assert.equal(learning.memories.length,3)
assert.equal(learning.maturityAssessment?.decision,'eligible')
assert.equal(learning.maturityAssessment?.to,'human_delivered')
assert.equal(learning.automaticMaturityPromotionAuthorized,false)

const projection=projectSideHustleLabPortfolioLearning({
  ventures:[validation.venture],
  memories:learning.memories,
  workItems:[],
  supervisorIssues:[],
  maturityAssessments:learning.maturityAssessment?[learning.maturityAssessment]:[],
  generatedAt:'2026-10-02T18:27:00.000Z',
})
assert.equal(projection.janet.authority,'MEMORY_CONTEXT_ONLY')
assert.equal(projection.delia.authority,'STRATEGY_ONLY')
assert.equal(projection.delia.moneyMovementAuthorized,false)
assert.equal(projection.marisa.authority,'OPERATIONS_COORDINATION_ONLY')
assert.equal(projection.marisa.automaticExternalActionAuthorized,false)
assert.equal(projection.jhadina.authority,'GOVERNANCE_ONLY')
assert.equal(projection.law,'PROJECT_PROVABLE_RUNTIME_STATE_ONLY')

const blocked=completeSideHustleLabResearch({
  opportunity,
  pursuitCase,
  synthesis:{
    ...synthesis,
    scoreFactors:{...synthesis.scoreFactors,demandProof:20,grossMarginPotential:20},
    makeSense:{...synthesis.makeSense,coherence:55,causalLogic:55,chronology:55,incentives:55,baseRates:55,contradictionHandling:55,alternativesConsidered:55,evidenceQuality:55},
  },
})
assert.notEqual(blocked.completion.decision,'eligible_for_validation')
const blockedAdmission=assessSideHustleLabValidationAdmission({
  opportunity,
  pursuitCase,
  venture:blocked.venture,
  completion:blocked.completion,
  admittedAt:'2026-10-02T18:30:00.000Z',
})
assert.equal(blockedAdmission.decision,'blocked')
assert.equal(blockedAdmission.proposal,undefined)

const software={
  researchToVentureBound:true,
  validationAdmissionBound:true,
  canonicalExperimentBound:true,
  outcomeToMemoryBound:true,
  outcomeToMaturityBound:true,
  personaProjectionBound:true,
  canonicalOpportunityAuthorityPreserved:true,
  moneyAuthorityExternal:true,
  automaticMaturityPromotionDisabled:true,
  duplicateAuthorityPaths:0,
}
const blockedFinal=certifySideHustleLiveFinal({
  software,
  live:{
    researchCompletions:1,
    eligibleValidationAdmissions:1,
    promotedValidationExperiments:1,
    realizedOutcomes:0,
    memoryCommits:0,
    maturityAssessments:0,
    personaProjections:0,
    unauthorizedExternalActions:0,
    automaticMaturityPromotions:0,
  },
})
assert.equal(blockedFinal.softwareStatus,'pass')
assert.equal(blockedFinal.liveStatus,'blocked')
assert.equal(blockedFinal.status,'blocked')

const passingFinal=certifySideHustleLiveFinal({
  software,
  live:{
    researchCompletions:1,
    eligibleValidationAdmissions:1,
    promotedValidationExperiments:1,
    realizedOutcomes:1,
    memoryCommits:learning.memories.length,
    maturityAssessments:1,
    personaProjections:1,
    unauthorizedExternalActions:0,
    automaticMaturityPromotions:0,
  },
})
assert.equal(passingFinal.status,'pass')
assert.equal(passingFinal.externalActionAuthorized,false)
assert.equal(passingFinal.moneyMovementAuthorized,false)
assert.equal(passingFinal.automaticMaturityPromotionAuthorized,false)

console.log('side hustle lab .2-.5 + live final tests passed')
