import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority';
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository';

export async function GET(request:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??'';
    if(!projectId) return NextResponse.json({ok:false,error:'projectId is required'},{status:400});

    const privileged=createServiceRoleClient();
    if(!privileged) return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503});
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'});

    const repository=new DirectorWorkstationTimelineRepository(privileged);
    const current=await repository.ensure(projectId,user.id);
    return NextResponse.json({
      ok:true,
      projectId,
      snapshotVersion:current.version,
      timeline:current.timeline,
      updatedAt:current.createdAt,
    },{headers:{'cache-control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_TIMELINE_LOAD_FAILED';
    const status=message.includes('ACCESS_DENIED')||message.includes('CAPABILITY_DENIED')?403:message.includes('NOT_CONFIGURED')?503:400;
    return NextResponse.json({ok:false,error:message},{status});
  }
}
