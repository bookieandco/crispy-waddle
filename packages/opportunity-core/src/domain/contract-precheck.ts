export type PaymentDependencyControl = 'controlled' | 'partial' | 'external' | 'unknown'

export type ContractPaymentCondition = {
  id: string
  label: string
  amountAffected?: number
  control: PaymentDependencyControl
  sourceRef: string
  requiredDocumentRefs: string[]
  satisfied: boolean | 'unknown'
}

export type RetainageTerm = {
  percentage: number
  appliesTo: 'progress_payments' | 'final_payment' | 'all_payments' | 'other'
  releaseWithinDays?: number
  releaseConditions: ContractPaymentCondition[]
  reductionMilestones: string[]
  bondEffect?: string
  sourceRef: string
}

export type RetainageAssessment = {
  percentage: number
  cashReleaseControlScore: number
  externallyDependentAmount: number
  unresolvedConditionIds: string[]
  missingDocumentRefs: string[]
  status: 'CLEAR' | 'REVIEW_REQUIRED' | 'HIGH_UPSTREAM_DEPENDENCY'
  reasons: string[]
  legalConclusionMade: false
}

const clamp100=(value:number)=>Math.max(0,Math.min(100,Math.round(value)))
const nonnegative=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:0
const uniq=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))]

export function assessRetainage(term:RetainageTerm,retainedAmount=0):RetainageAssessment{
  if(!Number.isFinite(term.percentage)||term.percentage<0||term.percentage>100)throw new Error('Retainage percentage must be between 0 and 100.')
  const weights:Record<PaymentDependencyControl,number>={controlled:1,partial:0.5,external:0,unknown:0.25}
  const conditions=term.releaseConditions
  const controlScore=conditions.length
    ? clamp100(conditions.reduce((sum,condition)=>sum+weights[condition.control],0)/conditions.length*100)
    : 100
  const external=conditions.filter(condition=>condition.control==='external'||condition.control==='unknown')
  const externallyDependentAmount=external.length
    ? Math.max(nonnegative(retainedAmount),external.reduce((sum,condition)=>sum+nonnegative(condition.amountAffected),0))
    : 0
  const unresolvedConditionIds=conditions.filter(condition=>condition.satisfied!=="unknown"?!condition.satisfied:true).map(condition=>condition.id)
  const missingDocumentRefs=uniq(conditions.filter(condition=>condition.satisfied!=="unknown"&&!condition.satisfied).flatMap(condition=>condition.requiredDocumentRefs))
  const reasons:string[]=[]
  if(external.length)reasons.push('Release depends on one or more upstream/external events outside direct control.')
  if(unresolvedConditionIds.length)reasons.push('One or more retainage release conditions remain unresolved.')
  if(term.releaseWithinDays===undefined)reasons.push('Retainage release timing is not explicit in the modeled clause.')
  const status:RetainageAssessment['status']=external.length?'HIGH_UPSTREAM_DEPENDENCY':reasons.length?'REVIEW_REQUIRED':'CLEAR'
  return {percentage:term.percentage,cashReleaseControlScore:controlScore,externallyDependentAmount,unresolvedConditionIds,missingDocumentRefs,status,reasons,legalConclusionMade:false}
}

export type TerminationTrigger =
  | 'government_flowdown_only'
  | 'prime_discretionary'
  | 'either_government_or_prime'
  | 'other'
  | 'unknown'

export type TerminationRecoveryCategory =
  | 'performed_work'
  | 'accepted_work'
  | 'materials'
  | 'noncancelable_commitments'
  | 'demobilization'
  | 'settlement_expense'
  | 'profit_on_performed_work'
  | 'profit_on_unperformed_work'
  | 'unabsorbed_overhead'
  | 'consequential_damages'
  | 'other'

export type TerminationConvenienceTerm = {
  trigger: TerminationTrigger
  payable: TerminationRecoveryCategory[]
  excluded: TerminationRecoveryCategory[]
  settlementDeadlineDays?: number
  upstreamRecoveryCap: boolean | 'unknown'
  requiredRecordRefs: string[]
  sourceRef: string
}

export type TerminationExposureAssessment = {
  triggerRisk: 'LOWER' | 'ELEVATED' | 'UNKNOWN'
  recoveryBreadthScore: number
  upstreamDependency: 'NONE_EVIDENCED' | 'PRESENT' | 'UNKNOWN'
  deadlineRisk: 'NORMAL' | 'SHORT' | 'UNKNOWN'
  missingRecoveryCategories: TerminationRecoveryCategory[]
  reasons: string[]
  status: 'CLEAR' | 'REVIEW_REQUIRED' | 'HIGH_EXPOSURE'
  legalConclusionMade: false
}

export function assessTerminationConvenience(term:TerminationConvenienceTerm):TerminationExposureAssessment{
  const standardReviewCategories:TerminationRecoveryCategory[]=['performed_work','materials','noncancelable_commitments','demobilization','settlement_expense','profit_on_performed_work']
  const payable=new Set(term.payable)
  const excluded=new Set(term.excluded)
  const covered=standardReviewCategories.filter(category=>payable.has(category)&&!excluded.has(category))
  const recoveryBreadthScore=clamp100(covered.length/standardReviewCategories.length*100)
  const missingRecoveryCategories=standardReviewCategories.filter(category=>!payable.has(category)||excluded.has(category))
  const triggerRisk:TerminationExposureAssessment['triggerRisk']=term.trigger==='government_flowdown_only'?'LOWER':term.trigger==='prime_discretionary'||term.trigger==='either_government_or_prime'?'ELEVATED':'UNKNOWN'
  const upstreamDependency:TerminationExposureAssessment['upstreamDependency']=term.upstreamRecoveryCap===true?'PRESENT':term.upstreamRecoveryCap===false?'NONE_EVIDENCED':'UNKNOWN'
  const deadlineRisk:TerminationExposureAssessment['deadlineRisk']=term.settlementDeadlineDays===undefined?'UNKNOWN':term.settlementDeadlineDays<60?'SHORT':'NORMAL'
  const reasons:string[]=[]
  if(triggerRisk==='ELEVATED')reasons.push('Prime may terminate independently of an upstream government termination.')
  if(upstreamDependency==='PRESENT')reasons.push('Recovery is modeled as tied or capped to an upstream recovery process.')
  if(upstreamDependency==='UNKNOWN')reasons.push('Upstream recovery cap is unresolved.')
  if(deadlineRisk==='SHORT')reasons.push('Settlement proposal deadline is shorter than 60 days and requires termination-ready accounting.')
  if(deadlineRisk==='UNKNOWN')reasons.push('Settlement proposal deadline is unresolved.')
  if(missingRecoveryCategories.length)reasons.push('Modeled recovery does not expressly include all standard review categories.')
  const high=triggerRisk==='ELEVATED'&&(upstreamDependency==='PRESENT'||recoveryBreadthScore<50)
  const status:TerminationExposureAssessment['status']=high?'HIGH_EXPOSURE':reasons.length?'REVIEW_REQUIRED':'CLEAR'
  return {triggerRisk,recoveryBreadthScore,upstreamDependency,deadlineRisk,missingRecoveryCategories,reasons,status,legalConclusionMade:false}
}

export type ContractPrecheckPacket = {
  opportunityId: string
  retainage?: RetainageTerm
  retainedAmount?: number
  terminationForConvenience?: TerminationConvenienceTerm
  referencedDocumentRefs: string[]
  suppliedDocumentRefs: string[]
  sourceRefs: string[]
}

export type ContractPrecheckAssessment = {
  opportunityId: string
  retainage?: RetainageAssessment
  termination?: TerminationExposureAssessment
  missingReferencedDocumentRefs: string[]
  counselReviewRequired: boolean
  blockers: string[]
  status: 'CLEAR' | 'REVIEW_REQUIRED' | 'HIGH_RISK'
  contractExecutionAuthorized: false
  paymentAuthorized: false
}

export function assessContractPrecheck(packet:ContractPrecheckPacket):ContractPrecheckAssessment{
  const retainage=packet.retainage?assessRetainage(packet.retainage,packet.retainedAmount):undefined
  const termination=packet.terminationForConvenience?assessTerminationConvenience(packet.terminationForConvenience):undefined
  const supplied=new Set(packet.suppliedDocumentRefs)
  const missingReferencedDocumentRefs=uniq(packet.referencedDocumentRefs.filter(ref=>!supplied.has(ref)))
  const blockers:string[]=[]
  if(missingReferencedDocumentRefs.length)blockers.push('Referenced contract documents are missing from the review package.')
  if(retainage?.status==='HIGH_UPSTREAM_DEPENDENCY')blockers.push('Retainage release has material upstream/external dependencies.')
  if(termination?.status==='HIGH_EXPOSURE')blockers.push('Termination-for-convenience clause has elevated modeled exposure.')
  const counselReviewRequired=Boolean(
    missingReferencedDocumentRefs.length||
    retainage?.status!=='CLEAR'||
    termination?.status!=='CLEAR'
  )
  const status:ContractPrecheckAssessment['status']=blockers.length?'HIGH_RISK':counselReviewRequired?'REVIEW_REQUIRED':'CLEAR'
  return {opportunityId:packet.opportunityId,retainage,termination,missingReferencedDocumentRefs,counselReviewRequired,blockers,status,contractExecutionAuthorized:false,paymentAuthorized:false}
}
