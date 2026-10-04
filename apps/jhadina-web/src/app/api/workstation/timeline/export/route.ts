import {serializeDirectorTimelineToFcpxml,serializeDirectorTimelineToOtio} from '@jhadina/director-core/nle-roundtrip'
import type {EditableTimeline} from '@jhadina/director-core/timeline-model'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

type ExportFormat='fcpxml'|'otio'

function filename(projectId:string,format:ExportFormat):string{
  const base=projectId.replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'jhadina-project'
  return `${base}.${format==='fcpxml'?'fcpxml':'otio'}`
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return Response.json({ok:false,error:'Authentication required'},{status:401})

    const body=await request.json() as {timeline?:EditableTimeline;format?:ExportFormat;timelineVersionId?:string}
    if(!body.timeline||!body.format)return Response.json({ok:false,error:'timeline and format are required'},{status:400})
    if(body.format!=='fcpxml'&&body.format!=='otio')return Response.json({ok:false,error:'unsupported export format'},{status:400})

    const privileged=createServiceRoleClient()
    if(!privileged)return Response.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId:body.timeline.projectId,userId:user.id,capability:'read'})

    const timelineVersionId=body.timelineVersionId?.trim()||body.timeline.versions.at(-1)?.id||`working:${body.timeline.version}`
    const payload=body.format==='fcpxml'
      ? serializeDirectorTimelineToFcpxml(body.timeline,timelineVersionId)
      : serializeDirectorTimelineToOtio(body.timeline,timelineVersionId)
    const contentType=body.format==='fcpxml'?'application/xml; charset=utf-8':'application/json; charset=utf-8'

    return new Response(payload,{
      status:200,
      headers:{
        'content-type':contentType,
        'content-disposition':`attachment; filename="${filename(body.timeline.projectId,body.format)}"`,
        'cache-control':'no-store',
        'x-jhadina-project-id':body.timeline.projectId,
        'x-jhadina-timeline-version-id':timelineVersionId,
      },
    })
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_TIMELINE_EXPORT_FAILED'
    const status=message.includes('ACCESS_DENIED')||message.includes('CAPABILITY_DENIED')?403:400
    return Response.json({ok:false,error:message},{status})
  }
}
