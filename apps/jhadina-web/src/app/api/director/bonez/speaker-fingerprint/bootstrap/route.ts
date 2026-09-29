import {NextResponse} from 'next/server';
import {createConfiguredDirectorSpeakerQcProvider} from '@/lib/director-speaker-qc-provider';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';
const BONEZ_VOICE_ASSET_ID='asset:audio:bonez:voice-audition:v1';

function oidcToken(request:Request){
  return process.env.VERCEL_OIDC_TOKEN?.trim()
    ||request.headers.get('x-vercel-oidc-token')?.trim()
    ||undefined;
}

async function gateway(oidc:string,body:Record<string,unknown>){
  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_GATEWAY_INVALID_JSON'}));
  return {response,payload};
}

export async function GET(request:Request){
  const oidc=oidcToken(request);
  if(!oidc){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }

  const provider=createConfiguredDirectorSpeakerQcProvider();
  if(!provider){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED',
      phase:'DIRECTOR-QUALITY.3-SPEAKER-QC',
    },{status:503});
  }

  let health:Readonly<Record<string,unknown>>;
  try{
    health=await provider.health();
  }catch(cause){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_SPEAKER_QC_RUNTIME_UNAVAILABLE',
      detail:cause instanceof Error?cause.message:'DIRECTOR_SPEAKER_QC_HEALTH_FAILED',
    },{status:503});
  }
  if(health.status!=='ready'||health.productionReady!==true){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY',
      health,
    },{status:503});
  }

  const source=await gateway(oidc,{action:'speaker-fingerprint-source'});
  if(!source.response.ok){
    return NextResponse.json(source.payload,{status:source.response.status});
  }
  const sourceBody=source.payload as Record<string,unknown>;
  if(
    sourceBody.sourceAssetId!==BONEZ_VOICE_ASSET_ID
    ||typeof sourceBody.audioBase64!=='string'
    ||typeof sourceBody.mimeType!=='string'
    ||typeof sourceBody.sourceSha256!=='string'
  ){
    return NextResponse.json({ok:false,error:'DIRECTOR_SPEAKER_QC_SOURCE_INVALID'},{status:502});
  }

  let fingerprint;
  try{
    fingerprint=await provider.fingerprint({
      audioBase64:sourceBody.audioBase64,
      mimeType:sourceBody.mimeType,
      expectedSourceSha256:sourceBody.sourceSha256,
    });
  }catch(cause){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_SPEAKER_QC_FINGERPRINT_FAILED',
      detail:cause instanceof Error?cause.message:'DIRECTOR_SPEAKER_QC_FINGERPRINT_FAILED',
    },{status:502});
  }
  if(fingerprint.sourceSha256!==sourceBody.sourceSha256){
    return NextResponse.json({ok:false,error:'DIRECTOR_SPEAKER_QC_SOURCE_HASH_MISMATCH'},{status:502});
  }

  const saved=await gateway(oidc,{
    action:'speaker-fingerprint-receipt',
    receipt:{
      sourceAssetId:BONEZ_VOICE_ASSET_ID,
      ...fingerprint,
    },
  });
  if(!saved.response.ok){
    return NextResponse.json(saved.payload,{status:saved.response.status});
  }

  return NextResponse.json({
    ...saved.payload,
    providerHealth:{
      status:health.status,
      productionReady:health.productionReady,
      modelId:health.modelId??null,
      modelRevision:health.modelRevision??null,
    },
    authority:'DIRECTOR_SPEAKER_QC_EVIDENCE_ONLY',
    approved:false,
    canonicalVoiceIdentityCreated:false,
  },{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
}
