import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

function oidcToken(request:Request){
  return process.env.VERCEL_OIDC_TOKEN?.trim()
    ||request.headers.get('x-vercel-oidc-token')?.trim()
    ||undefined;
}

export async function GET(request:Request){
  const oidc=oidcToken(request);
  if(!oidc){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }

  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify({action:'speaker-fingerprint-run'}),
    cache:'no-store',
    signal:AbortSignal.timeout(120_000),
  });
  const payload=await response.json().catch(()=>({
    ok:false,
    error:'DIRECTOR_SPEAKER_QC_GATEWAY_INVALID_JSON',
  }));
  return NextResponse.json(payload,{
    status:response.status,
    headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
  });
}
