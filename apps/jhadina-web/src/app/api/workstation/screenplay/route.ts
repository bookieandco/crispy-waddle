import {NextResponse} from 'next/server'
import {proposeScreenplayBlueprint} from '@jhadina/director-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {CleanArtifactContextResolver} from '@/lib/artifacts/clean-artifact-context-resolver'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'})
    const {data,error}=await privileged.from('director_screenplay_ingest_proposals')
      .select('id,artifact_id,proposal,status,created_at,updated_at')
      .eq('project_id',projectId).eq('owner_user_id',user.id)
      .order('created_at',{ascending:false})
    if(error)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,proposals:data??[]})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SCREENPLAY_PROPOSAL_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;artifactId?:string;title?:string}
    const projectId=body.projectId?.trim()??''
    const artifactId=body.artifactId?.trim()??''
    if(!projectId||!artifactId)return NextResponse.json({ok:false,error:'projectId and artifactId are required'},{status:400})

    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'})

    const {data:binding,error:bindingError}=await privileged.from('director_project_inputs')
      .select('artifact_id,role,label').eq('project_id',projectId).eq('owner_user_id',user.id)
      .eq('artifact_id',artifactId).eq('role','script').maybeSingle()
    if(bindingError)throw new Error('DIRECTOR_SCREENPLAY_INPUT_READ_FAILED:'+bindingError.message)
    if(!binding)throw new Error('DIRECTOR_SCREENPLAY_SCRIPT_INPUT_REQUIRED')

    const contexts=await new CleanArtifactContextResolver(privileged,user.id).resolve([{id:artifactId}])
    const context=contexts.find(item=>item.id===artifactId)
    if(!context||context.kind!=='text'||!context.text?.trim())throw new Error('DIRECTOR_SCREENPLAY_TEXT_CONTEXT_REQUIRED')

    const proposal=proposeScreenplayBlueprint({
      projectId,
      title:body.title?.trim()||String(binding.label??context.name??'Untitled screenplay'),
      text:context.text,
      evidenceIds:[`artifact:${artifactId}`,`project-input:${artifactId}:script`],
    })
    const {data,error}=await privileged.from('director_screenplay_ingest_proposals').upsert({
      project_id:projectId,
      owner_user_id:user.id,
      artifact_id:artifactId,
      proposal,
      status:'proposed',
      updated_at:new Date().toISOString(),
    },{onConflict:'project_id,artifact_id,status'}).select('id,artifact_id,proposal,status,created_at,updated_at').single()
    if(error)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_WRITE_FAILED:'+error.message)
    return NextResponse.json({ok:true,proposalRecord:data},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SCREENPLAY_INGEST_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/REQUIRED|NOT_CLEAN|UNAVAILABLE|TOO_LARGE/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}


export async function PUT(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;proposalId?:string}
    const projectId=body.projectId?.trim()??''
    const proposalId=body.proposalId?.trim()??''
    if(!projectId||!proposalId)return NextResponse.json({ok:false,error:'projectId and proposalId are required'},{status:400})

    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'approve'})

    const {data:proposalRow,error:proposalError}=await privileged.from('director_screenplay_ingest_proposals')
      .select('id,project_id,artifact_id,proposal,status')
      .eq('id',proposalId).eq('project_id',projectId).eq('owner_user_id',user.id).maybeSingle()
    if(proposalError)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_READ_FAILED:'+proposalError.message)
    if(!proposalRow)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_NOT_FOUND')
    if(proposalRow.status!=='proposed'&&proposalRow.status!=='accepted')throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_NOT_ACCEPTABLE')

    const proposal=proposalRow.proposal as {
      blockers?:unknown
      sourceEvidenceIds?:unknown
      treatment?:unknown
      scenes?:unknown
      authority?:unknown
    }
    const blockers=Array.isArray(proposal.blockers)?proposal.blockers.map(String).filter(Boolean):[]
    if(blockers.length)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_BLOCKED:'+blockers.join(','))
    if(proposal.authority!=='DIRECTOR_SCREENPLAY_PROPOSAL_ONLY')throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_AUTHORITY_INVALID')
    if(!proposal.treatment||!Array.isArray(proposal.scenes)||!proposal.scenes.length){
      throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_STRUCTURE_REQUIRED')
    }

    const {data:existingBlueprint,error:existingError}=await privileged.from('director_screenplay_blueprints')
      .select('id,version,blueprint,evidence_ids,accepted_at')
      .eq('project_id',projectId).eq('source_proposal_id',proposalId).maybeSingle()
    if(existingError)throw new Error('DIRECTOR_SCREENPLAY_BLUEPRINT_READ_FAILED:'+existingError.message)
    if(existingBlueprint){
      return NextResponse.json({ok:true,blueprint:existingBlueprint,alreadyAccepted:true})
    }

    const {data:latest,error:latestError}=await privileged.from('director_screenplay_blueprints')
      .select('version').eq('project_id',projectId).order('version',{ascending:false}).limit(1).maybeSingle()
    if(latestError)throw new Error('DIRECTOR_SCREENPLAY_BLUEPRINT_VERSION_READ_FAILED:'+latestError.message)
    const version=(latest?.version?Number(latest.version):0)+1
    const evidenceIds=[
      ...new Set([
        ...(Array.isArray(proposal.sourceEvidenceIds)?proposal.sourceEvidenceIds.map(String):[]),
        'screenplay-proposal:'+proposalId,
        'artifact:'+String(proposalRow.artifact_id),
      ].filter(Boolean)),
    ]
    const acceptedAt=new Date().toISOString()
    const {data:blueprint,error:blueprintError}=await privileged.from('director_screenplay_blueprints').insert({
      project_id:projectId,
      owner_user_id:user.id,
      source_artifact_id:proposalRow.artifact_id,
      source_proposal_id:proposalId,
      version,
      blueprint:{
        treatment:proposal.treatment,
        scenes:proposal.scenes,
        authority:'DIRECTOR_SCREENPLAY_BLUEPRINT',
      },
      evidence_ids:evidenceIds,
      accepted_at:acceptedAt,
      accepted_by_user_id:user.id,
    }).select('id,version,blueprint,evidence_ids,accepted_at').single()
    if(blueprintError)throw new Error('DIRECTOR_SCREENPLAY_BLUEPRINT_WRITE_FAILED:'+blueprintError.message)

    const {error:proposalUpdateError}=await privileged.from('director_screenplay_ingest_proposals')
      .update({status:'accepted',updated_at:acceptedAt}).eq('id',proposalId)
    if(proposalUpdateError)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_ACCEPT_FAILED:'+proposalUpdateError.message)

    const blueprintRef='screenplay-blueprint:'+String(blueprint.id)
    const {data:stages,error:stageReadError}=await privileged.from('director_creative_stages')
      .select('id,input_artifact_ids,status').eq('project_id',projectId).in('kind',['storyboard','shotlist'])
    if(stageReadError)throw new Error('DIRECTOR_SCREENPLAY_STAGE_READ_FAILED:'+stageReadError.message)
    for(const stage of stages??[]){
      const current=Array.isArray(stage.input_artifact_ids)?stage.input_artifact_ids.map(String):[]
      const inputs=[...new Set([...current,blueprintRef])]
      const patch:Record<string,unknown>={input_artifact_ids:inputs,updated_at:acceptedAt}
      if(stage.status==='planned')patch.status='ready'
      const {error}=await privileged.from('director_creative_stages').update(patch).eq('id',stage.id)
      if(error)throw new Error('DIRECTOR_SCREENPLAY_STAGE_BIND_FAILED:'+error.message)
    }

    const {data:project}=await privileged.from('director_production_projects')
      .select('id,snapshot,evidence_ids').eq('id',projectId).maybeSingle()
    if(project){
      const snapshot=project.snapshot&&typeof project.snapshot==='object'?project.snapshot as Record<string,unknown>:{}
      const projectEvidence=Array.isArray(project.evidence_ids)?project.evidence_ids.map(String):[]
      const {error}=await privileged.from('director_production_projects').update({
        snapshot:{
          ...snapshot,
          screenplayBlueprintId:String(blueprint.id),
          screenplayBlueprintVersion:version,
          screenplaySourceArtifactId:String(proposalRow.artifact_id),
        },
        evidence_ids:[...new Set([...projectEvidence,...evidenceIds,blueprintRef])],
        updated_at:acceptedAt,
      }).eq('id',projectId)
      if(error)throw new Error('DIRECTOR_SCREENPLAY_PROJECT_BIND_FAILED:'+error.message)
    }

    return NextResponse.json({
      ok:true,
      blueprint,
      storyboardAndShotlistReady:true,
      authority:'SCREENPLAY_STRUCTURE_ACCEPTED_ONLY',
      generatedShotApproval:false,
    },{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SCREENPLAY_ACCEPT_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/NOT_FOUND/.test(message)?404:/REQUIRED|BLOCKED|INVALID|ACCEPTABLE|STRUCTURE/.test(message)?409:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
