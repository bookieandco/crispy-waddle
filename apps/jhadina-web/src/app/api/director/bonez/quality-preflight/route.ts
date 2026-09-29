import {NextResponse} from 'next/server';
import {createConfiguredDirectorHunyuanVideoProvider} from '@/lib/director-hunyuan-video-provider';
import {
  BONEZ_PRODUCT_REFERENCE_ASSET_ID,
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_PROJECT_ID,
  BONEZ_REFERENCE_ASSET_ID,
  BONEZ_REFERENCE_SHA256,
} from '@/lib/director-bonez-canon';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

type Row=Record<string,any>;
type StageState={
  passed:boolean;
  runnable:boolean;
  blockers:string[];
  evidence:Record<string,unknown>;
};

function unique(items:string[]):string[]{
  return [...new Set(items)];
}

async function nativeVoiceReadiness(){
  const base=(process.env.JHADINA_VOICE_URL??'').replace(/\/$/,'');
  const token=process.env.JHADINA_VOICE_TOKEN??'';
  if(!base||!token){
    return {configured:false,native:false,status:'browser-fallback'};
  }
  try{
    const response=await fetch(`${base}/health`,{signal:AbortSignal.timeout(12_000),cache:'no-store'});
    const health=await response.json().catch(()=>({})) as Row;
    const status=String(health.status??(response.ok?'reachable':'unavailable'));
    const native=response.ok&&status==='ready'&&health.canonicalVoiceProfile==='jhadina:canonical';
    return {configured:true,native,status,health};
  }catch(cause){
    return {
      configured:true,
      native:false,
      status:'unavailable',
      error:cause instanceof Error?cause.message:'VOICE_HEALTH_FAILED',
    };
  }
}

async function hunyuanReadiness(){
  const provider=createConfiguredDirectorHunyuanVideoProvider();
  if(!provider) return {configured:false,productionReady:false,status:'not-configured'};
  try{
    const health=await provider.health();
    const productionReady=health.status==='ready'&&health.productionReady===true;
    return {
      configured:true,
      productionReady,
      status:productionReady?'ready':String(health.status??'blocked'),
      health,
    };
  }catch(cause){
    return {
      configured:true,
      productionReady:false,
      status:'unavailable',
      error:cause instanceof Error?cause.message:'DIRECTOR_HUNYUAN_HEALTH_FAILED',
    };
  }
}

export async function GET(request:Request){
  const oidc=process.env.VERCEL_OIDC_TOKEN?.trim()
    ||request.headers.get('x-vercel-oidc-token')?.trim()
    ||undefined;
  if(!oidc){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }

  const upstream=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify({action:'status'}),
    cache:'no-store',
  });
  const data=await upstream.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_PREFLIGHT_INVALID_JSON'})) as Row;
  if(!upstream.ok) return NextResponse.json(data,{status:upstream.status});

  const references=Array.isArray(data.references)?data.references as Row[]:[];
  const char=references.find(row=>row.id===BONEZ_REFERENCE_ASSET_ID);
  const product=references.find(row=>row.id===BONEZ_PRODUCT_REFERENCE_ASSET_ID);
  const charReady=Boolean(
    char&&char.sha256===BONEZ_REFERENCE_SHA256&&char.referenceKind==='character'
    &&char.admissionStatus==='admitted'&&char.scanStatus==='clean'
  );
  const productReady=Boolean(
    product&&product.sha256===BONEZ_PRODUCT_REFERENCE_SHA256&&product.referenceKind==='product'
    &&product.admissionStatus==='admitted'&&product.scanStatus==='clean'
  );
  const castReady=Boolean(data.cast&&data.cast.characterId==='bonez');

  const q2Blockers:string[]=[];
  if(!charReady) q2Blockers.push('DIRECTOR_BONEZ_CHARACTER_REFERENCE_NOT_ADMITTED');
  if(!productReady) q2Blockers.push('DIRECTOR_BONEZ_PRODUCT_REFERENCE_NOT_ADMITTED');
  if(!castReady) q2Blockers.push('DIRECTOR_BONEZ_CAST_NOT_ADMITTED');
  const q2Passed=q2Blockers.length===0;

  const identities=Array.isArray(data.voiceIdentities)?data.voiceIdentities as Row[]:[];
  const bindings=Array.isArray(data.voiceProviderBindings)?data.voiceProviderBindings as Row[]:[];
  const validIdentities=identities.filter(identity=>
    Array.isArray(identity.speakerFingerprintRefs)&&identity.speakerFingerprintRefs.length>0
    &&Number.isFinite(identity.minimumSpeakerSimilarity)
    &&identity.minimumSpeakerSimilarity>0&&identity.minimumSpeakerSimilarity<=1
    &&bindings.some(binding=>
      binding.voiceIdentityId===identity.id
      &&Array.isArray(binding.provenanceRefs)&&binding.provenanceRefs.length>0
    )
  );
  const voiceCandidate=typeof data.voiceCandidate==='object'&&data.voiceCandidate?data.voiceCandidate as Row:null;
  const voiceCandidateReceipt=typeof data.voiceCandidateReceipt==='object'&&data.voiceCandidateReceipt
    ?data.voiceCandidateReceipt as Row:null;
  const candidateAssetSha=String(voiceCandidate?.sha256??'');
  const candidateReceiptSha=String(voiceCandidateReceipt?.artifactSha256??'');
  const candidateReady=Boolean(
    voiceCandidate
    &&voiceCandidate.metadata?.candidate===true
    &&voiceCandidate.metadata?.canonical===false
    &&voiceCandidate.metadata?.approved===false
    &&/^[a-f0-9]{64}$/i.test(candidateAssetSha)
    &&voiceCandidateReceipt
    &&voiceCandidateReceipt.approvalState==='candidate_unapproved'
    &&voiceCandidateReceipt.artifactHashStatus==='verified'
    &&candidateReceiptSha===candidateAssetSha
  );
  const speakerFingerprints=Array.isArray(data.speakerFingerprintReceipts)
    ?data.speakerFingerprintReceipts as Row[]:[];
  const matchingSpeakerFingerprint=speakerFingerprints.find(receipt=>
    receipt.sourceAssetId===voiceCandidate?.id
    &&receipt.sourceSha256===candidateAssetSha
    &&/^[a-f0-9]{64}$/i.test(String(receipt.embeddingSha256??''))
    &&typeof receipt.fingerprintRef==='string'
    &&receipt.fingerprintRef.startsWith('speaker-embedding:ecapa-voxceleb:')
    &&Number(receipt.embeddingDimensions)>0
    &&receipt.qualityClaim===false
  );
  const speakerFingerprintReady=Boolean(matchingSpeakerFingerprint);

  const q3Blockers:string[]=[];
  if(!q2Passed) q3Blockers.push('DIRECTOR_QUALITY_2_REQUIRED');
  if(!candidateReady) q3Blockers.push('DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING');
  if(!speakerFingerprintReady) q3Blockers.push('DIRECTOR_BONEZ_SPEAKER_FINGERPRINT_REQUIRED');
  if(!validIdentities.length) q3Blockers.push('DIRECTOR_BONEZ_APPROVED_VOICE_IDENTITY_REQUIRED');
  const q3Passed=q3Blockers.length===0;

  const [voiceRuntime,hunyuan]=await Promise.all([
    nativeVoiceReadiness(),hunyuanReadiness(),
  ]);
  const speakerQcRuntime=typeof data.speakerQcRuntime==='object'&&data.speakerQcRuntime
    ?data.speakerQcRuntime as Row
    :{configured:false,productionReady:false,status:'not-configured'};
  const videos=Array.isArray(data.recentVideoArtifacts)?data.recentVideoArtifacts as Row[]:[];
  const q4Receipt=videos.find(row=>{
    const metadata=row.metadata??{};
    const duration=Number(metadata.measuredDurationSeconds??metadata.durationSeconds);
    return metadata.directorQualityStage==='DIRECTOR-QUALITY.4'
      &&metadata.productionProvider===true
      &&metadata.qualityClaim===true
      &&Number.isFinite(duration)&&duration>=5&&duration<=10
      &&/^[a-f0-9]{64}$/i.test(String(row.sha256??''));
  });
  const q4PrereqBlockers:string[]=[];
  if(!q2Passed) q4PrereqBlockers.push('DIRECTOR_QUALITY_2_REQUIRED');
  if(!q3Passed) q4PrereqBlockers.push('DIRECTOR_QUALITY_3_REQUIRED');
  if(!voiceRuntime.native) q4PrereqBlockers.push('DIRECTOR_NATIVE_VOICE_RUNTIME_NOT_READY');
  if(!speakerQcRuntime.productionReady) q4PrereqBlockers.push('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY');
  if(!hunyuan.productionReady) q4PrereqBlockers.push('DIRECTOR_HUNYUAN_PRODUCTION_NOT_READY');
  const q4Runnable=q4PrereqBlockers.length===0;
  const q4Passed=Boolean(q4Receipt);
  const q4Blockers=[...q4PrereqBlockers];
  if(!q4Passed) q4Blockers.push('DIRECTOR_QUALITY_4_REAL_RENDER_RECEIPT_REQUIRED');

  const q5Receipt=videos.find(row=>{
    const metadata=row.metadata??{};
    return metadata.directorQualityStage==='DIRECTOR-QUALITY.5'
      &&typeof metadata.localizedRepairReceiptId==='string'
      &&metadata.localizedRepairReceiptId.length>0
      &&metadata.forcedFailureObserved===true
      &&metadata.localizedRepairPassed===true;
  });
  const q5Runnable=q4Passed;
  const q5Passed=Boolean(q5Receipt);
  const q5Blockers:string[]=[];
  if(!q4Passed) q5Blockers.push('DIRECTOR_QUALITY_4_REQUIRED');
  if(!q5Passed) q5Blockers.push('DIRECTOR_QUALITY_5_REAL_FAILURE_REPAIR_RECEIPT_REQUIRED');

  const stages:Record<string,StageState>={
    'DIRECTOR-QUALITY.2-LIVE':{
      passed:q2Passed,
      runnable:!q2Passed,
      blockers:unique(q2Blockers),
      evidence:{characterReferenceReady:charReady,productReferenceReady:productReady,castReady},
    },
    'DIRECTOR-QUALITY.3-LIVE':{
      passed:q3Passed,
      runnable:q2Passed&&candidateReady&&speakerFingerprintReady&&!q3Passed,
      blockers:unique(q3Blockers),
      evidence:{
        voiceCandidateReady:candidateReady,
        voiceCandidateReceiptVerified:Boolean(
          voiceCandidateReceipt
          &&voiceCandidateReceipt.artifactHashStatus==='verified'
          &&candidateReceiptSha===candidateAssetSha
        ),
        speakerFingerprintReady,
        speakerFingerprintReceiptId:matchingSpeakerFingerprint?.id??null,
        speakerFingerprintRef:matchingSpeakerFingerprint?.fingerprintRef??null,
        approvedMovieGradeVoiceIdentityCount:validIdentities.length,
        nativeVoiceRuntime:voiceRuntime,
        speakerQcRuntime,
      },
    },
    'DIRECTOR-QUALITY.4':{
      passed:q4Passed,
      runnable:q4Runnable&&!q4Passed,
      blockers:unique(q4Blockers),
      evidence:{hunyuan,voiceRuntime,speakerQcRuntime,realRenderReceiptId:q4Receipt?.id??null},
    },
    'DIRECTOR-QUALITY.5':{
      passed:q5Passed,
      runnable:q5Runnable&&!q5Passed,
      blockers:unique(q5Blockers),
      evidence:{forcedRepairReceiptId:q5Receipt?.id??null},
    },
  };

  return NextResponse.json({
    ok:true,
    projectId:BONEZ_PROJECT_ID,
    authority:'DIRECTOR_BONEZ_PREFLIGHT_ONLY',
    certificationAuthorityUnchanged:true,
    stages,
    staging:{
      stagedChunkCount:Number(data.stagedChunkCount??0),
      activeBootstrapTokenCount:Number(data.activeBootstrapTokenCount??0),
    },
  },{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
}
