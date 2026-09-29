import {NextResponse} from 'next/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {recordBonezVoiceAuditionCandidate} from '@/lib/director-bonez-live-inputs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

export async function GET(request:Request){
  const privileged=createServiceRoleClient();
  if(privileged){
    try{
      const body=await recordBonezVoiceAuditionCandidate(privileged);
      return NextResponse.json(body,{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
    }catch(cause){
      const message=cause instanceof Error?cause.message:'DIRECTOR_BONEZ_VOICE_CAPTURE_FAILED';
      return NextResponse.json({ok:false,error:message},{status:500,headers:{'cache-control':'no-store'}});
    }
  }
  const oidc=process.env.VERCEL_OIDC_TOKEN?.trim()
    ||request.headers.get('x-vercel-oidc-token')?.trim()
    ||undefined;
  if(!oidc) return NextResponse.json({ok:false,error:'DIRECTOR_PRIVILEGED_RUNTIME_REQUIRED'},{status:503});
  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify({action:'voice-candidate'}),
    cache:'no-store',
  });
  const body=await response.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_VOICE_GATEWAY_INVALID_JSON'}));
  return NextResponse.json(body,{
    status:response.status,
    headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
  });
}
