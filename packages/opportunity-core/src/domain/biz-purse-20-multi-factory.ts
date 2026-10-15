import {assessMultiBusinessIsolation,type BusinessUnitScope} from './biz-purse-portfolio-host.js'
import type {BusinessDirectorReview} from './biz-purse-19-business-director.js'
export type BusinessFactoryUnit=BusinessUnitScope&Readonly<{
 family:'CLIENT_CAPTURE_STUDIO'|'DIGITAL_PRODUCT_STUDIO';
 workflow:BusinessDirectorReview;
}>
export function assessTwoBusinessFactory(input:Readonly<{ownerUserId:string;units:readonly BusinessFactoryUnit[];
 totalBudgetCapMinor:bigint;stopRequested:boolean}>){
 const reasons:string[]=[]
 if(input.units.length!==2)reasons.push('EXACTLY_TWO_PILOT_BUSINESSES_REQUIRED')
 const families=new Set(input.units.map(x=>x.family))
 if(!families.has('CLIENT_CAPTURE_STUDIO')||!families.has('DIGITAL_PRODUCT_STUDIO'))
  reasons.push('TWO_DISTINCT_BUSINESS_FAMILIES_REQUIRED')
 const isolation=assessMultiBusinessIsolation({ownerUserId:input.ownerUserId,units:input.units,
  aggregateBudgetCapMinor:input.totalBudgetCapMinor})
 reasons.push(...isolation.reasons)
 if(input.stopRequested)reasons.push('OWNER_STOP_ACTIVE')
 for(const unit of input.units){
  if(unit.workflow.ownerUserId!==input.ownerUserId||unit.workflow.businessId!==unit.businessId)
   reasons.push('DIRECTOR_SCOPE_CROSSOVER')
  if(unit.workflow.status!=='INTERNAL_REHEARSAL_COMPLETE')
   reasons.push('BUSINESS_REHEARSAL_INCOMPLETE')
  if(unit.workflow.canMoveMoney!==false||unit.workflow.canFulfill!==false)
   reasons.push('DIRECTOR_UNSAFE_AUTHORITY')
 }
 return Object.freeze({
  status:reasons.length?'BLOCKED' as const:'TWO_REHEARSALS_REVIEW_READY' as const,
  reasons:Object.freeze([...new Set(reasons)]),
  businesses:Object.freeze(input.units.map(x=>Object.freeze({id:x.businessId,family:x.family,accountId:x.accountId,
   budgetMinor:x.operatingBudgetMinor,rehearsal:x.workflow.status}))),
  ownerUserId:input.ownerUserId,authority:'TWO_BUSINESS_REHEARSAL_ONLY' as const,
  canPublish:false as const,canCharge:false as const,canTransfer:false as const,canRunLiveBusinesses:false as const
 })
}
