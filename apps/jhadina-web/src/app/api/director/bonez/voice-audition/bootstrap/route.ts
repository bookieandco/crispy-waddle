import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

export async function GET(){
  const oidc=process.env.VERCEL_OIDC_TOKEN?.trim();
  if(!oidc) return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
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
