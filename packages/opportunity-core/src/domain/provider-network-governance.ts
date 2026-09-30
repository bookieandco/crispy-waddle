export type ProviderGrade = 'PROBATIONARY' | 'A' | 'B' | 'SUSPENDED'
export type ProviderAuthorityLevel = 0 | 1 | 2 | 3 | 4

export type ProviderPerformanceObservation = {
  id: string
  providerId: string
  opportunityId: string
  completedAt: string
  technicalQuality: number
  onTime: boolean
  communicationScore: number
  closeoutScore: number
  reworkCost: number
  contractValue: number
  customerComplaint: boolean
  evidenceRefs: string[]
}

export type ProviderAuthorityAssessment = {
  providerId: string
  completedJobs: number
  weightedScore: number
  reworkRatePercent: number
  complaintRatePercent: number
  grade: ProviderGrade
  authorityLevel: ProviderAuthorityLevel
  permittedResponsibilities: string[]
  reasons: string[]
  humanApprovalRequired: true
  automaticCustomerCommunicationAuthorized: false
  automaticContractAuthority: false
}

const clamp=(value:number)=>Math.max(0,Math.min(100,value))
const round=(value:number)=>Math.round(value*100)/100
const uniq=(values:string[])=>[...new Set(values.filter(Boolean))]

export function assessProviderAuthority(providerId:string,observations:ProviderPerformanceObservation[]):ProviderAuthorityAssessment{
  const rows=observations.filter(row=>row.providerId===providerId&&row.evidenceRefs.length>0)
  const completedJobs=rows.length
  const quality=completedJobs?rows.reduce((sum,row)=>sum+clamp(row.technicalQuality),0)/completedJobs:0
  const communication=completedJobs?rows.reduce((sum,row)=>sum+clamp(row.communicationScore),0)/completedJobs:0
  const closeout=completedJobs?rows.reduce((sum,row)=>sum+clamp(row.closeoutScore),0)/completedJobs:0
  const onTime=completedJobs?rows.filter(row=>row.onTime).length/completedJobs*100:0
  const weightedScore=round(quality*0.4+onTime*0.25+communication*0.2+closeout*0.15)
  const totalValue=rows.reduce((sum,row)=>sum+Math.max(0,row.contractValue),0)
  const totalRework=rows.reduce((sum,row)=>sum+Math.max(0,row.reworkCost),0)
  const reworkRatePercent=round(totalValue>0?totalRework/totalValue*100:0)
  const complaintRatePercent=round(completedJobs?rows.filter(row=>row.customerComplaint).length/completedJobs*100:0)
  const reasons:string[]=[]

  let authorityLevel:ProviderAuthorityLevel=0
  if(completedJobs>=8&&weightedScore>=88&&reworkRatePercent<=2&&complaintRatePercent<=5)authorityLevel=4
  else if(completedJobs>=5&&weightedScore>=84&&reworkRatePercent<=4)authorityLevel=3
  else if(completedJobs>=3&&weightedScore>=78)authorityLevel=2
  else if(completedJobs>=1&&weightedScore>=70)authorityLevel=1

  let grade:ProviderGrade='PROBATIONARY'
  if(completedJobs>=2&&(weightedScore<60||complaintRatePercent>=30||reworkRatePercent>=15))grade='SUSPENDED'
  else if(authorityLevel>=3)grade='A'
  else if(authorityLevel>=1)grade='B'

  if(completedJobs===0)reasons.push('No evidence-backed completed jobs exist; provider remains probationary.')
  if(reworkRatePercent>4)reasons.push('Rework rate limits higher autonomy.')
  if(complaintRatePercent>10)reasons.push('Customer complaint rate limits higher autonomy.')
  if(grade==='SUSPENDED')reasons.push('Observed performance requires suspension from new autonomous routing pending human review.')

  const permittedByLevel:Record<ProviderAuthorityLevel,string[]>={
    0:['trial_execution_under_direct_supervision'],
    1:['supervised_execution','routine_progress_reporting_to_prime'],
    2:['independent_execution','routine_daily_progress_updates_within_approved_script'],
    3:['project_coordination_within_approved_scope','routine_customer_progress_updates','kickoff_participation'],
    4:['tier_one_job_ownership_with_monitoring','kickoff_coordination','routine_customer_progress_updates','closeout_coordination'],
  }

  return {
    providerId,
    completedJobs,
    weightedScore,
    reworkRatePercent,
    complaintRatePercent,
    grade,
    authorityLevel,
    permittedResponsibilities:grade==='SUSPENDED'?[]:permittedByLevel[authorityLevel],
    reasons:uniq(reasons),
    humanApprovalRequired:true,
    automaticCustomerCommunicationAuthorized:false,
    automaticContractAuthority:false,
  }
}

export type ProviderCapacitySlot = {
  providerId: string
  trade: string
  state: string
  county?: string
  availableFrom: string
  availableThrough?: string
  capacityStatus: 'available' | 'limited' | 'unavailable' | 'unknown'
  evidenceRefs: string[]
}

export type ProviderRedundancyAssessment = {
  trade: string
  state: string
  county?: string
  availableProviderIds: string[]
  redundancyCount: number
  status: 'RESILIENT' | 'THIN' | 'SINGLE_PROVIDER_RISK' | 'NO_CAPACITY'
  blockers: string[]
  salesExpansionSafe: boolean
}

export function assessProviderRedundancy(input:{
  trade:string
  state:string
  county?:string
  slots:ProviderCapacitySlot[]
  minimumProviders?:number
  asOf?:string
}):ProviderRedundancyAssessment{
  const minimum=Math.max(2,Math.floor(input.minimumProviders??3))
  const asOf=input.asOf??new Date().toISOString()
  const matching=input.slots.filter(slot=>
    slot.trade.toLowerCase()===input.trade.toLowerCase()&&
    slot.state.toUpperCase()===input.state.toUpperCase()&&
    (!input.county||slot.county===input.county)&&
    slot.evidenceRefs.length>0&&
    slot.capacityStatus==='available'&&
    slot.availableFrom<=asOf&&
    (!slot.availableThrough||slot.availableThrough>=asOf)
  )
  const availableProviderIds=uniq(matching.map(slot=>slot.providerId))
  const redundancyCount=availableProviderIds.length
  let status:ProviderRedundancyAssessment['status']='NO_CAPACITY'
  if(redundancyCount>=minimum)status='RESILIENT'
  else if(redundancyCount===2)status='THIN'
  else if(redundancyCount===1)status='SINGLE_PROVIDER_RISK'
  const blockers:string[]=[]
  if(status==='NO_CAPACITY')blockers.push('No evidence-backed available provider capacity exists for the trade/geography.')
  if(status==='SINGLE_PROVIDER_RISK')blockers.push('Fulfillment depends on a single available provider.')
  if(status==='THIN')blockers.push(`Provider redundancy is below target ${redundancyCount}/${minimum}.`)
  return {trade:input.trade,state:input.state,county:input.county,availableProviderIds,redundancyCount,status,blockers,salesExpansionSafe:status==='RESILIENT'}
}

export type ProviderFailureCause = 'provider_error'|'scope_ambiguity'|'sales_promise'|'customer_change'|'material_issue'|'routing_error'|'unknown'

export type FulfillmentIncident = {
  id:string
  providerId?:string
  opportunityId:string
  cause:ProviderFailureCause
  customerStabilized:boolean
  repairCost:number
  responsibility:'prime'|'provider'|'shared'|'customer'|'unresolved'
  evidenceRefs:string[]
  regressionRuleCreated:boolean
}

export type FulfillmentIncidentAssessment = {
  incidentId:string
  closeoutStatus:'READY_TO_CLOSE'|'OPEN'
  commercialResponsibilityResolved:boolean
  learningCaptured:boolean
  blockers:string[]
  paymentAuthority:false
}

export function assessFulfillmentIncident(incident:FulfillmentIncident):FulfillmentIncidentAssessment{
  const blockers:string[]=[]
  if(!incident.customerStabilized)blockers.push('Customer impact has not been stabilized.')
  if(incident.responsibility==='unresolved')blockers.push('Commercial responsibility for the incident is unresolved.')
  if(!incident.evidenceRefs.length)blockers.push('Incident lacks evidence.')
  if(!incident.regressionRuleCreated)blockers.push('Failure has not yet produced an SOP/checklist/regression rule.')
  return {
    incidentId:incident.id,
    closeoutStatus:blockers.length?'OPEN':'READY_TO_CLOSE',
    commercialResponsibilityResolved:incident.responsibility!=='unresolved',
    learningCaptured:incident.regressionRuleCreated,
    blockers,
    paymentAuthority:false,
  }
}
