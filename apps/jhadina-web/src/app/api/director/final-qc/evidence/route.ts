import {NextResponse} from 'next/server'
import type {
  DirectorHierarchicalCoherenceDecision,
  FinalExportInspection,
} from '@jhadina/director-core'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function strings(value:unknown):string[]{
  return Array.isArray(value)?[...new Set(value.map(String).map(item=>item.trim()).filter(Boolean))]:[]
}

export async function POST(request:Request){
  const secret=process.env.DIRECTOR_API_SECRET
  if(!secret||request.headers.get('authorization')!==('Bearer '+secret)){
    return NextResponse.json({ok:false,error:'unauthorized'},{status:401})
  }
  try{
    const body=await request.json() as {
      projectId?:string
      ownerUserId?:string
      finalMasterAssetId?:string
      timelineVersionId?:string
      finalInspection?:FinalExportInspection
      coherence?:DirectorHierarchicalCoherenceDecision
      audioStemRoles?:string[]
      audioEvidenceIds?:string[]
      narrationEvidenceIds?:string[]
      lipSyncEvidenceIds?:string[]
      nleExportEvidenceIds?:string[]
      evidenceIds?:string[]
      source?:string
    }
    const projectId=body.projectId?.trim()??''
    const ownerUserId=body.ownerUserId?.trim()??''
    if(!projectId||!ownerUserId){
      return NextResponse.json({ok:false,error:'projectId and ownerUserId are required'},{status:400})
    }
    if(body.finalInspection&&body.finalInspection.projectId!==projectId){
      return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_FINAL_QC_INSPECTION_PROJECT_MISMATCH'},{status:400})
    }
    if(body.coherence&&body.coherence.authority!=='DIRECTOR_HIERARCHICAL_COHERENCE_QC'){
      return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_FINAL_QC_COHERENCE_AUTHORITY_INVALID'},{status:400})
    }

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    const {data:context,error:contextError}=await client.from('director_project_business_context')
      .select('project_id,owner_user_id').eq('project_id',projectId).eq('owner_user_id',ownerUserId).maybeSingle()
    if(contextError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_CONTEXT_READ_FAILED:'+contextError.message)
    if(!context)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_FINAL_QC_CONTEXT_NOT_FOUND'},{status:404})

    const now=new Date().toISOString()
    const {data,error}=await client.from('director_project_final_qc_evidence').upsert({
      project_id:projectId,
      owner_user_id:ownerUserId,
      final_master_asset_id:body.finalMasterAssetId?.trim()||null,
      timeline_version_id:body.timelineVersionId?.trim()||null,
      final_inspection:body.finalInspection??null,
      coherence:body.coherence??null,
      audio_stem_roles:strings(body.audioStemRoles),
      audio_evidence_ids:strings(body.audioEvidenceIds),
      narration_evidence_ids:strings(body.narrationEvidenceIds),
      lip_sync_evidence_ids:strings(body.lipSyncEvidenceIds),
      nle_export_evidence_ids:strings(body.nleExportEvidenceIds),
      evidence_ids:strings(body.evidenceIds),
      source:body.source?.trim()||'director-post-runtime',
      updated_at:now,
    },{onConflict:'project_id'}).select('project_id,updated_at,source').single()
    if(error)throw new Error('DIRECTOR_PROJECT_FINAL_QC_EVIDENCE_WRITE_FAILED:'+error.message)

    return NextResponse.json({
      ok:true,
      evidence:data,
      authority:'EVIDENCE_DEPOSIT_ONLY',
      canApprove:false,
      canPublish:false,
    },{status:201})
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:'DIRECTOR_PROJECT_FINAL_QC_EVIDENCE_WRITE_FAILED',
    },{status:500})
  }
}