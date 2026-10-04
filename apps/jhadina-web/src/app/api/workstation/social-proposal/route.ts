import {NextResponse} from 'next/server'
import type {JhadinaBrand} from '@jhadina/social-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {requestSocialPublication} from '@/lib/social/governed-publication'

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {
      projectId?:string
      assetId?:string
      brand?:JhadinaBrand
      text?:string
      scheduledAt?:string
      targetAccountIds?:string[]
    }
    const projectId=body.projectId?.trim()??''
    const assetId=body.assetId?.trim()??''
    const text=body.text?.trim()??''
    if(!projectId||!assetId||!body.brand||!text||!body.targetAccountIds?.length){
      return NextResponse.json({ok:false,error:'projectId, assetId, brand, text and targetAccountIds are required'},{status:400})
    }
    if(body.scheduledAt&&(!Number.isFinite(Date.parse(body.scheduledAt))||Date.parse(body.scheduledAt)<=Date.now())){
      return NextResponse.json({ok:false,error:'SOCIAL_AUTOMATION_SCHEDULE_MUST_BE_FUTURE'},{status:400})
    }

    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'})

    const [{data:asset,error:assetError},{data:approval,error:approvalError}]=await Promise.all([
      privileged.from('director_generated_editing_assets')
        .select('id,project_id,uri,media_type,mime_type,generation_job_id,metadata')
        .eq('id',assetId).eq('project_id',projectId).maybeSingle(),
      privileged.from('director_editing_asset_approvals')
        .select('asset_id,approval_id,approved_at,approved_by_user_id')
        .eq('asset_id',assetId).eq('approved_by_user_id',user.id).maybeSingle(),
    ])
    if(assetError)throw new Error('DIRECTOR_SOCIAL_ASSET_READ_FAILED:'+assetError.message)
    if(approvalError)throw new Error('DIRECTOR_SOCIAL_ASSET_APPROVAL_READ_FAILED:'+approvalError.message)
    if(!asset)throw new Error('DIRECTOR_SOCIAL_ASSET_NOT_FOUND')
    if(!approval)throw new Error('DIRECTOR_SOCIAL_ASSET_EDIT_APPROVAL_REQUIRED')
    if(!String(asset.uri).trim())throw new Error('DIRECTOR_SOCIAL_ASSET_URI_REQUIRED')

    const result=await requestSocialPublication({
      brand:body.brand,
      text,
      mediaUrls:[String(asset.uri)],
      scheduledAt:body.scheduledAt,
      targetAccountIds:body.targetAccountIds,
      idempotencyKey:[
        'director',
        projectId,
        assetId,
        body.scheduledAt??'immediate',
        ...[...body.targetAccountIds].sort(),
      ].join(':'),
    })

    return NextResponse.json({
      ok:true,
      projectId,
      directorAsset:{
        assetId:String(asset.id),
        generationJobId:String(asset.generation_job_id),
        mediaType:asset.media_type,
        editApprovalReceiptId:String(approval.approval_id),
      },
      proposal:result.proposal,
      publicationApproval:{
        required:true,
        receiptId:result.approvalReceiptId,
      },
      publicationAuthority:'APPROVAL_REQUIRED',
      paidMediaAuthority:'NONE',
    },{status:202})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SOCIAL_PROPOSAL_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/NOT_FOUND/.test(message)?404:/REQUIRED|SCHEDULE|TARGET/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
