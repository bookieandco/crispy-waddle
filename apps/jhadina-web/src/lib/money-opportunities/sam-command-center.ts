export type SamRequirementView={
  id:string
  label:string
  sourceRef?:string
  confidence?:number
}

export type SamProviderView={
  requirementId:string
  providerKey:string
  providerName:string
  country?:string
  uei?:string
  cage?:string
  score:number
  status:'candidate'|'review_required'|'blocked'
  sourceTypes:string[]
}

export type SamTeamAssignmentView={
  providerKey:string
  providerName:string
  requirementIds:string[]
  sourceTypes:string[]
  score:number
  reviewRequired:boolean
}

export type SamQuoteTargetView={
  providerKey:string
  providerName:string
  requirementIds:string[]
  status:string
}

export type SamProviderBenchView={
  requirementId:string
  targetCandidateCount:number
  candidateCount:number
  corroboratedCount:number
  qualifiedCount:number
  status:'COVERAGE_HEALTHY'|'MARKET_CONSTRAINED'|'DISCOVERY_INCOMPLETE'|'unknown'
  blockers:string[]
}

export type SamCommercialView={
  status:'quote_required'|'review_required'|'blocked'|'unknown'
  contractValue:number|null
  providerCost:number|null
  estimatedGrossProfit:number|null
  estimatedMarginPercent:number|null
  blockers:string[]
  assumptions:string[]
}

export type SamCommandCenterItem={
  noticeId:string
  solicitationNumber?:string
  title:string
  agency?:string
  office?:string
  postedDate?:string
  responseDeadline?:string
  naicsCodes:string[]
  classificationCodes:string[]
  setAside?:string
  sourceUrl:string
  version:number
  lastSeenAt?:string
  requirements:SamRequirementView[]
  subcontractability:{
    status:'pass'|'conditional'|'review_required'|'blocked'|'unknown'
    hardBlockers:string[]
    conditions:string[]
    detectedRules:string[]
  }
  capture:{
    stage:'discovery'|'sources_sought'|'presolicitation'|'solicitation'|'amendment'|'award'|'execution'|'closeout'|'unknown'
    captureValue:'low'|'medium'|'high'|'unknown'
    awardReadiness:'not_award_stage'|'developing'|'ready_for_pursuit'|'unknown'
    reasons:string[]
  }
  providers:SamProviderView[]
  pursuitStatus:'ready_for_quote'|'review_required'|'blocked'|'not_generated'
  assignments:SamTeamAssignmentView[]
  uncoveredRequirementIds:string[]
  quoteTargets:SamQuoteTargetView[]
  providerBench:SamProviderBenchView[]
  commercial:SamCommercialView
  blockers:string[]
  authority:{
    humanApprovalRequired:true
    outreachAuthorized:false
    bidSubmissionAuthorized:false
    contractExecutionAuthorized:false
    paymentAuthorized:false
  }
}

export type SamCommandCenterResponse={
  items:SamCommandCenterItem[]
  summary:{
    total:number
    readyForQuote:number
    reviewRequired:number
    blocked:number
    providers:number
  }
}

type Row=Record<string,unknown>
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((row):row is Row=>Boolean(row&&typeof row==='object')):[]
const object=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{}
const string=(value:unknown)=>typeof value==='string'?value.trim():''
const strings=(value:unknown)=>Array.isArray(value)?[...new Set(value.filter((item):item is string=>typeof item==='string').map(item=>item.trim()).filter(Boolean))]:[]
const numberOrNull=(value:unknown)=>{
  if(typeof value==='number'&&Number.isFinite(value))return value
  if(typeof value==='string'&&value.trim()){
    const parsed=Number(value)
    if(Number.isFinite(parsed))return parsed
  }
  return null
}
const status=<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T=>{
  const candidate=string(value) as T
  return allowed.includes(candidate)?candidate:fallback
}

export function projectSamCommandCenter(input:{
  catalog:Row[]
  analyses:Row[]
  providers:Row[]
  pursuits:Row[]
}):SamCommandCenterResponse{
  const analyses=new Map(input.analyses.map(row=>[string(row.notice_id),row]))
  const providersByNotice=new Map<string,Row[]>()
  for(const provider of input.providers){
    const noticeId=string(provider.notice_id)
    if(!noticeId)continue
    const current=providersByNotice.get(noticeId)??[]
    current.push(provider)
    providersByNotice.set(noticeId,current)
  }
  const pursuits=new Map(input.pursuits.map(row=>[string(row.notice_id),row]))

  const items=input.catalog.map((catalog):SamCommandCenterItem=>{
    const noticeId=string(catalog.notice_id)
    const analysis=analyses.get(noticeId)
    const subcontractability=object(analysis?.subcontractability)
    const operating=object(analysis?.operating)
    const capture=object(operating.capture)
    const pursuit=pursuits.get(noticeId)
    const commercial=object(pursuit?.commercial)

    const requirements=rows(analysis?.requirements).map((requirement,index)=>{
      const confidence=numberOrNull(requirement.confidence)
      const sourceRef=string(requirement.sourceRef)
      return {
        id:string(requirement.id)||noticeId+':requirement:'+(index+1),
        label:string(requirement.label)||'Solicitation requirement',
        ...(sourceRef?{sourceRef}:{}),
        ...(confidence!==null?{confidence}:{}),
      }
    })

    const providerViews=(providersByNotice.get(noticeId)??[])
      .map((provider):SamProviderView=>({
        requirementId:string(provider.requirement_id),
        providerKey:string(provider.provider_key),
        providerName:string(provider.provider_name),
        ...(string(provider.country)?{country:string(provider.country)}:{}),
        ...(string(provider.uei)?{uei:string(provider.uei)}:{}),
        ...(string(provider.cage)?{cage:string(provider.cage)}:{}),
        score:numberOrNull(provider.score)??0,
        status:status(provider.status,['candidate','review_required','blocked'] as const,'review_required'),
        sourceTypes:strings(provider.sources),
      }))
      .filter(provider=>provider.providerKey&&provider.providerName)
      .sort((a,b)=>a.status.localeCompare(b.status)||b.score-a.score||a.providerName.localeCompare(b.providerName))

    const assignments=rows(pursuit?.assignments).map((assignment):SamTeamAssignmentView=>({
      providerKey:string(assignment.providerKey),
      providerName:string(assignment.providerName),
      requirementIds:strings(assignment.requirementIds),
      sourceTypes:strings(assignment.sourceTypes),
      score:numberOrNull(assignment.score)??0,
      reviewRequired:assignment.reviewRequired===true,
    })).filter(assignment=>assignment.providerKey&&assignment.providerName)

    const quoteTargets=rows(pursuit?.quote_targets).map((target):SamQuoteTargetView=>({
      providerKey:string(target.providerKey),
      providerName:string(target.providerName),
      requirementIds:strings(target.requirementIds),
      status:string(target.status)||'quote_required',
    })).filter(target=>target.providerKey&&target.providerName)

    const providerBench=rows(pursuit?.provider_bench).map((bench):SamProviderBenchView=>({
      requirementId:string(bench.requirementId),
      targetCandidateCount:numberOrNull(bench.targetCandidateCount)??0,
      candidateCount:numberOrNull(bench.candidateCount)??0,
      corroboratedCount:numberOrNull(bench.corroboratedCount)??0,
      qualifiedCount:numberOrNull(bench.qualifiedCount)??0,
      status:status(bench.status,['COVERAGE_HEALTHY','MARKET_CONSTRAINED','DISCOVERY_INCOMPLETE','unknown'] as const,'unknown'),
      blockers:strings(bench.blockers),
    })).filter(bench=>bench.requirementId)

    return {
      noticeId,
      ...(string(catalog.solicitation_number)?{solicitationNumber:string(catalog.solicitation_number)}:{}),
      title:string(catalog.title)||'Untitled SAM.gov opportunity',
      ...(string(catalog.agency)?{agency:string(catalog.agency)}:{}),
      ...(string(catalog.office)?{office:string(catalog.office)}:{}),
      ...(string(catalog.posted_date)?{postedDate:string(catalog.posted_date)}:{}),
      ...(string(catalog.response_deadline)?{responseDeadline:string(catalog.response_deadline)}:{}),
      naicsCodes:strings(catalog.naics_codes),
      classificationCodes:strings(catalog.classification_codes),
      ...(string(catalog.set_aside)?{setAside:string(catalog.set_aside)}:{}),
      sourceUrl:string(catalog.source_url),
      version:numberOrNull(catalog.version)??1,
      ...(string(catalog.last_seen_at)?{lastSeenAt:string(catalog.last_seen_at)}:{}),
      requirements,
      subcontractability:{
        status:status(subcontractability.status,['pass','conditional','review_required','blocked'] as const,'unknown'),
        hardBlockers:strings(subcontractability.hardBlockers),
        conditions:strings(subcontractability.conditions),
        detectedRules:strings(subcontractability.detectedRules),
      },
      capture:{
        stage:status(capture.stage,['discovery','sources_sought','presolicitation','solicitation','amendment','award','execution','closeout','unknown'] as const,'unknown'),
        captureValue:status(capture.captureValue,['low','medium','high','unknown'] as const,'unknown'),
        awardReadiness:status(capture.awardReadiness,['not_award_stage','developing','ready_for_pursuit','unknown'] as const,'unknown'),
        reasons:strings(capture.reasons),
      },
      providers:providerViews,
      pursuitStatus:status(pursuit?.status,['ready_for_quote','review_required','blocked','not_generated'] as const,'not_generated'),
      assignments,
      uncoveredRequirementIds:strings(pursuit?.uncovered_requirement_ids),
      quoteTargets,
      providerBench,
      commercial:{
        status:status(commercial.status,['quote_required','review_required','blocked','unknown'] as const,'unknown'),
        contractValue:numberOrNull(commercial.contractValue),
        providerCost:numberOrNull(commercial.providerCost),
        estimatedGrossProfit:numberOrNull(commercial.estimatedGrossProfit),
        estimatedMarginPercent:numberOrNull(commercial.estimatedMarginPercent),
        blockers:strings(commercial.blockers),
        assumptions:strings(commercial.assumptions),
      },
      blockers:strings(pursuit?.blockers),
      authority:{
        humanApprovalRequired:true,
        outreachAuthorized:false,
        bidSubmissionAuthorized:false,
        contractExecutionAuthorized:false,
        paymentAuthorized:false,
      },
    }
  })

  return {
    items,
    summary:{
      total:items.length,
      readyForQuote:items.filter(item=>item.pursuitStatus==='ready_for_quote').length,
      reviewRequired:items.filter(item=>item.pursuitStatus==='review_required'||item.pursuitStatus==='not_generated').length,
      blocked:items.filter(item=>item.pursuitStatus==='blocked').length,
      providers:items.reduce((sum,item)=>sum+item.providers.length,0),
    },
  }
}
