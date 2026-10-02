import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createClient} from '@/lib/supabase/server';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';
import {createMusicAutopilotRepository} from '@/lib/music/music-autopilot-repository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Body={
  artistKey?:unknown;
  enabled?:unknown;
  allowedSocialAccountIds?:unknown;
  maxDirectorJobsPerRun?:unknown;
  maxSocialProposalsPerRun?:unknown;
  maxPreapprovedPaidMinorPerRun?:unknown;
  maxPreapprovedPaidMinorPerDay?:unknown;
  currency?:unknown;
  allowPreparedAssets?:unknown;
  allowApprovedContentScheduling?:unknown;
  allowPreapprovedPaidTests?:unknown;
  pauseOnAmbiguousExternalState?:unknown;
  paidAuthorityRef?:unknown;
};

export async function GET(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const artistKey=req.nextUrl.searchParams.get('artistKey')?.trim()||'atwood-bookie';
    const projection=await loadMusicJuggernautProjection({userId:identity.userId,artistKey,initialize:true});
    if(!projection)return NextResponse.json({success:false,error:'Music Juggernaut project not found'},{status:404});
    const charter=await createMusicAutopilotRepository().getCharter(identity.userId,String(projection.project.id));
    return NextResponse.json({success:true,data:{projectId:String(projection.project.id),artistKey,charter}});
  }catch(error){
    return failure(error);
  }
}

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as Body;
    const artistKey=text(body.artistKey)||'atwood-bookie';
    const projection=await loadMusicJuggernautProjection({userId:identity.userId,artistKey,initialize:true});
    if(!projection)return NextResponse.json({success:false,error:'Music Juggernaut project not found'},{status:404});
    const projectId=String(projection.project.id);
    const current=await createMusicAutopilotRepository().getCharter(identity.userId,projectId);
    const allowedSocialAccountIds=arrayOfText(body.allowedSocialAccountIds)??[...current.allowedSocialAccountIds];
    const values={
      enabled:boolean(body.enabled,current.enabled),
      allowedSocialAccountIds,
      maxDirectorJobsPerRun:integer(body.maxDirectorJobsPerRun,current.maxDirectorJobsPerRun),
      maxSocialProposalsPerRun:integer(body.maxSocialProposalsPerRun,current.maxSocialProposalsPerRun),
      maxPreapprovedPaidMinorPerRun:integer(body.maxPreapprovedPaidMinorPerRun,current.maxPreapprovedPaidMinorPerRun),
      maxPreapprovedPaidMinorPerDay:integer(body.maxPreapprovedPaidMinorPerDay,current.maxPreapprovedPaidMinorPerDay),
      currency:text(body.currency)||current.currency,
      allowPreparedAssets:boolean(body.allowPreparedAssets,current.allowPreparedAssets),
      allowApprovedContentScheduling:boolean(body.allowApprovedContentScheduling,current.allowApprovedContentScheduling),
      allowPreapprovedPaidTests:boolean(body.allowPreapprovedPaidTests,current.allowPreapprovedPaidTests),
      pauseOnAmbiguousExternalState:boolean(body.pauseOnAmbiguousExternalState,current.pauseOnAmbiguousExternalState),
      paidAuthorityRef:text(body.paidAuthorityRef)||null,
    };
    if(values.maxPreapprovedPaidMinorPerRun>values.maxPreapprovedPaidMinorPerDay){
      return NextResponse.json({success:false,error:'Per-run paid limit cannot exceed daily paid limit'},{status:400});
    }
    if(values.allowPreapprovedPaidTests&&(!values.paidAuthorityRef||values.maxPreapprovedPaidMinorPerRun<=0||values.maxPreapprovedPaidMinorPerDay<=0)){
      return NextResponse.json({success:false,error:'Preapproved paid tests require positive limits and an existing paid authority reference'},{status:400});
    }
    const db=await createClient();
    const {data,error}=await db.rpc('jhadina_music_autopilot_set_charter',{
      p_project_id:projectId,
      p_enabled:values.enabled,
      p_allowed_social_account_ids:values.allowedSocialAccountIds,
      p_max_director_jobs_per_run:values.maxDirectorJobsPerRun,
      p_max_social_proposals_per_run:values.maxSocialProposalsPerRun,
      p_max_preapproved_paid_minor_per_run:values.maxPreapprovedPaidMinorPerRun,
      p_max_preapproved_paid_minor_per_day:values.maxPreapprovedPaidMinorPerDay,
      p_currency:values.currency,
      p_allow_prepared_assets:values.allowPreparedAssets,
      p_allow_approved_content_scheduling:values.allowApprovedContentScheduling,
      p_allow_preapproved_paid_tests:values.allowPreapprovedPaidTests,
      p_pause_on_ambiguous_external_state:values.pauseOnAmbiguousExternalState,
      p_paid_authority_ref:values.paidAuthorityRef,
    }).single();
    if(error||!data)throw new Error('MUSIC_AUTOPILOT_CHARTER_WRITE_FAILED:'+(error?.message??'missing'));
    const charter=await createMusicAutopilotRepository().getCharter(identity.userId,projectId);
    return NextResponse.json({success:true,data:{projectId,artistKey,charter}});
  }catch(error){
    return failure(error);
  }
}

function failure(error:unknown){
  const message=error instanceof Error?error.message:'Music autopilot charter failed';
  const status=/identity|session|signed in|authentication/i.test(message)?401
    :/PROJECT_NOT_FOUND|project not found/i.test(message)?404
      :/LIMIT|PAID_AUTHORITY|REQUIRED|INVALID/i.test(message)?400
        :/NOT_CONFIGURED|not configured/i.test(message)?503
          :422;
  return NextResponse.json({success:false,error:message},{status});
}
function text(value:unknown):string{return typeof value==='string'?value.trim():'';}
function boolean(value:unknown,fallback:boolean):boolean{return typeof value==='boolean'?value:fallback;}
function integer(value:unknown,fallback:number):number{
  if(value===undefined)return fallback;
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new Error('MUSIC_AUTOPILOT_LIMIT_INVALID');
  return n;
}
function arrayOfText(value:unknown):string[]|undefined{
  if(value===undefined)return undefined;
  if(!Array.isArray(value))throw new Error('MUSIC_AUTOPILOT_SOCIAL_SCOPE_INVALID');
  return [...new Set(value.map((item)=>String(item).trim()).filter(Boolean))];
}
