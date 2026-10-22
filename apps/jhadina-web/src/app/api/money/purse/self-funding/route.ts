import {NextResponse} from 'next/server'
import {readSessionMoneyWorkspace} from '@/lib/money/workspace-read-runtime'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {projectPurseSelfFundingStatus,PURSE_COMMERCIAL_TABLES,type CommercialSchemaCheck} from '@/lib/money/purse-self-funding-status'
export const dynamic='force-dynamic'
export const runtime='nodejs'

/** Owner-scoped GET only. No provider action, charge, schema mutation or financial certification. */
export async function GET(){
 try{
  const workspace=await readSessionMoneyWorkspace() // verifies user session first
  const db=createServiceRoleClient()
  const checks:CommercialSchemaCheck[]=await Promise.all(PURSE_COMMERCIAL_TABLES.map(async name=>{
   if(!db)return {name,state:'UNKNOWN' as const}
   try{
    const {error}=await db.from(name).select('id',{head:true,count:'exact'})
    return {name,state:error?'NOT_QUERYABLE' as const:'QUERYABLE_NOT_CERTIFIED' as const}
   }catch{return {name,state:'UNKNOWN' as const}}
  }))
  let admission:'UNCOMMISSIONED'|'UNKNOWN'|'REVIEW_REQUIRED'='UNKNOWN'
  if(db){
   try{
    const {data,error}=await db.from('money_funding_rail_admissions')
     .select('admission').order('updated_at',{ascending:false}).limit(1)
    if(!error&&data?.length)admission=data[0].admission==='UNCOMMISSIONED'?'UNCOMMISSIONED':'REVIEW_REQUIRED'
   }catch{admission='UNKNOWN'}
  }
  const snapshot=projectPurseSelfFundingStatus({
   observedAt:new Date().toISOString(),workspace, schemaChecks:checks,fundingRailAdmission:admission,
  })
  return NextResponse.json({ok:true,snapshot},{headers:{'cache-control':'private, no-store'}})
 }catch(e){
  const message=e instanceof Error?e.message:'Purse read unavailable'
  const unauth=/SESSION|AUTH|IDENTITY/i.test(message)
  return NextResponse.json({ok:false,error:unauth?'OWNER_SESSION_REQUIRED':'PURSE_STATUS_UNAVAILABLE'},
   {status:unauth?401:503,headers:{'cache-control':'private, no-store'}})
 }
}
