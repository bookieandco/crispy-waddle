import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})

    const {data,error}=await client.from('director_watch_commissioning_receipts')
      .select('job_id,purpose,provider_id,source_kind,callback_verified,result_count,persisted_result_count,status,error,completed_at')
      .eq('owner_user_id',user.id)
      .order('completed_at',{ascending:false})
      .limit(50)
    if(error)throw new Error('DIRECTOR_WATCH_COMMISSION_READ_FAILED:'+error.message)

    const latestByPurpose=new Map<string,Record<string,unknown>>()
    for(const row of data??[]){
      const purpose=String(row.purpose)
      if(!latestByPurpose.has(purpose))latestByPurpose.set(purpose,row as Record<string,unknown>)
    }
    const purposes=['creative','sports','take-qc'] as const
    const purposeStatus=Object.fromEntries(purposes.map(purpose=>{
      const receipt=latestByPurpose.get(purpose)
      return [purpose,{
        commissioned:receipt?.status==='passed'&&receipt?.callback_verified===true&&Number(receipt?.persisted_result_count??0)>0,
        receipt:receipt??null,
      }]
    }))

    const configured=Boolean(
      process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL?.trim()&&
      process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN?.trim()&&
      process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL?.trim()&&
      process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()
    )

    return NextResponse.json({
      ok:true,
      configured,
      anyCommissioned:Object.values(purposeStatus).some(value=>value.commissioned),
      purposeStatus,
      authority:'WATCH_COMMISSIONING_EVIDENCE_ONLY',
      canPublish:false,
      canWager:false,
      canSpend:false,
    })
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_COMMISSION_READ_FAILED'},{status:500})
  }
}
