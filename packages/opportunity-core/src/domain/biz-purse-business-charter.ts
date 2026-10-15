import {createHash} from 'node:crypto'
export type BusinessActionKind='DISCOVER'|'RESEARCH'|'PREPARE_OFFER'|'CONTACT'|'PUBLISH'|'SPEND'|'FULFILL'|'TRADE'|'WITHDRAW'|'SIGN_CONTRACT'
export type BusinessAutonomyCharter=Readonly<{
  charterId:string
  version:string
  ownerUserId:string
  allowedFamilies:readonly string[]
  maxConcurrentVentures:number
  maxSingleSpendMinor:bigint
  maxMonthlySpendMinor:bigint
  currency:string
  expiresAt:string
  authority:'OWNER_APPROVED_POLICY'
}>
export type BusinessActionCandidate=Readonly<{
  opportunityId:string
  family:string
  kind:BusinessActionKind
  amountMinor:bigint
  currency:string
  observedMonthlySpendMinor:bigint
  activeVentureCount:number
  requestedAt:string
  evidenceIds:readonly string[]
}>
export type BusinessActionAssessment=Readonly<{
  assessmentId:string
  actionKind:BusinessActionKind
  status:'INTERNAL_RESEARCH_ALLOWED'|'GOVERNED_EXECUTION_REQUIRED'|'DENIED'
  reasonCodes:readonly string[]
  canPerformInternalResearch:boolean
  canExecuteExternalAction:false
  canMoveMoney:false
  canPlaceTrade:false
  authority:'ASSESSMENT_ONLY'
}>
const INTERNAL=new Set<BusinessActionKind>(['DISCOVER','RESEARCH','PREPARE_OFFER'])
export function assessBusinessAction(charter:BusinessAutonomyCharter,candidate:BusinessActionCandidate):BusinessActionAssessment {
  const reasons:string[]=[]
  if(charter.authority!=='OWNER_APPROVED_POLICY'||!charter.charterId||!charter.version||!charter.ownerUserId||!charter.currency||!Number.isFinite(Date.parse(charter.expiresAt))) throw new Error('BIZ_PURSE_CHARTER_INVALID')
  if(!Number.isInteger(charter.maxConcurrentVentures)||charter.maxConcurrentVentures<0||charter.maxSingleSpendMinor<0n||charter.maxMonthlySpendMinor<0n) throw new Error('BIZ_PURSE_CHARTER_LIMIT_INVALID')
  if(!candidate.opportunityId||!candidate.family||!Number.isFinite(Date.parse(candidate.requestedAt))||!candidate.evidenceIds.length||new Set(candidate.evidenceIds).size!==candidate.evidenceIds.length) throw new Error('BIZ_PURSE_CANDIDATE_INVALID')
  if(candidate.amountMinor<0n||candidate.observedMonthlySpendMinor<0n||!Number.isInteger(candidate.activeVentureCount)||candidate.activeVentureCount<0)throw new Error('BIZ_PURSE_CANDIDATE_LIMIT_INVALID')
  if(!charter.allowedFamilies.includes(candidate.family))reasons.push('FAMILY_NOT_AUTHORIZED')
  if(candidate.currency!==charter.currency)reasons.push('CURRENCY_MISMATCH')
  if(Date.parse(candidate.requestedAt)>=Date.parse(charter.expiresAt))reasons.push('CHARTER_EXPIRED')
  if(candidate.activeVentureCount>charter.maxConcurrentVentures)reasons.push('CONCURRENT_VENTURE_LIMIT')
  if(candidate.amountMinor>charter.maxSingleSpendMinor)reasons.push('SINGLE_SPEND_LIMIT')
  if(candidate.observedMonthlySpendMinor+candidate.amountMinor>charter.maxMonthlySpendMinor)reasons.push('MONTHLY_SPEND_LIMIT')
  if(INTERNAL.has(candidate.kind)&&candidate.amountMinor!==0n)reasons.push('INTERNAL_RESEARCH_REQUIRES_ZERO_COST')
  if(!INTERNAL.has(candidate.kind))reasons.push('ACTION_CORE_PROVIDER_PERMIT_REQUIRED')
  const status:BusinessActionAssessment['status']=reasons.some(code=>code!=='ACTION_CORE_PROVIDER_PERMIT_REQUIRED')?'DENIED':INTERNAL.has(candidate.kind)?'INTERNAL_RESEARCH_ALLOWED':'GOVERNED_EXECUTION_REQUIRED'
  const identity=JSON.stringify({charter:charter.charterId,version:charter.version,opportunity:candidate.opportunityId,kind:candidate.kind,family:candidate.family,amount:candidate.amountMinor.toString(),evidence:[...candidate.evidenceIds].sort()})
  return Object.freeze({assessmentId:'business-action:'+createHash('sha256').update(identity).digest('hex'),actionKind:candidate.kind,status,reasonCodes:Object.freeze(reasons),canPerformInternalResearch:status==='INTERNAL_RESEARCH_ALLOWED',canExecuteExternalAction:false as const,canMoveMoney:false as const,canPlaceTrade:false as const,authority:'ASSESSMENT_ONLY' as const})
}
