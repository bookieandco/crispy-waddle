import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

type ApprovalBody={
  approve?:unknown;
  expectedCandidateSha256?:unknown;
  expectedFingerprintRef?:unknown;
  minimumSpeakerSimilarity?:unknown;
};

export async function POST(request:Request){
  const supabase=await createClient();
  const [{data:{user}},{data:{session}}]=await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});
  const accessToken=session?.access_token?.trim();
  if(!accessToken){
    return NextResponse.json({ok:false,error:'DIRECTOR_USER_SESSION_TOKEN_REQUIRED'},{status:503});
  }

  let body:ApprovalBody;
  try{body=await request.json() as ApprovalBody;}
  catch{return NextResponse.json({ok:false,error:'Expected JSON approval payload'},{status:400});}

  if(body.approve!==true){
    return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_VOICE_EXPLICIT_APPROVAL_REQUIRED'},{status:400});
  }
  const expectedCandidateSha256=String(body.expectedCandidateSha256??'').trim().toLowerCase();
  const expectedFingerprintRef=String(body.expectedFingerprintRef??'').trim();
  const minimumSpeakerSimilarity=Number(body.minimumSpeakerSimilarity);
  if(!/^[a-f0-9]{64}$/.test(expectedCandidateSha256)){
    return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_VOICE_EXPECTED_SHA_REQUIRED'},{status:400});
  }
  if(!expectedFingerprintRef.startsWith('speaker-embedding:ecapa-voxceleb:')){
    return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_VOICE_EXPECTED_FINGERPRINT_REQUIRED'},{status:400});
  }
  if(!Number.isFinite(minimumSpeakerSimilarity)||minimumSpeakerSimilarity<=0||minimumSpeakerSimilarity>1){
    return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_VOICE_SIMILARITY_FLOOR_INVALID'},{status:400});
  }

  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify({
      action:'voice-approve',
      approve:true,
      expectedCandidateSha256,
      expectedFingerprintRef,
      minimumSpeakerSimilarity,
    }),
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({
    ok:false,error:'DIRECTOR_BONEZ_VOICE_APPROVAL_GATEWAY_INVALID_JSON',
  }));
  return NextResponse.json(payload,{
    status:response.status,
    headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
  });
}
