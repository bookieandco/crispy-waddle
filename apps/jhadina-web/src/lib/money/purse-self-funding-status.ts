import type {MoneyWorkspaceSnapshot} from './workspace-read-runtime'

export const PURSE_COMMERCIAL_TABLES=Object.freeze([
 'jhadina_side_hustle_work_orders',
 'jhadina_side_hustle_commercial_receipts',
 'jhadina_side_hustle_commerce_records',
 'jhadina_side_hustle_commissioning_evidence',
 'jhadina_digital_product_studio_records',
] as const)
export type CommercialSchemaCheck=Readonly<{
 name:typeof PURSE_COMMERCIAL_TABLES[number]
 state:'QUERYABLE_NOT_CERTIFIED'|'NOT_QUERYABLE'|'UNKNOWN'
}>
export type PurseSelfFundingSnapshot=Readonly<{
 observedAt:string
 status:'NOT_COMMISSIONED'
 cofferRegistered:boolean
 cofferCurrency:string|null
 cofferState:string|null
 protectedFloors:Readonly<{hardStopMinor:string;survivalMinor:string;defensiveMinor:string}>|null
 ownerPayoutDestinationConfigured:boolean
 ownerSweepPolicyConfigured:boolean
 fundingRailAdmission:'UNCOMMISSIONED'|'UNKNOWN'|'REVIEW_REQUIRED'
 schemaChecks:readonly CommercialSchemaCheck[]
 verifiedSettledRevenueMinor:null
 verifiedDirectCostsMinor:null
 verifiedProviderFeesMinor:null
 verifiedTaxReserveMinor:null
 verifiedDistributableProfitMinor:null
 verifiedOwnerPaydayMinor:null
 operatingRunwayDays:null
 firstBusinessCycle:'NO_INDEPENDENTLY_VERIFIED_CYCLE'
 blockers:readonly string[]
 authority:'READ_ONLY_OWNER_FINANCIAL_STATUS'
 canMoveMoney:false
 canExecute:false
}>
export function projectPurseSelfFundingStatus(input:Readonly<{
 observedAt:string
 workspace:Pick<MoneyWorkspaceSnapshot,'coffer'|'sweepPolicy'>
 schemaChecks:readonly CommercialSchemaCheck[]
 fundingRailAdmission:'UNCOMMISSIONED'|'UNKNOWN'|'REVIEW_REQUIRED'
}>):PurseSelfFundingSnapshot{
 if(!input||Number.isNaN(Date.parse(input.observedAt))||
   !input.workspace||!Array.isArray(input.schemaChecks)||input.schemaChecks.length!==PURSE_COMMERCIAL_TABLES.length)
  throw Error('PURSE_STATUS_INPUT_INVALID')
 const seen=new Set<string>()
 for(const s of input.schemaChecks){
  if(!s||!PURSE_COMMERCIAL_TABLES.includes(s.name)||seen.has(s.name)||
    !['QUERYABLE_NOT_CERTIFIED','NOT_QUERYABLE','UNKNOWN'].includes(s.state))
    throw Error('PURSE_STATUS_SCHEMA_UNTRUSTED')
  seen.add(s.name)
 }
 const c=input.workspace.coffer
 const blockers:string[]=[]
 if(!c)blockers.push('OWNER_COFFER_NOT_REGISTERED')
 if(!input.workspace.sweepPolicy)blockers.push('PROFIT_SWEEP_POLICY_MISSING')
 else if(!input.workspace.sweepPolicy.verifiedOwnerDestinationId)blockers.push('OWNER_PAYOUT_DESTINATION_NOT_VERIFIED')
 if(input.schemaChecks.some(s=>s.state!=='QUERYABLE_NOT_CERTIFIED'))blockers.push('COMMERCIAL_SCHEMA_UNAVAILABLE_OR_UNVERIFIED')
 // Table read permission alone never establishes applied migration integrity or RLS.
 blockers.push('COMMERCIAL_SCHEMA_RLS_AND_RESTORE_NOT_CERTIFIED')
 if(input.fundingRailAdmission!=='REVIEW_REQUIRED')blockers.push('FUNDING_RAIL_UNCOMMISSIONED_OR_UNKNOWN')
 blockers.push('NO_INDEPENDENT_CUSTODY_AND_SETTLED_REVENUE_EVIDENCE')
 return Object.freeze({
  observedAt:input.observedAt,status:'NOT_COMMISSIONED' as const,
  cofferRegistered:Boolean(c),cofferCurrency:c?.currency??null,cofferState:c?.state??null,
  protectedFloors:c?Object.freeze({hardStopMinor:c.hardStopFloorMinor,
   survivalMinor:c.survivalFloorMinor,defensiveMinor:c.defensiveFloorMinor}):null,
  ownerPayoutDestinationConfigured:Boolean(input.workspace.sweepPolicy?.verifiedOwnerDestinationId),
  ownerSweepPolicyConfigured:Boolean(input.workspace.sweepPolicy),
  fundingRailAdmission:input.fundingRailAdmission,
  schemaChecks:Object.freeze(input.schemaChecks.map(x=>Object.freeze({...x}))),
  verifiedSettledRevenueMinor:null,verifiedDirectCostsMinor:null,verifiedProviderFeesMinor:null,
  verifiedTaxReserveMinor:null,verifiedDistributableProfitMinor:null,verifiedOwnerPaydayMinor:null,
  operatingRunwayDays:null,firstBusinessCycle:'NO_INDEPENDENTLY_VERIFIED_CYCLE' as const,
  blockers:Object.freeze(blockers),authority:'READ_ONLY_OWNER_FINANCIAL_STATUS' as const,
  canMoveMoney:false as const,canExecute:false as const,
 })
}
