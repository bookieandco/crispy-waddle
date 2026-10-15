import 'server-only'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const BIZ_PURSE_REQUIRED_TABLES=Object.freeze([
 'jhadina_side_hustle_work_orders',
 'jhadina_side_hustle_commercial_receipts',
 'jhadina_side_hustle_commerce_records',
 'jhadina_side_hustle_commissioning_evidence',
 'jhadina_digital_product_studio_records',
] as const)

type TableState=Readonly<{name:string,status:'PRESENT'|'MISSING_OR_UNAVAILABLE'}>
export type BizPurseReadinessSnapshot=Readonly<{
 ownerUserId:string
 observedAt:string
 database:'SWLC'
 schemaStatus:'BLOCKED'|'REVIEW_READY'
 commercialTables:readonly TableState[]
 blockers:readonly string[]
 supabaseRepairIssue:'https://github.com/bookieandco/crispy-waddle/issues/1276'
 authority:'READINESS_ONLY'
 productionCertified:false
 canCollectCustomerPayments:false
 canMoveMoney:false
 canTrade:false
}>

/** Actual read-only runtime status. A HEAD count is a presence probe only:
 * no customer row data is returned to the caller.
 */
export async function readBizPurseReadiness():Promise<BizPurseReadinessSnapshot>{
 const userClient=await createClient()
 const identity=await userClient.auth.getClaims()
 const uid=identity.data?.claims?.sub
 if(identity.error||!uid)throw new Error('BIZ_PURSE_SESSION_REQUIRED')
 const service=createServiceRoleClient()
 if(!service)throw new Error('BIZ_PURSE_PRIVATE_DATABASE_NOT_CONFIGURED')
 const states=await Promise.all(BIZ_PURSE_REQUIRED_TABLES.map(async name=>{
  const response=await service.from(name).select('id',{head:true}).limit(1)
  const status:TableState['status']=response.error?'MISSING_OR_UNAVAILABLE':'PRESENT'
  return Object.freeze({name,status})
 }))
 const blockers=states.filter(x=>x.status!=='PRESENT').map(x=>'SUPABASE_AUDIT_REPAIR:'+x.name)
 return Object.freeze({
  ownerUserId:uid,
  observedAt:new Date().toISOString(),
  database:'SWLC' as const,
  schemaStatus:blockers.length?'BLOCKED' as const:'REVIEW_READY' as const,
  commercialTables:Object.freeze(states),
  blockers:Object.freeze(blockers),
  supabaseRepairIssue:'https://github.com/bookieandco/crispy-waddle/issues/1276' as const,
  authority:'READINESS_ONLY' as const,
  productionCertified:false as const,
  canCollectCustomerPayments:false as const,
  canMoveMoney:false as const,
  canTrade:false as const,
 })
}
