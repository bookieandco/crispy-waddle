import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient} from '@/lib/supabase/service-role'
import {importRunpodShadowBatch,type RunpodShadowImportRecord} from '@/lib/money/shark-shadow-runpod-import'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function POST(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  let body:any
  try{body=await request.json()}catch{return NextResponse.json({ok:false,error:'valid_json_required'},{status:400})}
  if(!Array.isArray(body?.records))return NextResponse.json({ok:false,error:'records_array_required'},{status:400})
  if(body.records.length>500)return NextResponse.json({ok:false,error:'batch_too_large'},{status:413})
  const records:RunpodShadowImportRecord[]=body.records.map((x:any)=>({
    recordType:String(x?.recordType??'') as RunpodShadowImportRecord['recordType'],
    recordId:String(x?.recordId??''),
    payload:x?.payload,
    createdAt:typeof x?.createdAt==='string'?x.createdAt:undefined,
  }))
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'shadow_import_storage_unavailable'},{status:503})
  try{
    const receipt=await importRunpodShadowBatch(client,records)
    return NextResponse.json({ok:receipt.rejected===0,receipt})
  }catch(error){
    console.error('RunPod shadow import failed',error)
    return NextResponse.json({ok:false,error:'shadow_import_failed'},{status:502})
  }
}
