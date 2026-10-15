import {NextResponse} from 'next/server'
import {readBizPurseReadiness} from '@/lib/opportunities/biz-purse-readiness-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function GET(){
 try {
  const status=await readBizPurseReadiness()
  return NextResponse.json({ok:true,status},{status:200,
   headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}})
 }catch(err){
  const msg=err instanceof Error?err.message:'BIZ_PURSE_UNAVAILABLE'
  const unauthorized=msg==='BIZ_PURSE_SESSION_REQUIRED'
  return NextResponse.json({ok:false,error:unauthorized?'Authentication required':'Business readiness unavailable',
   authority:'READINESS_ONLY',canMoveMoney:false,canTrade:false},
   {status:unauthorized?401:503,headers:{'cache-control':'private, no-store'}})
 }
}
