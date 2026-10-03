import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';
const ALLOWED_WORKER_HOST_SUFFIXES=['.proxy.runpod.net','.up.railway.app'];

type Json=Record<string,unknown>;

function oidcToken(request:Request){
  return process.env.VERCEL_OIDC_TOKEN?.trim()
    ||request.headers.get('x-vercel-oidc-token')?.trim()
    ||undefined;
}

async function gateway(oidc:string,body:Json){
  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store',
    signal:AbortSignal.timeout(120_000),
  });
  const payload=await response.json().catch(()=>({
    ok:false,
    error:'DIRECTOR_SPEAKER_QC_GATEWAY_INVALID_JSON',
  })) as Json;
  return {response,payload};
}

function workerBaseUrl(value:unknown){
  if(typeof value!=='string'||!value.trim()) return undefined;
  const parsed=new URL(value);
  const allowed=ALLOWED_WORKER_HOST_SUFFIXES.some((suffix)=>parsed.hostname.endsWith(suffix));
  if(parsed.protocol!=='https:'||!allowed||parsed.username||parsed.password){
    throw new Error('DIRECTOR_SPEAKER_QC_RUNTIME_URL_NOT_ADMITTED');
  }
  parsed.pathname=parsed.pathname.replace(/\/+$/,'');
  parsed.search='';
  parsed.hash='';
  return parsed.toString().replace(/\/$/,'');
}

function jsonError(error:string,status=503,extra:Json={}){
  return NextResponse.json(
    {ok:false,error,...extra},
    {status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}},
  );
}

export async function GET(request:Request){
  const oidc=oidcToken(request);
  if(!oidc){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }

  const [bindingResult,sourceResult]=await Promise.all([
    gateway(oidc,{action:'speaker-runtime-binding'}),
    gateway(oidc,{action:'speaker-fingerprint-source'}),
  ]);

  if(!bindingResult.response.ok){
    return NextResponse.json(bindingResult.payload,{
      status:bindingResult.response.status,
      headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
    });
  }
  if(bindingResult.payload.configured!==true){
    return jsonError('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED');
  }
  if(!sourceResult.response.ok){
    return NextResponse.json(sourceResult.payload,{
      status:sourceResult.response.status,
      headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
    });
  }

  let baseUrl:string|undefined;
  try{
    baseUrl=workerBaseUrl(bindingResult.payload.baseUrl);
  }catch(cause){
    return jsonError(
      cause instanceof Error?cause.message:'DIRECTOR_SPEAKER_QC_RUNTIME_URL_NOT_ADMITTED',
    );
  }
  if(!baseUrl) return jsonError('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED');

  const healthResponse=await fetch(`${baseUrl}/health`,{
    cache:'no-store',
    signal:AbortSignal.timeout(30_000),
    redirect:'error',
  }).catch(()=>undefined);
  if(!healthResponse){
    return jsonError('DIRECTOR_SPEAKER_QC_RUNTIME_UNAVAILABLE');
  }
  const health=await healthResponse.json().catch(()=>({})) as Json;
  if(!healthResponse.ok||health.status!=='ready'||health.productionReady!==true){
    return jsonError('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY',503,{
      runtime:{
        configured:true,
        productionReady:false,
        status:typeof health.status==='string'?health.status:'unavailable',
      },
    });
  }

  const audioBase64=sourceResult.payload.audioBase64;
  const mimeType=sourceResult.payload.mimeType;
  const sourceSha256=sourceResult.payload.sourceSha256;
  const sourceAssetId=sourceResult.payload.sourceAssetId;
  if(
    typeof audioBase64!=='string'||!audioBase64||
    typeof mimeType!=='string'||!mimeType||
    typeof sourceSha256!=='string'||!/^[a-f0-9]{64}$/i.test(sourceSha256)||
    typeof sourceAssetId!=='string'||!sourceAssetId
  ){
    return jsonError('DIRECTOR_SPEAKER_QC_SOURCE_INVALID');
  }

  const fingerprintResponse=await fetch(`${baseUrl}/v1/fingerprint`,{
    method:'POST',
    headers:{
      authorization:`Bearer ${oidc}`,
      'content-type':'application/json',
    },
    body:JSON.stringify({
      mimeType,
      audioBase64,
      expectedSourceSha256:sourceSha256,
    }),
    cache:'no-store',
    signal:AbortSignal.timeout(120_000),
    redirect:'error',
  }).catch(()=>undefined);
  if(!fingerprintResponse){
    return jsonError('DIRECTOR_SPEAKER_QC_FINGERPRINT_UNAVAILABLE');
  }
  const fingerprint=await fingerprintResponse.json().catch(()=>({})) as Json;
  if(!fingerprintResponse.ok){
    return jsonError(
      `DIRECTOR_SPEAKER_QC_FINGERPRINT_FAILED:${fingerprintResponse.status}`,
      503,
    );
  }

  const persisted=await gateway(oidc,{
    action:'speaker-fingerprint-receipt',
    receipt:{sourceAssetId,...fingerprint},
  });
  if(!persisted.response.ok){
    return NextResponse.json(persisted.payload,{
      status:persisted.response.status,
      headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
    });
  }

  return NextResponse.json({
    ...persisted.payload,
    runtime:{
      configured:true,
      productionReady:true,
      status:'ready',
      modelId:health.modelId??null,
      modelRevision:health.modelRevision??null,
    },
    authority:'DIRECTOR_SPEAKER_QC_EVIDENCE_ONLY',
    approved:false,
    canonicalVoiceIdentityCreated:false,
  },{
    status:200,
    headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
  });
}
