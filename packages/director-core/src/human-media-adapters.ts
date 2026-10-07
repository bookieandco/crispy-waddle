import {
  resolveDialogueVoice,
  type CharacterVoiceIdentity,
  type DialogueGenerationRequest,
  type VoiceProviderBinding,
} from './voice-identity.js';
import {
  assertPerformanceDirectionPlan,
  compilePerformanceDirective,
  type PerformanceDirectionPlan,
} from './performance-direction.js';
import {
  validateVoiceSyncInput,
  type VoiceSyncInput,
} from './studio-voice-sync.js';
import {
  validateDirectorHumanMediaJob,
  type DirectorHumanMediaAssetRef,
  type DirectorHumanMediaJobRequest,
} from './human-media-worker-contract.js';

export type DirectorGovernedMediaAsset=Readonly<{
  assetId:string;
  mediaType:'image'|'video'|'audio';
  sha256:string;
  rightsEvidenceIds:readonly string[];
  uri?:string;
}>;

export type DirectorCoquiVoiceAdapterInput=Readonly<{
  jobId:string;
  identity:CharacterVoiceIdentity;
  request:DialogueGenerationRequest;
  providerBindingId:string;
  modelLicenseEvidenceIds:readonly string[];
  referenceAssetUris?:Readonly<Record<string,string>>;
  sampleRateHz?:number;
  outputFormat?:'wav'|'flac';
  allowCloudBurst?:boolean;
}>;

export type DirectorLivePortraitDetectorAdmission=Readonly<{
  id:string;
  modelId:string;
  sha256:string;
  licenseEvidenceIds:readonly string[];
  commercialUseApproved:boolean;
}>;

export type DirectorLivePortraitAdapterInput=Readonly<{
  jobId:string;
  projectId:string;
  source:DirectorGovernedMediaAsset;
  drivingVideo:DirectorGovernedMediaAsset;
  performancePlan:PerformanceDirectionPlan;
  detector:DirectorLivePortraitDetectorAdmission;
  evidenceIds:readonly string[];
  parameters?:Readonly<Record<string,unknown>>;
  sensitiveData?:boolean;
  allowCloudBurst?:boolean;
}>;

export type DirectorMuseTalkAdapterInput=Readonly<{
  jobId:string;
  projectId:string;
  voiceSync:VoiceSyncInput;
  video:DirectorGovernedMediaAsset;
  audio:DirectorGovernedMediaAsset;
  evidenceIds:readonly string[];
  parameters?:Readonly<Record<string,unknown>>;
  sensitiveData?:boolean;
  allowCloudBurst?:boolean;
}>;

export type DirectorSadTalkerFallbackReason=
  |'musetalk-unavailable'
  |'musetalk-runtime-failed'
  |'musetalk-qc-rejected'
  |'still-only-source'
  |'prototype-budget';

export type DirectorSadTalkerAdapterInput=Readonly<{
  jobId:string;
  projectId:string;
  sourceImage:DirectorGovernedMediaAsset;
  audio:DirectorGovernedMediaAsset;
  fallbackReason:DirectorSadTalkerFallbackReason;
  primaryAttemptEvidenceIds:readonly string[];
  evidenceIds:readonly string[];
  parameters?:Readonly<Record<string,unknown>>;
  sensitiveData?:boolean;
  allowCloudBurst?:boolean;
}>;

const SHA256_RE=/^(?:sha256:)?[a-f0-9]{64}$/i;

function unique(values:readonly string[]):readonly string[]{
  return Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))]);
}

function assertEvidence(values:readonly string[],code:string):readonly string[]{
  const normalized=unique(values);
  if(!normalized.length)throw new Error(code);
  return normalized;
}

function asset(
  input:DirectorGovernedMediaAsset,
  role:DirectorHumanMediaAssetRef['role'],
):DirectorHumanMediaAssetRef{
  if(!input.assetId.trim())throw new Error('DIRECTOR_HUMAN_MEDIA_ASSET_ID_REQUIRED');
  if(!input.rightsEvidenceIds.length)throw new Error(`DIRECTOR_HUMAN_MEDIA_ASSET_RIGHTS_REQUIRED:${input.assetId}`);
  if(!SHA256_RE.test(input.sha256.trim()))throw new Error(`DIRECTOR_HUMAN_MEDIA_ASSET_SHA_INVALID:${input.assetId}`);
  return Object.freeze({
    assetId:input.assetId,
    role,
    mediaType:input.mediaType,
    ...(input.uri?.trim()?{uri:input.uri.trim()}:{}),
    sha256:input.sha256,
    rightsEvidenceIds:unique(input.rightsEvidenceIds),
  });
}

function assertPrepared(job:DirectorHumanMediaJobRequest):DirectorHumanMediaJobRequest{
  const reasons=validateDirectorHumanMediaJob(job);
  if(reasons.length)throw new Error(`DIRECTOR_HUMAN_MEDIA_ADAPTER_INVALID:${reasons.join(',')}`);
  return Object.freeze(job);
}

function findBinding(
  identity:CharacterVoiceIdentity,
  request:DialogueGenerationRequest,
  bindingId:string,
):VoiceProviderBinding{
  const resolution=resolveDialogueVoice(identity,request);
  if(!resolution.valid){
    throw new Error(`DIRECTOR_COQUI_VOICE_NOT_RESOLVED:${resolution.reasons.join(',')}`);
  }
  const binding=resolution.providerBindings.find(candidate=>candidate.id===bindingId);
  if(!binding)throw new Error('DIRECTOR_COQUI_PROVIDER_BINDING_NOT_AUTHORIZED');
  const provider=binding.provider.toLowerCase();
  if(!provider.includes('coqui')){
    throw new Error('DIRECTOR_COQUI_PROVIDER_BINDING_REQUIRED');
  }
  return binding;
}

export function buildDirectorCoquiVoiceJob(
  input:DirectorCoquiVoiceAdapterInput,
):DirectorHumanMediaJobRequest{
  if(input.request.projectId!==input.identity.projectId){
    throw new Error('DIRECTOR_COQUI_PROJECT_MISMATCH');
  }
  const binding=findBinding(input.identity,input.request,input.providerBindingId);
  const modelLicenseEvidenceIds=assertEvidence(
    input.modelLicenseEvidenceIds,
    'DIRECTOR_COQUI_MODEL_LICENSE_EVIDENCE_REQUIRED',
  );
  const refs=input.identity.referenceSamples.filter(sample=>binding.referenceSampleIds.includes(sample.id));
  const cloned=input.identity.source==='owned-recording'||input.identity.source==='consented-clone';
  if(cloned&&!refs.length)throw new Error('DIRECTOR_COQUI_REFERENCE_REQUIRED');

  const inputAssets=refs.map(sample=>asset({
    assetId:sample.assetId,
    mediaType:'audio',
    sha256:sample.sha256,
    rightsEvidenceIds:unique([sample.rightsRef]),
    uri:input.referenceAssetUris?.[sample.assetId],
  },'target-voice'));

  const evidenceIds=unique([
    ...input.request.evidenceIds,
    ...binding.provenanceRefs,
    ...refs.flatMap(sample=>sample.qualityEvidenceIds),
    ...modelLicenseEvidenceIds,
    ...(input.identity.consentRef?[input.identity.consentRef]:[]),
  ]);

  return assertPrepared({
    schema:'director.human-media-job.v1',
    id:input.jobId,
    projectId:input.request.projectId,
    engine:'coqui-tts',
    task:cloned?'voice-clone':'voice-synthesis',
    inputAssets:Object.freeze(inputAssets),
    text:input.request.text,
    language:input.request.language,
    voiceIdentityId:input.identity.id,
    parameters:Object.freeze({
      providerBindingId:binding.id,
      modelId:binding.modelId,
      voiceVariantId:input.request.voiceVariantId,
      characterId:input.request.characterId,
      sceneId:input.request.sceneId,
      lineId:input.request.lineId,
      ...(binding.providerVoiceRef?{providerVoiceRef:binding.providerVoiceRef}:{}),
      ...(input.request.deliveryInstruction?{deliveryInstruction:input.request.deliveryInstruction}:{}),
      ...(input.request.targetDurationSeconds!==undefined?{targetDurationSeconds:input.request.targetDurationSeconds}:{}),
      sampleRateHz:input.sampleRateHz??binding.sampleRateHz??48_000,
      outputFormat:input.outputFormat??'wav',
      modelLicenseEvidenceIds:[...modelLicenseEvidenceIds],
    }),
    evidenceIds,
    sensitiveData:cloned,
    allowCloudBurst:cloned?false:input.allowCloudBurst===true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB',
  });
}

export function buildDirectorLivePortraitJob(
  input:DirectorLivePortraitAdapterInput,
):DirectorHumanMediaJobRequest{
  if(input.source.mediaType!=='image'&&input.source.mediaType!=='video'){
    throw new Error('DIRECTOR_LIVEPORTRAIT_SOURCE_VISUAL_REQUIRED');
  }
  if(input.drivingVideo.mediaType!=='video'){
    throw new Error('DIRECTOR_LIVEPORTRAIT_DRIVING_VIDEO_REQUIRED');
  }
  assertPerformanceDirectionPlan(input.performancePlan);
  if(!input.detector.commercialUseApproved){
    throw new Error('DIRECTOR_LIVEPORTRAIT_COMMERCIAL_DETECTOR_REQUIRED');
  }
  if(!input.detector.id.trim()||!input.detector.modelId.trim()||!SHA256_RE.test(input.detector.sha256.trim())){
    throw new Error('DIRECTOR_LIVEPORTRAIT_DETECTOR_PROVENANCE_INVALID');
  }
  const detectorLicenseEvidenceIds=assertEvidence(
    input.detector.licenseEvidenceIds,
    'DIRECTOR_LIVEPORTRAIT_DETECTOR_LICENSE_EVIDENCE_REQUIRED',
  );

  return assertPrepared({
    schema:'director.human-media-job.v1',
    id:input.jobId,
    projectId:input.projectId,
    engine:'liveportrait',
    task:'portrait-animation',
    inputAssets:Object.freeze([
      asset(input.source,input.source.mediaType==='image'?'source-image':'source-video'),
      asset(input.drivingVideo,'driving-video'),
    ]),
    parameters:Object.freeze({
      ...input.parameters,
      performanceDirective:compilePerformanceDirective(input.performancePlan),
      performancePlan:input.performancePlan,
      detector:Object.freeze({
        id:input.detector.id,
        modelId:input.detector.modelId,
        sha256:input.detector.sha256,
        licenseEvidenceIds:[...detectorLicenseEvidenceIds],
        commercialUseApproved:true,
      }),
    }),
    evidenceIds:unique([
      ...input.evidenceIds,
      ...(input.performancePlan.evidenceRefs??[]),
      ...detectorLicenseEvidenceIds,
    ]),
    sensitiveData:input.sensitiveData===true,
    allowCloudBurst:input.sensitiveData===true?false:input.allowCloudBurst===true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB',
  });
}

export function buildDirectorMuseTalkLipSyncJob(
  input:DirectorMuseTalkAdapterInput,
):DirectorHumanMediaJobRequest{
  const errors=validateVoiceSyncInput(input.voiceSync);
  if(errors.length)throw new Error(`DIRECTOR_MUSETALK_VOICE_SYNC_INVALID:${errors.join(';')}`);
  if(input.video.mediaType!=='video')throw new Error('DIRECTOR_MUSETALK_VIDEO_REQUIRED');
  if(input.audio.mediaType!=='audio')throw new Error('DIRECTOR_MUSETALK_AUDIO_REQUIRED');
  if(input.voiceSync.videoAssetId!==input.video.assetId||input.voiceSync.audioAssetId!==input.audio.assetId){
    throw new Error('DIRECTOR_MUSETALK_GOVERNED_LINEAGE_MISMATCH');
  }

  const planEvidence:string[]=[];
  if(input.voiceSync.transcriptPlan)planEvidence.push(`transcript-plan:${input.voiceSync.transcriptPlan.id}`);
  if(input.voiceSync.tuningPlan)planEvidence.push(`lip-sync-tuning:${input.voiceSync.tuningPlan.id}`);
  if(input.voiceSync.repairPlan)planEvidence.push(`lip-sync-repair:${input.voiceSync.repairPlan.id}`);

  return assertPrepared({
    schema:'director.human-media-job.v1',
    id:input.jobId,
    projectId:input.projectId,
    engine:'musetalk',
    task:'lip-sync',
    inputAssets:Object.freeze([
      asset(input.video,'source-video'),
      asset(input.audio,'driving-audio'),
    ]),
    parameters:Object.freeze({
      ...input.parameters,
      mode:input.voiceSync.mode,
      tracks:input.voiceSync.tracks,
      ...(input.voiceSync.characterTrackId?{characterTrackId:input.voiceSync.characterTrackId}:{}),
      ...(input.voiceSync.continuityRef?{continuityRef:input.voiceSync.continuityRef}:{}),
      ...(input.voiceSync.transcriptPlan?{transcriptPlan:input.voiceSync.transcriptPlan}:{}),
      ...(input.voiceSync.tuningPlan?{tuningPlan:input.voiceSync.tuningPlan}:{}),
      ...(input.voiceSync.repairPlan?{repairPlan:input.voiceSync.repairPlan}:{}),
      acceptanceAuthority:'WATCH_QC',
    }),
    evidenceIds:unique([...input.evidenceIds,...planEvidence]),
    sensitiveData:input.sensitiveData===true,
    allowCloudBurst:input.sensitiveData===true?false:input.allowCloudBurst===true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB',
  });
}

export function buildDirectorSadTalkerFallbackJob(
  input:DirectorSadTalkerAdapterInput,
):DirectorHumanMediaJobRequest{
  if(input.sourceImage.mediaType!=='image')throw new Error('DIRECTOR_SADTALKER_SOURCE_IMAGE_REQUIRED');
  if(input.audio.mediaType!=='audio')throw new Error('DIRECTOR_SADTALKER_AUDIO_REQUIRED');
  const primaryAttemptEvidenceIds=assertEvidence(
    input.primaryAttemptEvidenceIds,
    'DIRECTOR_SADTALKER_PRIMARY_ATTEMPT_EVIDENCE_REQUIRED',
  );

  return assertPrepared({
    schema:'director.human-media-job.v1',
    id:input.jobId,
    projectId:input.projectId,
    engine:'sadtalker',
    task:'talking-head',
    inputAssets:Object.freeze([
      asset(input.sourceImage,'source-image'),
      asset(input.audio,'driving-audio'),
    ]),
    parameters:Object.freeze({
      ...input.parameters,
      fallbackReason:input.fallbackReason,
      primaryAttemptEvidenceIds:[...primaryAttemptEvidenceIds],
      acceptanceAuthority:'WATCH_QC',
    }),
    evidenceIds:unique([
      ...input.evidenceIds,
      ...primaryAttemptEvidenceIds,
      `sadtalker-fallback:${input.fallbackReason}`,
    ]),
    sensitiveData:input.sensitiveData===true,
    allowCloudBurst:input.sensitiveData===true?false:input.allowCloudBurst===true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB',
  });
}
