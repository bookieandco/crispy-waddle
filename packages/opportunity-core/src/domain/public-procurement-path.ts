export type PublicProcurementPath =
  | 'open_bid'
  | 'cooperative_contract'
  | 'job_order_contract'
  | 'master_agreement'
  | 'small_purchase'
  | 'emergency'
  | 'sole_source'
  | 'other'

export type PublicProcurementVehicleEvidence = {
  id:string
  path:PublicProcurementPath
  buyerEntityRef:string
  vehicleRef?:string
  authorityRef:string
  scopeMatch:boolean | 'unknown'
  buyerEligible:boolean | 'unknown'
  supplierStatus:'direct_awardee'|'authorized_dealer'|'subcontractor_to_awardee'|'not_on_vehicle'|'unknown'
  active:boolean | 'unknown'
  evidenceRefs:string[]
}

export type PublicProcurementPathAssessment = {
  path:PublicProcurementPath
  status:'ELIGIBLE'|'REVIEW_REQUIRED'|'INELIGIBLE'
  reasons:string[]
  blockers:string[]
  directAwardGuaranteed:false
  humanProcurementReviewRequired:true
}

export function assessPublicProcurementPath(vehicle:PublicProcurementVehicleEvidence):PublicProcurementPathAssessment{
  const reasons:string[]=[]
  const blockers:string[]=[]
  if(!vehicle.authorityRef.trim())blockers.push('No legal/procurement authority reference is attached to the path.')
  if(!vehicle.evidenceRefs.length)blockers.push('No evidence supports the procurement path.')
  if(vehicle.scopeMatch===false)blockers.push('Requirement is outside the evidenced vehicle scope.')
  if(vehicle.buyerEligible===false)blockers.push('Buyer is not evidenced as eligible to use the vehicle.')
  if(vehicle.active===false)blockers.push('Procurement vehicle is not active.')
  if(vehicle.supplierStatus==='not_on_vehicle'&&vehicle.path==='cooperative_contract')blockers.push('Our company is not directly on the cooperative vehicle; an authorized awardee/dealer/subcontract path is required.')
  if(vehicle.scopeMatch==='unknown')reasons.push('Vehicle scope match requires review.')
  if(vehicle.buyerEligible==='unknown')reasons.push('Buyer eligibility requires review.')
  if(vehicle.active==='unknown')reasons.push('Vehicle active status requires review.')
  if(vehicle.supplierStatus==='unknown')reasons.push('Supplier/dealer status on the vehicle is unresolved.')

  const hardIneligible=vehicle.scopeMatch===false||vehicle.buyerEligible===false||vehicle.active===false
  const status:PublicProcurementPathAssessment['status']=hardIneligible?'INELIGIBLE':blockers.length||reasons.length?'REVIEW_REQUIRED':'ELIGIBLE'
  return {path:vehicle.path,status,reasons,blockers,directAwardGuaranteed:false,humanProcurementReviewRequired:true}
}

export type SpecificationContribution = {
  id:string
  opportunityId:string
  kind:'condition_assessment'|'constructibility'|'lead_time'|'life_cycle_cost'|'interoperability'|'performance_requirement'|'brand_or_proprietary'
  statement:string
  evidenceRefs:string[]
  equivalentCompetitionPreserved:boolean | 'unknown'
  proprietaryJustificationRef?:string
}

export type SpecificationIntegrityAssessment = {
  contributionId:string
  status:'ALLOW_AS_TECHNICAL_INPUT'|'REVIEW_REQUIRED'|'BLOCK'
  reasons:string[]
  procurementInfluenceAuthorized:false
}

export function assessSpecificationIntegrity(contribution:SpecificationContribution):SpecificationIntegrityAssessment{
  const reasons:string[]=[]
  let status:SpecificationIntegrityAssessment['status']='ALLOW_AS_TECHNICAL_INPUT'
  if(!contribution.evidenceRefs.length){
    status='REVIEW_REQUIRED'
    reasons.push('Technical contribution lacks evidence.')
  }
  if(contribution.kind==='brand_or_proprietary'){
    if(!contribution.proprietaryJustificationRef){
      status='BLOCK'
      reasons.push('Proprietary/brand-specific steering is blocked without an independently documented procurement justification.')
    }else if(contribution.equivalentCompetitionPreserved===false){
      status='BLOCK'
      reasons.push('Contribution would eliminate equivalent competition.')
    }else{
      status='REVIEW_REQUIRED'
      reasons.push('Proprietary requirement has a justification reference but still requires buyer/procurement review.')
    }
  }
  if(contribution.equivalentCompetitionPreserved==='unknown'&&status!=='BLOCK'){
    status='REVIEW_REQUIRED'
    reasons.push('Effect on equivalent competition is unresolved.')
  }
  return {contributionId:contribution.id,status,reasons,procurementInfluenceAuthorized:false}
}

export type ProcurementPathEconomicObservation = {
  id:string
  opportunityId:string
  path:PublicProcurementPath
  competedBidderCount?:number
  estimatingCost:number
  acquisitionCost:number
  contractRevenue:number
  deliveryCost:number
  changeOrderCost:number
  recognizedGrossProfit:number
  evidenceRefs:string[]
}

export type ProcurementPathEconomicSummary = {
  path:PublicProcurementPath
  observations:number
  averageGrossMarginPercent:number
  averageEstimatingCost:number
  averageBidderCount?:number
  evidenceRefs:string[]
  intelligenceOnly:true
}

const round=(value:number)=>Math.round(value*100)/100

export function summarizeProcurementPathEconomics(path:PublicProcurementPath,observations:ProcurementPathEconomicObservation[]):ProcurementPathEconomicSummary{
  const rows=observations.filter(row=>row.path===path&&row.evidenceRefs.length>0&&row.contractRevenue>0)
  const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0
  const bidders=rows.flatMap(row=>row.competedBidderCount===undefined?[]:[row.competedBidderCount])
  const margins=rows.map(row=>row.recognizedGrossProfit/row.contractRevenue*100)
  return {
    path,
    observations:rows.length,
    averageGrossMarginPercent:round(average(margins)),
    averageEstimatingCost:round(average(rows.map(row=>Math.max(0,row.estimatingCost)))),
    averageBidderCount:bidders.length?round(average(bidders)):undefined,
    evidenceRefs:[...new Set(rows.flatMap(row=>row.evidenceRefs))],
    intelligenceOnly:true,
  }
}
