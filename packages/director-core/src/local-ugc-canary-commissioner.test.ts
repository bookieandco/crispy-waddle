import {describe,expect,it} from 'vitest';
import {
  inspectDirectorLocalUgcCanaryCommissioning,
  type DirectorLocalUgcCanaryState,
} from './local-ugc-canary-commissioner.js';
import {certifyDirectorLocalUgcFinal} from './local-ugc-final.js';

const sha=(c:string)=>c.repeat(64);
const marker='ugc-canary:canary-1';

function state():DirectorLocalUgcCanaryState{
  const runtimeBundle={
    schema:'director.human-media-runtime.v1' as const,
    engine:'musetalk' as const,
    runtimeVersion:'1.5',
    sourceRepository:'TMElyralab/MuseTalk',
    sourceRevision:'0a89dec45a0192b824e3cf4daf96c239440c5ed8',
    image:'shared-runpod-runtime',
    imageDigest:sha('a'),
    modelArtifacts:[{
      id:'musetalk-v15',
      sha256:sha('b'),
      licenseEvidenceIds:['license:musetalk:model-commercial'],
    }],
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
      {
        assetId:'source-video',
        role:'source-video' as const,
        mediaType:'video' as const,
        sha256:sha('c'),
        rightsEvidenceIds:['rights:creator'],
      },
      {
        assetId:'audio',
        role:'driving-audio' as const,
        mediaType:'audio' as const,
        sha256:sha('d'),
        rightsEvidenceIds:['rights:voice'],
      },
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
      metric,
      score:.95,
      confidence:.95,
      evidenceIds:[marker,`qc:${metric}`],
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
  const socialHandoff={
    projectId:jobRequest.projectId,
    productionReadyForSocialProposal:true,
    socialHandoffVerified:true,
    finalMasterAssetId:'asset:final-master',
    evidenceIds:[
      marker,
      'qc-admitted-final-master:asset:final-master',
      'social-handoff:proposal:1',
    ],
    observedAt:'2026-10-07T15:15:00Z',
  };

  const base={
    canaryId:'canary-1',
    projectId:jobRequest.projectId,
    runtimeBundle,
    healthReceipt,
    jobRequest,
    executionReceipt,
    qcInput,
    economicsReceipt,
    ugcOutcome,
    socialHandoff,
    evidenceIds:[marker,'business-factory:canary-1'],
  };
  return {
    ...base,
    finalCertification:certifyDirectorLocalUgcFinal(base),
  };
}

describe('Director local UGC canary commissioner',()=>{
  it('never grants compute, spend, creative approval or publication authority',()=>{
    const decision=inspectDirectorLocalUgcCanaryCommissioning(state());
    expect(decision.complete).toBe(true);
    expect(decision.nextBoundary).toBe('COMPLETE');
    expect(decision.canCreateCompute).toBe(false);
    expect(decision.canSpend).toBe(false);
    expect(decision.canApproveCreative).toBe(false);
    expect(decision.canPublish).toBe(false);
  });

  it('starts at runtime health when no live health receipt exists',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      healthReceipt:undefined,
      jobRequest:undefined,
      executionReceipt:undefined,
      qcInput:undefined,
      economicsReceipt:undefined,
      ugcOutcome:undefined,
      socialHandoff:undefined,
      finalCertification:undefined,
    });
    expect(decision.complete).toBe(false);
    expect(decision.admissibleToAdvance).toBe(true);
    expect(decision.nextBoundary).toBe('RUNTIME_HEALTH_REQUIRED');
  });

  it('stops on runtime drift instead of advancing to generation',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      healthReceipt:{...input.healthReceipt!,imageDigest:sha('f')},
    });
    expect(decision.nextBoundary).toBe('RUNTIME_HEALTH_REQUIRED');
    expect(decision.admissibleToAdvance).toBe(false);
    expect(decision.blockers).toContain(
      'DIRECTOR_LOCAL_UGC_CANARY_HEALTH:DIRECTOR_HUMAN_MEDIA_HEALTH_IMAGE_MISMATCH',
    );
  });

  it('advances one boundary at a time after valid runtime health',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      jobRequest:undefined,
      executionReceipt:undefined,
      qcInput:undefined,
      economicsReceipt:undefined,
      ugcOutcome:undefined,
      socialHandoff:undefined,
      finalCertification:undefined,
    });
    expect(decision.nextBoundary).toBe('HUMAN_MEDIA_JOB_REQUIRED');
    expect(decision.admissibleToAdvance).toBe(true);
  });

  it('requires accepted Director QC before economics',()=>{
    const input=state();
    const badQc={
      ...input.qcInput!,
      observations:input.qcInput!.observations.map(observation=>
        observation.metric==='lip-sync'?{...observation,score:.2}:observation
      ),
    };
    const decision=inspectDirectorLocalUgcCanaryCommissioning({...input,qcInput:badQc});
    expect(decision.nextBoundary).toBe('HUMAN_MEDIA_QC_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_QC_ACCEPTANCE_REQUIRED');
  });

  it('requires realized economics to agree with the accepted UGC outcome',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      ugcOutcome:{...input.ugcOutcome!,acceptedOutputCostUsd:9},
    });
    expect(decision.nextBoundary).toBe('UGC_OUTCOME_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_REALIZED_COST_MISMATCH');
    expect(decision.realizedAcceptedOutputCostUsd).toBeCloseTo(2.75);
  });

  it('requires the governed Social handoff and exact QC-admitted master',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      socialHandoff:{
        ...input.socialHandoff!,
        socialHandoffVerified:false,
        evidenceIds:[marker],
      },
    });
    expect(decision.nextBoundary).toBe('SOCIAL_HANDOFF_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_HANDOFF_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_MASTER_QC_LINK_REQUIRED');
  });

  it('refuses a stale/mismatched FINAL receipt and recomputes certification from the chain',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      finalCertification:{
        ...input.finalCertification!,
        projectId:'director:ugc:other',
      },
    });
    expect(decision.complete).toBe(false);
    expect(decision.nextBoundary).toBe('FINAL_CERTIFICATION_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_FINAL_RECEIPT_MISMATCH');
  });

  it('does not mix canary evidence across stages',()=>{
    const input=state();
    const decision=inspectDirectorLocalUgcCanaryCommissioning({
      ...input,
      economicsReceipt:{
        ...input.economicsReceipt!,
        evidenceIds:['ugc-canary:other'],
      },
    });
    expect(decision.nextBoundary).toBe('ACCEPTED_OUTPUT_ECONOMICS_REQUIRED');
    expect(decision.blockers).toContain('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_LINEAGE_REQUIRED');
  });
});
