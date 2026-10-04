import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

type GateKind='storyboard'|'shotlist'

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))return 403
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRED|INVALID|NOT_READY|BLOCKED|MISMATCH/.test(message))return 409
  return 500
}

async function productionContext(client:ReturnType<typeof createServiceRoleClient> extends infer T?Exclude<T,null>:never,projectId:string,userId:string){
  const {data,error}=await client.from('director_project_business_context')
    .select('project_id,owner_user_id,production_run_id,automation_status')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(error)throw new Error('DIRECTOR_WORKSTATION_GATE_CONTEXT_READ_FAILED:'+error.message)
  if(!data)throw new Error('DIRECTOR_WORKSTATION_GATE_CONTEXT_NOT_FOUND')
  const runId=String(data.production_run_id??'')
  if(!runId)throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_REQUIRED')
  return {runId,automationStatus:String(data.automation_status??'planned')}
}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const context=await productionContext(client,projectId,user.id)

    const [{data:run,error:runError},{data:gates,error:gateError},{data:stages,error:stageError}]=await Promise.all([
      client.from('director_production_runs')
        .select('id,status,shot_ids,gate_ids,updated_at')
        .eq('id',context.runId).eq('project_id',projectId).maybeSingle(),
      client.from('director_creative_gates')
        .select('id,kind,decision,requested_at,decided_at,note,decided_by,evidence_ids,version')
        .eq('project_id',projectId).eq('run_id',context.runId)
        .in('kind',['storyboard','shotlist'])
        .order('requested_at',{ascending:true}),
      client.from('director_creative_stages')
        .select('id,kind,status,input_artifact_ids,output_artifact_ids,version,approved_at,approved_by')
        .eq('project_id',projectId)
        .in('kind',['storyboard','shotlist','previs','rehearsal','generation']),
    ])
    if(runError)throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_READ_FAILED:'+runError.message)
    if(gateError)throw new Error('DIRECTOR_WORKSTATION_GATE_READ_FAILED:'+gateError.message)
    if(stageError)throw new Error('DIRECTOR_WORKSTATION_GATE_STAGE_READ_FAILED:'+stageError.message)
    if(!run)throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_NOT_FOUND')

    const storyboard=stages?.find(stage=>stage.kind==='storyboard')
    const boardIds=Array.isArray(storyboard?.output_artifact_ids)?storyboard.output_artifact_ids.map(String):[]
    let boards:unknown[]=[]
    if(boardIds.length){
      const {data,error}=await client.from('director_storyboard_boards')
        .select('id,sequence_id,shot_id,ordinal,status,title,description,script_ref,action,framing,camera_language,version,updated_at')
        .eq('project_id',projectId).in('id',boardIds).order('ordinal',{ascending:true})
      if(error)throw new Error('DIRECTOR_WORKSTATION_GATE_BOARD_READ_FAILED:'+error.message)
      boards=data??[]
    }

    return NextResponse.json({
      ok:true,
      projectId,
      run,
      gates:gates??[],
      stages:stages??[],
      boards,
      automationStatus:context.automationStatus,
      generationAuthorized:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WORKSTATION_GATE_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;gateId?:string;note?:string}
    const projectId=body.projectId?.trim()??''
    const gateId=body.gateId?.trim()??''
    if(!projectId||!gateId)return NextResponse.json({ok:false,error:'projectId and gateId are required'},{status:400})

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'approve'})
    const context=await productionContext(client,projectId,user.id)

    const [{data:run,error:runError},{data:gate,error:gateError},{data:stages,error:stageError}]=await Promise.all([
      client.from('director_production_runs')
        .select('id,status,gate_ids').eq('id',context.runId).eq('project_id',projectId).maybeSingle(),
      client.from('director_creative_gates')
        .select('id,kind,decision,version').eq('id',gateId).eq('run_id',context.runId).eq('project_id',projectId).maybeSingle(),
      client.from('director_creative_stages')
        .select('id,kind,status,output_artifact_ids,version')
        .eq('project_id',projectId)
        .in('kind',['storyboard','shotlist','previs','rehearsal','generation']),
    ])
    if(runError)throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_READ_FAILED:'+runError.message)
    if(gateError)throw new Error('DIRECTOR_WORKSTATION_GATE_READ_FAILED:'+gateError.message)
    if(stageError)throw new Error('DIRECTOR_WORKSTATION_GATE_STAGE_READ_FAILED:'+stageError.message)
    if(!run)throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_NOT_FOUND')
    if(!gate)throw new Error('DIRECTOR_WORKSTATION_GATE_NOT_FOUND')
    if(!Array.isArray(run.gate_ids)||!run.gate_ids.map(String).includes(gateId)){
      throw new Error('DIRECTOR_WORKSTATION_GATE_RUN_MISMATCH')
    }
    if(gate.kind!=='storyboard'&&gate.kind!=='shotlist')throw new Error('DIRECTOR_WORKSTATION_GATE_KIND_INVALID')
    const kind=gate.kind as GateKind
    if(gate.decision==='approved'){
      return NextResponse.json({ok:true,gateId,kind,decision:'approved',alreadyApproved:true,generationAuthorized:false})
    }
    if(gate.decision!=='pending')throw new Error('DIRECTOR_WORKSTATION_GATE_NOT_READY')

    const stage=stages?.find(item=>item.kind===kind)
    if(!stage)throw new Error('DIRECTOR_WORKSTATION_GATE_STAGE_NOT_FOUND')
    if(stage.status!=='review'&&stage.status!=='ready'){
      throw new Error('DIRECTOR_WORKSTATION_GATE_STAGE_NOT_READY')
    }

    const now=new Date().toISOString()
    if(kind==='storyboard'){
      const boardIds=Array.isArray(stage.output_artifact_ids)?stage.output_artifact_ids.map(String):[]
      if(!boardIds.length)throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_OUTPUT_REQUIRED')
      const {data:boards,error:boardError}=await client.from('director_storyboard_boards')
        .select('id,status,version').eq('project_id',projectId).in('id',boardIds)
      if(boardError)throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_READ_FAILED:'+boardError.message)
      if((boards??[]).length!==boardIds.length)throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_PARTIAL_STATE_BLOCKED')
      for(const board of boards??[]){
        if(board.status==='approved')continue
        if(board.status!=='draft'&&board.status!=='ready'){
          throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_BOARD_NOT_READY:'+String(board.id))
        }
        const {data:updated,error}=await client.from('director_storyboard_boards').update({
          status:'approved',
          version:Number(board.version)+1,
          updated_at:now,
        }).eq('id',board.id).eq('project_id',projectId).eq('version',board.version)
          .select('id,status,version').maybeSingle()
        if(error)throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_APPROVAL_FAILED:'+error.message)
        if(!updated){
          const {data:current}=await client.from('director_storyboard_boards')
            .select('id,status').eq('id',board.id).eq('project_id',projectId).maybeSingle()
          if(current?.status!=='approved')throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_CONCURRENT_UPDATE_BLOCKED')
        }
      }
    }else{
      const storyboardStage=stages?.find(item=>item.kind==='storyboard')
      const {data:storyboardGate,error:storyboardGateError}=await client.from('director_creative_gates')
        .select('id,decision').eq('project_id',projectId).eq('run_id',context.runId).eq('kind','storyboard').maybeSingle()
      if(storyboardGateError)throw new Error('DIRECTOR_WORKSTATION_STORYBOARD_GATE_READ_FAILED:'+storyboardGateError.message)
      if(storyboardStage?.status!=='approved'||storyboardGate?.decision!=='approved'){
        throw new Error('DIRECTOR_WORKSTATION_SHOTLIST_BLOCKED_BY_STORYBOARD')
      }
    }

    const {error:stageApproveError}=await client.from('director_creative_stages').update({
      status:'approved',
      approved_at:now,
      approved_by:user.id,
      updated_at:now,
    }).eq('id',stage.id).eq('project_id',projectId)
    if(stageApproveError)throw new Error('DIRECTOR_WORKSTATION_GATE_STAGE_APPROVAL_FAILED:'+stageApproveError.message)

    const {error:gateApproveError}=await client.from('director_creative_gates').update({
      decision:'approved',
      decided_at:now,
      decided_by:user.id,
      note:body.note?.trim()||null,
    }).eq('id',gateId).eq('run_id',context.runId).eq('project_id',projectId).eq('decision','pending')
    if(gateApproveError)throw new Error('DIRECTOR_WORKSTATION_GATE_APPROVAL_FAILED:'+gateApproveError.message)

    let nextBoundary='SHOTLIST_APPROVAL_REQUIRED'
    if(kind==='shotlist'){
      const previs=stages?.find(item=>item.kind==='previs')
      if(previs?.status==='planned'){
        const {error}=await client.from('director_creative_stages').update({
          status:'ready',
          updated_at:now,
        }).eq('id',previs.id).eq('project_id',projectId).eq('status','planned')
        if(error)throw new Error('DIRECTOR_WORKSTATION_PREVIS_READY_FAILED:'+error.message)
      }
      const {error}=await client.from('director_production_runs').update({
        status:'planning',
        updated_at:now,
      }).eq('id',context.runId).eq('project_id',projectId)
      if(error)throw new Error('DIRECTOR_WORKSTATION_RUN_ADVANCE_FAILED:'+error.message)
      nextBoundary='PREVIS_AND_REHEARSAL'
    }

    return NextResponse.json({
      ok:true,
      gateId,
      kind,
      decision:'approved',
      nextBoundary,
      generationAuthorized:false,
      publicationAuthority:'NONE',
      paidMediaAuthority:'NONE',
    })
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WORKSTATION_GATE_APPROVAL_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}
