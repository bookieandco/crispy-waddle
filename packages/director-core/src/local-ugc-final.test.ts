import {describe,expect,it} from 'vitest';
import type {DirectorLocalUgcFinalInput} from './local-ugc-final.js';
import {certifyDirectorLocalUgcFinal} from './local-ugc-final.js';

const sha=(c:string)=>c.repeat(64);
const marker='ugc-canary:canary-1';

function fixture():DirectorLocalUgcFinalInput{
  const runtimeBundle={
    schema:'director.human-media-runtime.v1' as const,
    engine:'musetalk' as const,
    runtimeVersion:'1.5',
    sourceRepository:'TMElyralab/MuseTalk',
    sourceRevision:'0a89dec45a0192b824e3cf4daf96c239440c5ed8',
    image:'shared-runpod-runtime',
    imageDigest:sha('a'),
    modelArtifacts:[{id:'musetalk-v15',sha256:sha('b'),licenseEvidenceIds:['license:musetalk:model-commercial']}],
    capabilities:['lip-sync' as const],
    minGpuVramGiB:4,
    authority:'DIRECTOR_HUMAN_MEDIA_RUNTIME_BUNDLE' as const,
  };
  const healthReceipt={
    schema:'director.human-media-health.v1' as const,
    runtimeInstanceId:'runpod:pod-1:musetalk',
    engine:'musetalk' as const,
    productionReady:true,
    imageDigest:sha('a'),
    sourceRevision:runtimeBundle.sourceRevision,
    modelArtifactSha256s:[sha('b')],
    gpu:{vendor:'nvidia' as const,model:'L4',count:1,vramGiBPerDevice:24},
    licenseEvidenceIds:['license:musetalk:model-commercial'],
    observedAt:'2026-10-07T15:10:00Z',
    reasons:[],
    authority:'DIRECTOR_HUMAN_MEDIA_HEALTH' as const,
  };
  const jobRequest={
    schema:'director.human-media-job.v1' as const,
    id:'job:canary-1',
    projectId:'director:ugc:canary-1',
    engine:'musetalk' as const,
    task:'lip-sync' as const,
    inputAssets:[
      {assetId:'source-video',role:'source-video' as const,mediaType:'video' as const,sha256:sha('c'),rightsEvidenceIds:['rights:creator']},
      {assetId:'audio',role:'driving-audio' as const,mediaType:'audio' as const,sha256:sha('d'),rightsEvidenceIds:['rights:voice']},
    ],
    parameters:{},
    evidenceIds:[marker,'ugc-plan:1','product-truth:1'],
    sensitiveData:false,
    allowCloudBurst:true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB' as const,
  };
  const executionReceipt={
    schema:'director.human-media-execution.v1' as const,
    jobId:jobRequest.id,
    providerJobId:'musetalk-job-1',
    engine:'musetalk' as const,
    task:'lip-sync' as const,
    status:'ready' as const,
    runtimeInstanceId:healthReceipt.runtimeInstanceId,
    imageDigest:sha('a'),
    sourceRevision:runtimeBundle.sourceRevision,
    modelArtifactSha256s:[sha('b')],
    startedAt:'2026-10-07T15:11:00Z',
    completedAt:'2026-10-07T15:12:00Z',
    output:{uri:'https://media.example/out.mp4',mediaType:'video' as const,sha256:sha('e')},
    qualityClaim:false as const,
    authority:'DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT' as const,
  };
  const metrics=[
    'technical-integrity','visual-readability','identity-stability','face-stability',
    'temporal-consistency','motion-naturalism','lip-sync',
  ] as const;
  const qcInput={
    projectId:jobRequest.projectId,
    jobId:jobRequest.id,
    outputAssetId:'asset:accepted',
    outputSha256:sha('e'),
    executionReceipt,
    observations:metrics.map(metric=>({
      metric,score:.95,confidence:.95,evidenceIds:[marker,`qc:${metric}`],
      source:metric==='lip-sync'?'sync-qc' as const:'watch' as const,
    })),
    attempt:1,
    evidenceIds:[marker,'watch:take-qc:1','sync:1'],
  };
  const economicsReceipt={
    schema:'director.human-media-attempt-economics.v1' as const,
    id:'economics:1',
    projectId:jobRequest.projectId,
    candidateId:'musetalk-runpod',
    engine:'musetalk' as const,
    task:'lip-sync' as const,
    executionTier:'gpu-burst' as const,
    billingModel:'metered-compute' as const,
    attemptNumber:1,
    qcAction:'accept' as const,
    accepted:true,
    generationCostUsd:1.5,
    repairCostUsd:.25,
    humanReviewMinutes:3,
    humanLaborRateUsdPerHour:20,
    pricingSourceRefs:['runpod-billing:1'],
    evidenceIds:[marker,'execution:musetalk-job-1'],
    observedAt:'2026-10-07T15:13:00Z',
    authority:'DIRECTOR_HUMAN_MEDIA_ATTEMPT_ECONOMICS' as const,
  };
  const ugcOutcome={
    schema:'director.ugc-variant-outcome.v1' as const,
    id:'outcome:1',
    projectId:jobRequest.projectId,
    experimentId:'ugc-experiment:1',
    variantId:'control',
    mutationAxis:'control' as const,
    artifactId:'asset:accepted',
    artifactSha256:sha('e'),
    generationJobId:executionReceipt.providerJobId,
    reviewDecisionId:'review:1',
    acceptedAt:'2026-10-07T15:14:00Z',
    acceptedOutputCostUsd:2.75,
    costEvidenceIds:[marker,'human-media-attempt-economics:economics:1'],
    reviewEvidenceIds:[marker,'review:approved:1'],
    experimentEvidenceIds:[marker,'ugc-experiment:1'],
    authority:'DIRECTOR_UGC_VARIANT_OUTCOME' as const,
  };
  return {
    canaryId:'canary-1',
    projectId:jobRequest.projectId,
    runtimeBundle,healthReceipt,jobRequest,executionReceipt,qcInput,economicsReceipt,ugcOutcome,
    socialHandoff:{
      projectId:jobRequest.projectId,
      productionReadyForSocialProposal:true,
      socialHandoffVerified:true,
      finalMasterAssetId:'asset:final-master',
      evidenceIds:[marker,'qc-admitted-final-master:asset:final-master','social-handoff:proposal:1'],
      observedAt:'2026-10-07T15:15:00Z',
    },
    evidenceIds:[marker,'business-factory:canary-1'],
  };
}

describe('DIRECTOR-LOCAL-UGC.FINAL convergence',()=>{
  it('certifies only a fully converged evidence-backed canary and grants no action authority',()=>{
    const result=certifyDirectorLocalUgcFinal(fixture());
    expect(result.admissible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.authority).toBe('DIRECTOR_LOCAL_UGC_FINAL_CERTIFICATION');
    expect(result.canApproveCreative).toBe(false);
    expect(result.canPublish).toBe(false);
    expect(result.canSpend).toBe(false);
    expect(result.evidenceIds).toContain('human-media-attempt-economics:economics:1');
  });

  it('rejects mixed-canary economics evidence',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,economicsReceipt:{...x.economicsReceipt,evidenceIds:['ugc-canary:other']},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_CANARY_LINEAGE_REQUIRED');
  });

  it('rejects runtime health drift',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,healthReceipt:{...x.healthReceipt,imageDigest:sha('f')},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_HEALTH:DIRECTOR_HUMAN_MEDIA_HEALTH_IMAGE_MISMATCH');
  });

  it('recomputes QC and rejects bad lip sync instead of trusting an accepted economics receipt',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,
      qcInput:{
        ...x.qcInput,
        observations:x.qcInput.observations.map(o=>o.metric==='lip-sync'?{...o,score:.2}:o),
      },
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_QC_ACCEPTANCE_REQUIRED');
  });

  it('rejects output hash drift across execution and accepted UGC outcome',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,ugcOutcome:{...x.ugcOutcome,artifactSha256:sha('f')},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_EXECUTION_OUTCOME_HASH_MISMATCH');
  });

  it('rejects accepted-output cost that does not equal realized attempt cost',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,ugcOutcome:{...x.ugcOutcome,acceptedOutputCostUsd:9},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_REALIZED_COST_MISMATCH');
  });

  it('rejects economics that contradicts Director QC acceptance',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,economicsReceipt:{...x.economicsReceipt,accepted:false,qcAction:'reroll-same-engine'},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_ACCEPTANCE_REQUIRED');
  });

  it('rejects canaries that have not reached governed Social handoff',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,socialHandoff:{...x.socialHandoff,socialHandoffVerified:false},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_HANDOFF_REQUIRED');
  });

  it('rejects Social evidence that is not bound to the same canary and admitted final master',()=>{
    const x=fixture();
    const result=certifyDirectorLocalUgcFinal({
      ...x,socialHandoff:{...x.socialHandoff,evidenceIds:['ugc-canary:other']},
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_CANARY_LINEAGE_REQUIRED');
    expect(result.reasons).toContain('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_MASTER_QC_LINK_REQUIRED');
  });
});
