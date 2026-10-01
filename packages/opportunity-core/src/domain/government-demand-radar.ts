export type GovernmentDemandObservationStage='sources_sought'|'presolicitation'|'solicitation'|'amendment'|'award'|'execution'|'closeout'

export type GovernmentDemandObservation={
  id:string
  buyer:string
  buyerRef?:string
  jurisdictionRef?:string
  title:string
  stage:GovernmentDemandObservationStage
  naicsCodes:string[]
  pscCodes:string[]
  keywords:string[]
  setAside?:string
  contractVehicle?:string
  awardeeName?:string
  awardeeRef?:string
  awardAmount?:number
  postedAt?:string
  awardDate?:string
  performanceEndDate?:string
  sourceRefs:string[]
}

export type GovernmentDemandProfile={
  buyer:string
  observationCount:number
  awardCount:number
  distinctNaicsCodes:string[]
  distinctPscCodes:string[]
  recurringKeywords:string[]
  observedVehicles:string[]
  incumbentNames:string[]
  evidenceRefs:string[]
}

const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const words=(value:string)=>value.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(v=>v.length>=4)

export function buildGovernmentDemandProfiles(observations:GovernmentDemandObservation[]):GovernmentDemandProfile[]{
  const groups=new Map<string,GovernmentDemandObservation[]>()
  for(const observation of observations){
    if(!observation.buyer.trim()||!observation.sourceRefs.length)continue
    const key=observation.buyer.trim().toLowerCase()
    const rows=groups.get(key)??[]
    rows.push(observation)
    groups.set(key,rows)
  }

  return [...groups.values()].map(rows=>{
    const frequency=new Map<string,number>()
    for(const row of rows){
      for(const token of uniq([...row.keywords,...words(row.title)])){
        frequency.set(token,(frequency.get(token)??0)+1)
      }
    }
    const recurringKeywords=[...frequency.entries()]
      .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
      .slice(0,30)
      .map(([token])=>token)
    return {
      buyer:rows[0]!.buyer,
      observationCount:rows.length,
      awardCount:rows.filter(row=>row.stage==='award').length,
      distinctNaicsCodes:uniq(rows.flatMap(row=>row.naicsCodes)),
      distinctPscCodes:uniq(rows.flatMap(row=>row.pscCodes)),
      recurringKeywords,
      observedVehicles:uniq(rows.map(row=>row.contractVehicle??'')),
      incumbentNames:uniq(rows.map(row=>row.awardeeName??'')),
      evidenceRefs:uniq(rows.flatMap(row=>row.sourceRefs)),
    }
  }).sort((a,b)=>b.observationCount-a.observationCount||a.buyer.localeCompare(b.buyer))
}

export type RecompeteWatch={
  observationId:string
  buyer:string
  title:string
  incumbentName?:string
  performanceEndDate:string
  watchStartDate:string
  daysUntilWatch:number
  status:'watch_later'|'watch_now'|'past_due'
  evidenceRefs:string[]
}

function isoDate(value:string){
  const parsed=new Date(value+'T00:00:00Z')
  return Number.isNaN(parsed.getTime())?undefined:parsed
}
function dateOnly(value:Date){return value.toISOString().slice(0,10)}

export function buildRecompeteWatches(input:{
  observations:GovernmentDemandObservation[]
  now?:string
  leadDays?:number
}):RecompeteWatch[]{
  const now=isoDate((input.now??new Date().toISOString()).slice(0,10))??new Date()
  const leadDays=Math.max(30,Math.min(input.leadDays??365,730))
  const dayMs=86_400_000
  const out:RecompeteWatch[]=[]
  for(const row of input.observations){
    if(!row.performanceEndDate||row.stage!=='award'||!row.sourceRefs.length)continue
    const end=isoDate(row.performanceEndDate)
    if(!end)continue
    const watch=new Date(end.getTime()-leadDays*dayMs)
    const daysUntilWatch=Math.ceil((watch.getTime()-now.getTime())/dayMs)
    out.push({
      observationId:row.id,
      buyer:row.buyer,
      title:row.title,
      incumbentName:row.awardeeName,
      performanceEndDate:dateOnly(end),
      watchStartDate:dateOnly(watch),
      daysUntilWatch,
      status:end.getTime()<now.getTime()?'past_due':watch.getTime()<=now.getTime()?'watch_now':'watch_later',
      evidenceRefs:row.sourceRefs,
    })
  }
  return out.sort((a,b)=>a.watchStartDate.localeCompare(b.watchStartDate)||a.observationId.localeCompare(b.observationId))
}

export type SolicitationQuestion={
  id:string
  question:string
  answer?:string
  sourceRef:string
}

export type SolicitationQaSignal={
  questionCount:number
  answeredCount:number
  topics:string[]
  unresolvedTopics:string[]
  engagementSignal:'none'|'observed'|'material'
  competitionInferenceAuthorized:false
  reasons:string[]
  evidenceRefs:string[]
}

const qaTopicRules:Array<[string,RegExp]>=[
  ['period_of_performance',/period of performance|performance period|start date|end date/i],
  ['cleanup',/clean ?up|debris|disposal/i],
  ['site_access',/background check|site access|escort|clearance|security/i],
  ['equipment_or_model',/model|brand|salient characteristic|equivalent|or equal/i],
  ['multiple_awards',/multiple award|number of awards|how many awards/i],
  ['pricing',/price|pricing|quote|cost|rate/i],
  ['scope',/scope|quantity|dimensions|specification|requirement/i],
]

export function analyzeSolicitationQa(questions:SolicitationQuestion[]):SolicitationQaSignal{
  const evidenceRefs=uniq(questions.map(q=>q.sourceRef))
  const matched=new Map<string,{questions:number;answered:number}>()
  for(const item of questions){
    const text=`${item.question} ${item.answer??''}`
    for(const [topic,re] of qaTopicRules){
      if(!re.test(text))continue
      const current=matched.get(topic)??{questions:0,answered:0}
      current.questions+=1
      if(item.answer?.trim())current.answered+=1
      matched.set(topic,current)
    }
  }
  const unresolvedTopics=[...matched.entries()].filter(([,v])=>v.answered<v.questions).map(([k])=>k)
  const questionCount=questions.length
  const answeredCount=questions.filter(q=>q.answer?.trim()).length
  const engagementSignal:SolicitationQaSignal['engagementSignal']=questionCount===0?'none':
    questionCount>=5||matched.size>=3?'material':'observed'
  const reasons:string[]=[]
  if(questionCount)reasons.push(`${questionCount} solicitation question(s) were observed; this is an engagement/clarification signal, not a bidder-count estimate.`)
  if(unresolvedTopics.length)reasons.push(`Unresolved Q&A topics: ${unresolvedTopics.join(', ')}.`)
  if(matched.has('multiple_awards'))reasons.push('The Q&A discusses number of awards; use the official answer when assessing award structure.')
  return {
    questionCount,
    answeredCount,
    topics:[...matched.keys()],
    unresolvedTopics,
    engagementSignal,
    competitionInferenceAuthorized:false,
    reasons,
    evidenceRefs,
  }
}

export type FulfillmentPatternInput={
  opportunityId:string
  deliverableType:'service'|'supply'|'staffing'|'lease'|'construction'|'mixed'|'unknown'
  primeMustOwnAsset?:boolean
  primeMustBeManufacturer?:boolean
  subcontractingRestricted?:boolean
  siteAccessRequired?:boolean
  backgroundCheckRequired?:boolean
  specializedEquipmentRequired?:boolean
  providerBenchCount?:number
  pricingEvidenceCount?:number
  evidenceRefs:string[]
}

export type FulfillmentPatternAssessment={
  opportunityId:string
  status:'subcontractable_candidate'|'conditional'|'review_required'|'blocked'
  reasons:string[]
  blockers:string[]
  humanReviewRequired:true
}

export function assessFulfillmentPattern(input:FulfillmentPatternInput):FulfillmentPatternAssessment{
  const reasons:string[]=[]
  const blockers:string[]=[]
  if(!input.evidenceRefs.length)blockers.push('Fulfillment pattern lacks source evidence.')
  if(input.subcontractingRestricted)blockers.push('Solicitation evidence indicates subcontracting is restricted.')
  if(input.primeMustOwnAsset)blockers.push('Opportunity requires prime ownership/control of the underlying asset.')
  if(input.primeMustBeManufacturer)blockers.push('Opportunity requires manufacturer status by the prime.')
  if(input.siteAccessRequired)reasons.push('Site-access requirements must be included in provider admission.')
  if(input.backgroundCheckRequired)reasons.push('Provider personnel must satisfy background/security access requirements.')
  if(input.specializedEquipmentRequired)reasons.push('Provider qualification must verify specialized equipment/capability.')
  if((input.providerBenchCount??0)<1)reasons.push('No qualified provider bench has been established yet.')
  if((input.pricingEvidenceCount??0)<1)reasons.push('No current provider pricing evidence has been established yet.')

  let status:FulfillmentPatternAssessment['status']='subcontractable_candidate'
  if(blockers.length)status='blocked'
  else if(!input.evidenceRefs.length||input.deliverableType==='unknown')status='review_required'
  else if(reasons.length)status='conditional'
  return {opportunityId:input.opportunityId,status,reasons,blockers,humanReviewRequired:true}
}
