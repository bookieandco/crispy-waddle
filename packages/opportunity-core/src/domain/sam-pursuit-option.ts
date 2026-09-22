export type SamPursuitRequirement={
  id:string
  label:string
}

export type SamPursuitProviderCandidate={
  requirementId:string
  providerKey:string
  providerName:string
  status:'candidate'|'review_required'|'blocked'
  score:number
  sources:string[]
  evidenceRefs:string[]
}

export type SamPursuitAssignment={
  providerKey:string
  providerName:string
  requirementIds:string[]
  sourceTypes:string[]
  evidenceRefs:string[]
  score:number
  reviewRequired:boolean
}

export type SamQuoteTarget={
  providerKey:string
  providerName:string
  requirementIds:string[]
  status:'quote_required'
  outreachAuthorized:false
}

export type SamCommercialReadiness={
  status:'quote_required'|'review_required'|'blocked'
  contractValue:number|null
  providerCost:number|null
  estimatedGrossProfit:number|null
  estimatedMarginPercent:number|null
  blockers:string[]
  assumptions:string[]
}

export type SamPursuitOption={
  noticeId:string
  status:'ready_for_quote'|'review_required'|'blocked'
  assignments:SamPursuitAssignment[]
  coveredRequirementIds:string[]
  uncoveredRequirementIds:string[]
  quoteTargets:SamQuoteTarget[]
  commercial:SamCommercialReadiness
  blockers:string[]
  generatedAt:string
  humanApprovalRequired:true
  outreachAuthorized:false
  bidSubmissionAuthorized:false
  paymentAuthorized:false
}

const uniq=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))]
const finitePositive=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null

export function buildSamPursuitOption(input:{
  noticeId:string
  requirements:SamPursuitRequirement[]
  candidates:SamPursuitProviderCandidate[]
  subcontractabilityStatus:'pass'|'conditional'|'review_required'|'blocked'
  subcontractabilityBlockers?:string[]
  contractValue?:number|null
  generatedAt?:string
}):SamPursuitOption{
  const blockers=uniq(input.subcontractabilityBlockers??[])
  const requiredIds=uniq(input.requirements.map(requirement=>requirement.id))
  const assignmentsByProvider=new Map<string,SamPursuitAssignment>()
  const covered=new Set<string>()
  let assignedReviewRequired=false

  if(input.subcontractabilityStatus==='blocked'){
    blockers.push('Solicitation-specific subcontractability analysis blocks the proposed subcontracting structure.')
  }else{
    for(const requirementId of requiredIds){
      const choices=input.candidates
        .filter(candidate=>candidate.requirementId===requirementId&&candidate.status!=='blocked')
        .filter(candidate=>new Set(candidate.sources).size>=2)
        .sort((a,b)=>{
          const statusRank={candidate:0,review_required:1,blocked:2}
          return statusRank[a.status]-statusRank[b.status]||b.score-a.score||a.providerName.localeCompare(b.providerName)
        })
      const selected=choices[0]
      if(!selected)continue
      covered.add(requirementId)
      assignedReviewRequired ||= selected.status==='review_required'
      const existing=assignmentsByProvider.get(selected.providerKey)
      if(existing){
        existing.requirementIds=uniq([...existing.requirementIds,requirementId])
        existing.sourceTypes=uniq([...existing.sourceTypes,...selected.sources])
        existing.evidenceRefs=uniq([...existing.evidenceRefs,...selected.evidenceRefs])
        existing.score=Math.round((existing.score+selected.score)/2)
        existing.reviewRequired ||= selected.status==='review_required'
      }else{
        assignmentsByProvider.set(selected.providerKey,{
          providerKey:selected.providerKey,
          providerName:selected.providerName,
          requirementIds:[requirementId],
          sourceTypes:uniq(selected.sources),
          evidenceRefs:uniq(selected.evidenceRefs),
          score:selected.score,
          reviewRequired:selected.status==='review_required',
        })
      }
    }
  }

  const uncovered=requiredIds.filter(id=>!covered.has(id))
  if(uncovered.length)blockers.push(`No corroborated non-blocked provider candidate covers requirements: ${uncovered.join(', ')}`)
  const assignments=[...assignmentsByProvider.values()]
    .sort((a,b)=>b.requirementIds.length-a.requirementIds.length||b.score-a.score||a.providerName.localeCompare(b.providerName))
  const quoteTargets:SamQuoteTarget[]=assignments.map(assignment=>({
    providerKey:assignment.providerKey,
    providerName:assignment.providerName,
    requirementIds:[...assignment.requirementIds],
    status:'quote_required',
    outreachAuthorized:false,
  }))

  const contractValue=finitePositive(input.contractValue)
  const commercialBlockers:string[]=[]
  const assumptions:string[]=[]
  if(!contractValue){
    commercialBlockers.push('Reliable contract value is not available from current SAM evidence.')
  }
  if(assignments.length===0){
    commercialBlockers.push('No provider team is available for commercial evaluation.')
  }else{
    commercialBlockers.push('Evidence-backed provider quote costs have not been collected.')
  }
  assumptions.push('No provider cost, gross profit, or margin is inferred before an evidence-backed quote is recorded.')

  const hardBlocked=input.subcontractabilityStatus==='blocked'||uncovered.length>0||assignments.length===0
  const reviewRequired=!hardBlocked&&(input.subcontractabilityStatus!=='pass'||assignedReviewRequired)
  const status:SamPursuitOption['status']=hardBlocked?'blocked':reviewRequired?'review_required':'ready_for_quote'
  const commercialStatus:SamCommercialReadiness['status']=hardBlocked?'blocked':reviewRequired?'review_required':'quote_required'

  return {
    noticeId:input.noticeId,
    status,
    assignments,
    coveredRequirementIds:[...covered],
    uncoveredRequirementIds:uncovered,
    quoteTargets,
    commercial:{
      status:commercialStatus,
      contractValue,
      providerCost:null,
      estimatedGrossProfit:null,
      estimatedMarginPercent:null,
      blockers:uniq(commercialBlockers),
      assumptions:uniq(assumptions),
    },
    blockers:uniq(blockers),
    generatedAt:input.generatedAt??new Date().toISOString(),
    humanApprovalRequired:true,
    outreachAuthorized:false,
    bidSubmissionAuthorized:false,
    paymentAuthorized:false,
  }
}
