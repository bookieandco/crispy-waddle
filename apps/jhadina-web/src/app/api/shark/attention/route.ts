import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {isVerifiedPersonalOwner} from '@/lib/auth/personal-owner'

/** GET-only owner research inbox. No public route, scheduler or notifier. */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const revalidate=0

const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}
export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!isVerifiedPersonalOwner(user))
      return NextResponse.json({ok:false,error:'owner_auth_required'},{status:401,headers})
    const since=new Date(Date.now()-7*86400_000).toISOString()
    const {data,error}=await supabase.from('shark_attention_owner_alerts')
      .select('alert_id,mint,code,severity,source_url,observed_at')
      .eq('owner_id',user!.id).gte('observed_at',since)
      .order('observed_at',{ascending:false}).limit(30)
    if(error)
      return NextResponse.json({ok:false,error:'attention_read_model_not_commissioned',canTrade:false},
        {status:503,headers})
    // A present table is not evidence that a public source, worker or alert
    // delivery was commissioned. These are historical read-only receipts.
    return NextResponse.json({
      ok:true,status:'OWNER_RESEARCH_INBOX_READ_ONLY',
      delivery:'NONE',liveFeedCommissioned:false,
      canTrade:false,canSign:false,canNotify:false,
      alerts:data??[],
    },{headers})
  }catch{
    return NextResponse.json({ok:false,error:'attention_inbox_unavailable',canTrade:false},
      {status:503,headers})
  }
}
