import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const revalidate=0
/** Read-only, owner-filtered runtime observation. Never self-certifies finance or historic recovery. */
export async function GET(){
 try{
  const session=await createClient()
  const {data,error}=await session.auth.getClaims()
  const userId=data?.claims?.sub
  if(error||!userId)return NextResponse.json({success:false,error:'PURSE_SESSION_REQUIRED'},{status:401})
  const db=createServiceRoleClient()
  if(!db)return NextResponse.json({success:false,error:'PURSE_DATABASE_NOT_CONFIGURED'},{status:503})
  const charters=await db.from('money_purse_charters').select('charter_id,autonomy_mode,effective_at')
   .eq('user_id',userId).order('effective_at',{ascending:false}).limit(1)
  if(charters.error)return NextResponse.json({success:false,error:'PURSE_CHARACTERS_OR_STORAGE_UNAVAILABLE'},{status:503})
  const charter=charters.data?.[0]
  if(!charter)return NextResponse.json({success:true,data:{charter:null,lastPaperCycle:null,storage:'NO_OWNER_CHARTER',
   worker:'NOT_CERTIFIED',originalLedger:'NOT_RECOVERED',driveRestore:'NOT_VERIFIED',bankTransfers:'NOT_COMMISSIONED',
   cryptoTransfers:'NOT_COMMISSIONED',paperOperation:'NOT_CERTIFIED',canExecute:false}},{headers:{'Cache-Control':'no-store'}})
  const cycles=await db.from('money_purse_paper_cycles').select('cycle_id,recorded_at,information_cutoff,can_execute')
   .eq('user_id',userId).eq('charter_id',charter.charter_id).order('recorded_at',{ascending:false}).limit(1)
  if(cycles.error)return NextResponse.json({success:false,error:'PURSE_PAPER_TABLE_NOT_COMMISSIONED'},{status:503})
  const row=cycles.data?.[0]
  if(row?.can_execute!==undefined&&row.can_execute!==false)throw new Error('PURSE_PAPER_ROW_AUTHORITY_INVALID')
  return NextResponse.json({success:true,data:{
   charter:{mode:charter.autonomy_mode,effectiveAt:charter.effective_at},
   lastPaperCycle:row?{cycleId:row.cycle_id,recordedAt:row.recorded_at,informationCutoff:row.information_cutoff}:null,
   storage:'QUERY_READ_ONLY',worker:'NOT_CERTIFIED',originalLedger:'NOT_RECOVERED',driveRestore:'NOT_VERIFIED',
   bankTransfers:'NOT_COMMISSIONED',cryptoTransfers:'NOT_COMMISSIONED',paperOperation:'NOT_CERTIFIED',canExecute:false,
  }},{headers:{'Cache-Control':'no-store'}})
 }catch(error){
  const status=error instanceof Error&&error.message.includes('AUTHORITY')?409:503
  return NextResponse.json({success:false,error:status===409?'PURSE_PAPER_ROW_AUTHORITY_INVALID':'PURSE_READ_UNAVAILABLE'},{status})
 }
}
