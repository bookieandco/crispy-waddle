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
  const approvals=Array.isArray(data.voiceApprovalReceipts)?data.voiceApprovalReceipts as Row[]:[];
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
    &&['candidate_unapproved','approved'].includes(String(voiceCandidateReceipt.approvalState??''))
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
  const validIdentities=identities.filter(identity=>{
    if(
      !Array.isArray(identity.speakerFingerprintRefs)||!identity.speakerFingerprintRefs.length
      ||!Number.isFinite(identity.minimumSpeakerSimilarity)
      ||identity.minimumSpeakerSimilarity<=0||identity.minimumSpeakerSimilarity>1
    ) return false;
    const binding=bindings.find(item=>
      item.voiceIdentityId===identity.id
      &&Array.isArray(item.provenanceRefs)&&item.provenanceRefs.length>0
    );
    if(!binding) return false;
    return approvals.some(approval=>
      approval.voiceIdentityId===identity.id
      &&approval.authority==='DIRECTOR_EXPLICIT_VOICE_APPROVAL'
      &&approval.candidateSha256===candidateAssetSha
      &&approval.speakerFingerprintReceiptId===matchingSpeakerFingerprint?.id
      &&approval.speakerFingerprintRef===matchingSpeakerFingerprint?.fingerprintRef
      &&identity.speakerFingerprintRefs.includes(approval.speakerFingerprintRef)
      &&Number(approval.minimumSpeakerSimilarity)===Number(identity.minimumSpeakerSimilarity)
      &&approval.provider===binding.provider
      &&approval.modelId===binding.modelId
      &&approval.providerVoiceRef===binding.providerVoiceRef
    );
  });
  const explicitApprovalReceipts=approvals.filter(receipt=>receipt.authority==='DIRECTOR_EXPLICIT_VOICE_APPROVAL');

  const q3Blockers:string[]=[];
  if(!q2Passed) q3Blockers.push('DIRECTOR_QUALITY_2_REQUIRED');
  if(!candidateReady) q3Blockers.push('DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING');
  if(!speakerFingerprintReady) q3Blockers.push('DIRECTOR_BONEZ_SPEAKER_FINGERPRINT_REQUIRED');
  if(!validIdentities.length) q3Blockers.push('DIRECTOR_BONEZ_APPROVED_VOICE_IDENTITY_REQUIRED');
  const q3Passed=q3Blockers.length===0;

  const hunyuan=await hunyuanReadiness();
  const bonezVoiceRuntime=typeof data.bonezVoiceRuntime==='object'&&data.bonezVoiceRuntime
    ?data.bonezVoiceRuntime as Row
    :{configured:false,productionReady:false,status:'not-configured'};
  const speakerQcRuntime=typeof data.speakerQcRuntime==='object'&&data.speakerQcRuntime
    ?data.speakerQcRuntime as Row
    :{configured:false,productionReady:false,status:'not-configured'};
  const liveTakeReceipts=Array.isArray(data.liveTakeQcReceipts)?data.liveTakeQcReceipts as Row[]:[];
  const q4Receipt=liveTakeReceipts.find(row=>{
    const performance=typeof row.performanceEvidence==='object'&&row.performanceEvidence?row.performanceEvidence as Row:{};
    const interactions=new Set(Array.isArray(performance.interactionRefs)?performance.interactionRefs.map(String):[]);
    return row.purpose==='quality4-canary'
      &&row.referenceAssetId===BONEZ_REFERENCE_ASSET_ID
      &&row.referenceSha256===BONEZ_REFERENCE_SHA256
      &&validIdentities.some(identity=>identity.id===row.voiceIdentityId)
      &&row.speakerFingerprintReceiptId===matchingSpeakerFingerprint?.id
      &&row.speakerFingerprintRef===matchingSpeakerFingerprint?.fingerprintRef
      &&row.storageVerified===true
      &&row.productionProvider===true
      &&row.qcAdmissible===true
      &&Array.isArray(row.qcReasons)&&row.qcReasons.length===0
      &&Number.isFinite(row.measuredDurationSeconds)
      &&row.measuredDurationSeconds>=5&&row.measuredDurationSeconds<=10
      &&/^[a-f0-9]{64}$/i.test(String(row.outputSha256??''))
      &&performance.movedAwayFromChair===true
      &&performance.dialoguePerformed===true
      &&Number(performance.speakerSimilarity)>=0.80
      &&Number(performance.lipSyncScore)>=0.84
      &&['chair','microphone','set'].every(value=>interactions.has(value));
  });
  const q4Passed=Boolean(q4Receipt);
  const q4PrereqBlockers:string[]=[];
  if(!q2Passed) q4PrereqBlockers.push('DIRECTOR_QUALITY_2_REQUIRED');
  if(!q3Passed) q4PrereqBlockers.push('DIRECTOR_QUALITY_3_REQUIRED');
  if(!bonezVoiceRuntime.productionReady) q4PrereqBlockers.push('DIRECTOR_BONEZ_VOICE_PRODUCTION_RUNTIME_NOT_READY');
  if(!speakerQcRuntime.productionReady) q4PrereqBlockers.push('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY');
  if(!hunyuan.productionReady) q4PrereqBlockers.push('DIRECTOR_HUNYUAN_PRODUCTION_NOT_READY');
  const q4Runnable=!q4Passed&&q4PrereqBlockers.length===0;
  const q4Blockers=q4Passed?[]:[...q4PrereqBlockers,'DIRECTOR_QUALITY_4_REAL_RENDER_RECEIPT_REQUIRED'];

  const q5StressReceipt=liveTakeReceipts.find(row=>
    row.purpose==='quality5-stress'
    &&row.qcAdmissible===false
    &&row.expectedFailureObserved===true
    &&Array.isArray(row.qcReasons)&&row.qcReasons.length>0
    &&row.storageVerified===true
    &&row.productionProvider===true
    &&/^[a-f0-9]{64}$/i.test(String(row.outputSha256??''))
  );
  const repairs=Array.isArray(data.quality5RepairReceipts)?data.quality5RepairReceipts as Row[]:[];
  const q5Receipt=repairs.find(row=>
    q5StressReceipt
    &&row.failureTakeReceiptId===q5StressReceipt.id
    &&row.sourceAssetId===q5StressReceipt.outputAssetId
    &&row.sourceSha256===q5StressReceipt.outputSha256
    &&row.repairedAssetId!==row.sourceAssetId
    &&row.repairedSha256!==row.sourceSha256
    &&/^[a-f0-9]{64}$/i.test(String(row.repairedSha256??''))
    &&row.qcAdmissible===true
    &&Array.isArray(row.qcReasons)&&row.qcReasons.length===0
    &&Number(row.repairDurationSeconds)>0
    &&typeof row.preservationEvidence==='object'
    &&row.preservationEvidence?.identityPreserved===true
    &&row.preservationEvidence?.cameraTimingPreserved===true
    &&row.preservationEvidence?.unaffectedRegionsPreserved===true
  );
  const q5Passed=Boolean(q5Receipt);
  const q5Runnable=q4Passed&&!q5Passed;
  const q5Blockers=q5Passed?[]:[
    ...(!q4Passed?['DIRECTOR_QUALITY_4_REQUIRED']:[]),
    ...(!q5StressReceipt?['DIRECTOR_QUALITY_5_REAL_FAILURE_REQUIRED']:[]),
    'DIRECTOR_QUALITY_5_REAL_FAILURE_REPAIR_RECEIPT_REQUIRED',
  ];

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
        explicitVoiceApprovalReceiptCount:explicitApprovalReceipts.length,
        approvedMovieGradeVoiceIdentityCount:validIdentities.length,
        bonezVoiceRuntime,
        speakerQcRuntime,
      },
    },
    'DIRECTOR-QUALITY.4':{
      passed:q4Passed,
      runnable:q4Runnable&&!q4Passed,
      blockers:unique(q4Blockers),
      evidence:{
        hunyuan,bonezVoiceRuntime,speakerQcRuntime,
        realRenderReceiptId:q4Receipt?.id??null,
        outputAssetId:q4Receipt?.outputAssetId??null,
        providerRuntimeReceiptId:q4Receipt?.providerRuntimeReceiptId??null,
        measuredDurationSeconds:q4Receipt?.measuredDurationSeconds??null,
        rendererSelfCertified:false,
      },
    },
    'DIRECTOR-QUALITY.5':{
      passed:q5Passed,
      runnable:q5Runnable&&!q5Passed,
      blockers:unique(q5Blockers),
      evidence:{
        realFailureTakeReceiptId:q5StressReceipt?.id??null,
        forcedRepairReceiptId:q5Receipt?.id??null,
        repairedAssetId:q5Receipt?.repairedAssetId??null,
        repairDurationSeconds:q5Receipt?.repairDurationSeconds??null,
      },
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
