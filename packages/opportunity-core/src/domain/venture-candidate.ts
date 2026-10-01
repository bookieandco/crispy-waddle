import type { Opportunity, OpportunityEvidence } from './opportunity.js'
import {
  buildSideHustleDiscoveryProvenance,
  buildSideHustleProfile,
  getSideHustleDefinition,
  type SideHustleFamily,
} from './side-hustles.js'
import type { VentureDemandThesis, VentureMarketSignal } from './venture-factory.js'

export type VentureCandidateRecommendation='research'|'hold'|'reject'

export type VentureCandidateProfile={
  seedId:string
  family:SideHustleFamily
  title:string
  buyer:string
  jobToBeDone:string
  paidProblem:string
  marketMechanic:string
  unmetAngles:string[]
}

export type VentureCandidateEvidenceScore={
  signalCount:number
  averageConfidence:number
  sourceDiversity:number
  kindDiversity:number
  recency:number
  total:number
}

export type VentureDiscoveryCandidate={
  id:string
  seedId:string
  family:SideHustleFamily
  title:string
  demandThesis:VentureDemandThesis
  signalIds:string[]
  sourceRefs:string[]
  score:VentureCandidateEvidenceScore
  recommendation:VentureCandidateRecommendation
  blockers:string[]
  createdAt:string
  updatedAt:string
  externalActionAuthorized:false
  automaticExperimentAuthorized:false
  directCreativeReplicationAuthorized:false
}

export function synthesizeVentureDiscoveryCandidate(input:{
  profile:VentureCandidateProfile
  signals:VentureMarketSignal[]
  generatedAt:string
}):VentureDiscoveryCandidate{
  requireDate(input.generatedAt,'generatedAt')
  if(!input.profile.seedId.trim())throw new Error('Candidate seedId is required')
  if(!input.profile.title.trim())throw new Error('Candidate title is required')
  if(!input.signals.length)throw new Error('Candidate synthesis requires market signals')

  const signals=dedupeSignals(input.signals)
  for(const signal of signals)validateSignal(signal)

  const averageConfidence=round(signals.reduce((sum,signal)=>sum+signal.confidence,0)/signals.length*100)
  const sources=new Set(signals.map(signal=>sourceIdentity(signal.sourceRef)))
  const kinds=new Set(signals.map(signal=>signal.kind))
  const sourceDiversity=round(Math.min(100,(sources.size/3)*100))
  const kindDiversity=round(Math.min(100,(kinds.size/3)*100))
  const recency=round(recencyScore(signals,input.generatedAt))
  const signalCountScore=Math.min(100,(signals.length/5)*100)
  const total=round(
    averageConfidence*0.35+
    sourceDiversity*0.20+
    kindDiversity*0.15+
    recency*0.15+
    signalCountScore*0.15
  )

  const blockers:string[]=[]
  if(signals.length<3)blockers.push('Fewer than three independent market observations are available.')
  if(sources.size<2)blockers.push('Market evidence lacks source diversity.')
  if(averageConfidence<60)blockers.push('Average source confidence is below 60.')
  if(recency<50)blockers.push('Market evidence is stale relative to the candidate synthesis time.')

  const recommendation:VentureCandidateRecommendation=
    blockers.length===0&&total>=70?'research':
    total>=50?'hold':'reject'

  const evidenceRefs=unique(signals.map(signal=>signal.sourceRef))
  const disconfirmingEvidence=[
    ...blockers,
    'Market evidence proves observed interest only; it does not prove profit, conversion, originality, or durable demand.',
  ]

  return{
    id:`venture-candidate:${input.profile.seedId}`,
    seedId:input.profile.seedId,
    family:input.profile.family,
    title:input.profile.title.trim(),
    demandThesis:{
      buyer:input.profile.buyer.trim(),
      jobToBeDone:input.profile.jobToBeDone.trim(),
      paidProblem:input.profile.paidProblem.trim(),
      marketMechanic:input.profile.marketMechanic.trim(),
      unmetAngles:unique(input.profile.unmetAngles),
      disconfirmingEvidence,
      evidenceRefs,
    },
    signalIds:signals.map(signal=>signal.id),
    sourceRefs:evidenceRefs,
    score:{
      signalCount:signals.length,
      averageConfidence,
      sourceDiversity,
      kindDiversity,
      recency,
      total,
    },
    recommendation,
    blockers,
    createdAt:input.generatedAt,
    updatedAt:input.generatedAt,
    externalActionAuthorized:false,
    automaticExperimentAuthorized:false,
    directCreativeReplicationAuthorized:false,
  }
}

export function ventureCandidateToOpportunity(candidate:VentureDiscoveryCandidate,input:{
  opportunityId?:string
  createdAt?:string
}={}):Opportunity{
  const createdAt=input.createdAt??candidate.updatedAt
  requireDate(createdAt,'createdAt')
  const evidence:OpportunityEvidence[]=candidate.sourceRefs.map((sourceRef,index)=>({
    id:`${candidate.id}:evidence:${index+1}`,
    sourceId:`${candidate.seedId}:source:${index+1}`,
    sourceUrl:isUrl(sourceRef)?sourceRef:'https://jhadina.local/venture-evidence',
    sourceName:isUrl(sourceRef)?hostname(sourceRef):sourceRef,
    sourceType:'secondary',
    capturedAt:createdAt,
    confidence:Math.min(1,Math.max(0,candidate.score.averageConfidence/100)),
  }))
  const sourceUrl=evidence.find(item=>item.sourceUrl!=='https://jhadina.local/venture-evidence')?.sourceUrl
    ??'https://jhadina.local/venture-candidates'
  const sideHustleProfile=buildSideHustleProfile({
    family:candidate.family,
    automationMaturity:'unvalidated',
  })
  const sideHustleDefinition=getSideHustleDefinition(candidate.family)
  const sideHustleDiscovery=buildSideHustleDiscoveryProvenance({
    candidateId:candidate.id,
    recommendation:candidate.recommendation,
    signalIds:candidate.signalIds,
    sourceRefs:candidate.sourceRefs,
    evidenceScore:candidate.score.total,
    stage:'research_candidate',
  })
  return{
    id:input.opportunityId?.trim()||`opportunity:${candidate.id}`,
    title:candidate.title,
    family:'business',
    type:'commercial',
    description:[
      candidate.demandThesis.paidProblem,
      candidate.demandThesis.marketMechanic,
      'This is an evidence-backed research candidate, not a claim of profitability.',
    ].join(' '),
    sourceUrl,
    sourceName:'Jhadina Venture Discovery',
    sourceId:candidate.id,
    claims:[],
    evidence,
    verificationStatus:'unverified',
    sourceConfidence:Math.min(1,Math.max(0,candidate.score.total/100)),
    fitScore:candidate.score.total,
    riskFlags:unique([
      ...(candidate.recommendation!=='research'?['venture_candidate_not_research_ready']:[]),
      'requires_make_it_make_sense',
      'requires_originality_gate',
      'requires_bounded_validation',
    ]),
    metadata:{
      sideHustleProfile,
      hubCategory:sideHustleDefinition.hubCategory,
      sideHustleDiscovery,
      sideHustleCandidateFamily:candidate.family,
      ventureCandidateId:candidate.id,
      ventureCandidateRecommendation:candidate.recommendation,
      ventureCandidateSignalIds:[...candidate.signalIds],
      ventureCandidateSourceRefs:[...candidate.sourceRefs],
      ventureCandidateScore:{...candidate.score},
      ventureCandidateDemandThesis:{...candidate.demandThesis},
      externalActionAuthorized:false,
      automaticExperimentAuthorized:false,
      directCreativeReplicationAuthorized:false,
      opportunityAuthority:'OPPORTUNITY_ONLY',
      requiresUserApproval:true,
    },
    status:'discovered',
    createdAt,
    updatedAt:createdAt,
  }
}

function dedupeSignals(signals:VentureMarketSignal[]):VentureMarketSignal[]{
  const byId=new Map<string,VentureMarketSignal>()
  for(const signal of signals){
    const prior=byId.get(signal.id)
    if(!prior||Date.parse(signal.observedAt)>=Date.parse(prior.observedAt))byId.set(signal.id,{...signal})
  }
  return[...byId.values()].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||a.id.localeCompare(b.id))
}

function recencyScore(signals:VentureMarketSignal[],generatedAt:string):number{
  const now=Date.parse(generatedAt)
  const ages=signals.map(signal=>Math.max(0,(now-Date.parse(signal.observedAt))/86_400_000))
  const averageAge=ages.reduce((sum,age)=>sum+age,0)/ages.length
  if(averageAge<=7)return 100
  if(averageAge<=30)return 85
  if(averageAge<=60)return 65
  if(averageAge<=120)return 45
  return 20
}

function sourceIdentity(value:string):string{
  if(isUrl(value))return hostname(value)
  return value.trim().toLowerCase()
}

function hostname(value:string):string{
  try{return new URL(value).hostname.toLowerCase()}catch{return value.trim().toLowerCase()}
}

function isUrl(value:string):boolean{
  try{const url=new URL(value);return url.protocol==='http:'||url.protocol==='https:'}catch{return false}
}

function validateSignal(signal:VentureMarketSignal):void{
  if(!signal.id.trim())throw new Error('signal.id is required')
  if(!signal.sourceRef.trim())throw new Error('signal.sourceRef is required')
  requireDate(signal.observedAt,'signal.observedAt')
  if(!Number.isFinite(signal.confidence)||signal.confidence<0||signal.confidence>1){
    throw new Error('signal.confidence must be between 0 and 1')
  }
}

function requireDate(value:string,field:string):void{
  if(!value.trim()||!Number.isFinite(Date.parse(value)))throw new Error(field+' must be a valid date')
}

function unique(values:string[]):string[]{
  return[...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function round(value:number):number{return Math.round(value*100)/100}
