export type CanonicalVoiceSubjectType = 'assistant' | 'character' | 'narrator' | 'person';
export type CanonicalVoiceIdentityStatus = 'candidate' | 'approved' | 'retired';
export type CanonicalVoiceIdentitySource = 'owned-recording' | 'consented-clone' | 'designed' | 'preset';

export interface CanonicalVoiceSubject {
  type: CanonicalVoiceSubjectType;
  id: string;
}

export interface CanonicalVoiceReferenceSample {
  id: string;
  assetId: string;
  sha256: string;
  language: string;
  transcript?: string;
  durationSeconds: number;
  rightsRef: string;
  qualityEvidenceIds: readonly string[];
}

export interface CanonicalVoiceProviderBinding {
  id: string;
  provider: string;
  modelId: string;
  providerVoiceRef?: string;
  referenceSampleIds: readonly string[];
  supportedLanguages: readonly string[];
  sampleRateHz?: number;
  provenanceRefs: readonly string[];
}

export interface CanonicalVoiceLanguageVariant {
  id: string;
  voiceIdentityId: string;
  language: string;
  locale?: string;
  pronunciationLexiconRef?: string;
  accentPolicy: 'preserve-identity' | 'native-target' | 'directed';
  deliveryStyle?: string;
  providerBindingIds: readonly string[];
}

export interface CanonicalVoiceIdentity {
  id: string;
  version: number;
  subject: CanonicalVoiceSubject;
  displayName: string;
  source: CanonicalVoiceIdentitySource;
  consentRef?: string;
  primaryLanguage: string;
  status: CanonicalVoiceIdentityStatus;
  referenceSamples: readonly CanonicalVoiceReferenceSample[];
  providerBindings: readonly CanonicalVoiceProviderBinding[];
  languageVariants: readonly CanonicalVoiceLanguageVariant[];
  defaultVariantId?: string;
  speakerFingerprintRefs: readonly string[];
  minimumSpeakerSimilarity: number;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SpeakerFingerprintReceipt {
  id: string;
  subject: CanonicalVoiceSubject;
  sourceAssetId: string;
  sourceSha256: string;
  normalizedAudioSha256: string;
  modelId: string;
  modelRevision: string;
  embeddingDimensions: number;
  embeddingSha256: string;
  fingerprintRef: string;
  quantization: string;
  sampleRateHz: number;
  durationSeconds: number;
  qualityClaim: false;
  evidenceIds: readonly string[];
  createdAt: string;
}

export interface VoiceIdentityApprovalReceipt {
  id: string;
  voiceIdentityId: string;
  subject: CanonicalVoiceSubject;
  candidateAssetId: string;
  candidateSha256: string;
  speakerFingerprintReceiptId: string;
  speakerFingerprintRef: string;
  minimumSpeakerSimilarity: number;
  provider: string;
  modelId: string;
  providerVoiceRef?: string;
  authority: 'VOICE_EXPLICIT_APPROVAL' | 'DIRECTOR_EXPLICIT_VOICE_APPROVAL';
  evidenceIds: readonly string[];
  approvedBy: string;
  approvedAt: string;
}

export interface GeneratedCanonicalVoiceArtifact {
  voiceIdentityId: string;
  providerBindingId: string;
  audioAssetId: string;
  audioSha256: string;
  language: string;
  sampleRateHz: number;
  durationSeconds: number;
  speakerSimilarity?: number;
  intelligibilityScore?: number;
  clippingDetected?: boolean;
  evidenceIds: readonly string[];
}

export interface CanonicalVoiceQcPolicy {
  minimumSpeakerSimilarity: number;
  minimumIntelligibility: number;
}

export interface CanonicalVoiceDecision {
  admissible: boolean;
  reasons: readonly string[];
}

const SHA256=/^[a-f0-9]{64}$/i;

function validDate(value: string | undefined): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}
function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}
function sameSubject(a: CanonicalVoiceSubject, b: CanonicalVoiceSubject): boolean {
  return a.type === b.type && a.id === b.id;
}

export function validateCanonicalVoiceIdentity(identity: CanonicalVoiceIdentity): readonly string[] {
  const reasons: string[]=[];
  if(!nonEmpty(identity.id)||!Number.isInteger(identity.version)||identity.version<=0){
    reasons.push('VOICE_IDENTITY_ID_VERSION_REQUIRED');
  }
  if(!nonEmpty(identity.subject.id)) reasons.push('VOICE_IDENTITY_SUBJECT_REQUIRED');
  if(!nonEmpty(identity.displayName)||!nonEmpty(identity.primaryLanguage)) reasons.push('VOICE_IDENTITY_METADATA_REQUIRED');
  if(!Number.isFinite(identity.minimumSpeakerSimilarity)||identity.minimumSpeakerSimilarity<=0||identity.minimumSpeakerSimilarity>1){
    reasons.push('VOICE_IDENTITY_SIMILARITY_FLOOR_INVALID');
  }
  if(identity.source==='consented-clone'&&!nonEmpty(identity.consentRef)) reasons.push('VOICE_IDENTITY_CONSENT_REQUIRED');

  const sampleIds=new Set(identity.referenceSamples.map(sample=>sample.id));
  for(const sample of identity.referenceSamples){
    if(!nonEmpty(sample.id)||!nonEmpty(sample.assetId)||!SHA256.test(sample.sha256)||!nonEmpty(sample.rightsRef)){
      reasons.push(`VOICE_REFERENCE_INVALID:${sample.id || 'unknown'}`);
    }
    if(!Number.isFinite(sample.durationSeconds)||sample.durationSeconds<=0){
      reasons.push(`VOICE_REFERENCE_DURATION_INVALID:${sample.id || 'unknown'}`);
    }
  }
  for(const binding of identity.providerBindings){
    if(!nonEmpty(binding.id)||!nonEmpty(binding.provider)||!nonEmpty(binding.modelId)||!binding.provenanceRefs.length){
      reasons.push(`VOICE_PROVIDER_BINDING_INVALID:${binding.id || 'unknown'}`);
    }
    if(binding.referenceSampleIds.some(id=>!sampleIds.has(id))){
      reasons.push(`VOICE_PROVIDER_REFERENCE_UNKNOWN:${binding.id || 'unknown'}`);
    }
  }
  for(const variant of identity.languageVariants){
    if(variant.voiceIdentityId!==identity.id) reasons.push(`VOICE_VARIANT_IDENTITY_MISMATCH:${variant.id}`);
    if(!variant.providerBindingIds.every(id=>identity.providerBindings.some(binding=>binding.id===id))){
      reasons.push(`VOICE_VARIANT_PROVIDER_UNKNOWN:${variant.id}`);
    }
  }

  if(identity.status==='approved'){
    if(!identity.referenceSamples.length) reasons.push('VOICE_APPROVED_REFERENCE_REQUIRED');
    if(!identity.providerBindings.length) reasons.push('VOICE_APPROVED_PROVIDER_REQUIRED');
    if(!identity.speakerFingerprintRefs.length) reasons.push('VOICE_APPROVED_FINGERPRINT_REQUIRED');
    if(!identity.defaultVariantId||!identity.languageVariants.some(variant=>variant.id===identity.defaultVariantId)){
      reasons.push('VOICE_APPROVED_DEFAULT_VARIANT_REQUIRED');
    }
    if(!validDate(identity.approvedAt)||!nonEmpty(identity.approvedBy)){
      reasons.push('VOICE_APPROVED_AUTHORITY_REQUIRED');
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

export function validateSpeakerFingerprintReceipt(receipt: SpeakerFingerprintReceipt): readonly string[] {
  const reasons:string[]=[];
  if(!nonEmpty(receipt.id)||!nonEmpty(receipt.subject.id)) reasons.push('VOICE_FINGERPRINT_IDENTITY_REQUIRED');
  if(!nonEmpty(receipt.sourceAssetId)||!SHA256.test(receipt.sourceSha256)||!SHA256.test(receipt.normalizedAudioSha256)){
    reasons.push('VOICE_FINGERPRINT_SOURCE_INVALID');
  }
  if(!nonEmpty(receipt.modelId)||!nonEmpty(receipt.modelRevision)||receipt.embeddingDimensions<=0||!Number.isInteger(receipt.embeddingDimensions)){
    reasons.push('VOICE_FINGERPRINT_MODEL_INVALID');
  }
  if(!SHA256.test(receipt.embeddingSha256)||!nonEmpty(receipt.fingerprintRef)||!nonEmpty(receipt.quantization)){
    reasons.push('VOICE_FINGERPRINT_DIGEST_INVALID');
  }
  if(receipt.sampleRateHz<8000||!Number.isFinite(receipt.durationSeconds)||receipt.durationSeconds<=0){
    reasons.push('VOICE_FINGERPRINT_AUDIO_INVALID');
  }
  if(receipt.qualityClaim!==false) reasons.push('VOICE_FINGERPRINT_MUST_NOT_CLAIM_QUALITY');
  if(!validDate(receipt.createdAt)) reasons.push('VOICE_FINGERPRINT_TIMESTAMP_INVALID');
  return Object.freeze([...new Set(reasons)]);
}

export function validateVoiceApprovalReceipt(
  identity: CanonicalVoiceIdentity,
  receipt: VoiceIdentityApprovalReceipt,
  fingerprint: SpeakerFingerprintReceipt,
): readonly string[] {
  const reasons:string[]=[];
  if(receipt.voiceIdentityId!==identity.id) reasons.push('VOICE_APPROVAL_IDENTITY_MISMATCH');
  if(!sameSubject(receipt.subject,identity.subject)||!sameSubject(fingerprint.subject,identity.subject)){
    reasons.push('VOICE_APPROVAL_SUBJECT_MISMATCH');
  }
  if(receipt.speakerFingerprintReceiptId!==fingerprint.id||receipt.speakerFingerprintRef!==fingerprint.fingerprintRef){
    reasons.push('VOICE_APPROVAL_FINGERPRINT_MISMATCH');
  }
  if(receipt.candidateAssetId!==fingerprint.sourceAssetId||receipt.candidateSha256!==fingerprint.sourceSha256){
    reasons.push('VOICE_APPROVAL_CANDIDATE_MISMATCH');
  }
  if(!identity.referenceSamples.some(sample=>sample.assetId===receipt.candidateAssetId&&sample.sha256.toLowerCase()===receipt.candidateSha256.toLowerCase())){
    reasons.push('VOICE_APPROVAL_REFERENCE_NOT_ADMITTED');
  }
  if(Number(receipt.minimumSpeakerSimilarity)!==Number(identity.minimumSpeakerSimilarity)){
    reasons.push('VOICE_APPROVAL_SIMILARITY_FLOOR_MISMATCH');
  }
  const binding=identity.providerBindings.find(item=>
    item.provider===receipt.provider&&
    item.modelId===receipt.modelId&&
    (item.providerVoiceRef??'')===(receipt.providerVoiceRef??'')
  );
  if(!binding) reasons.push('VOICE_APPROVAL_PROVIDER_PROVENANCE_MISMATCH');
  if(!nonEmpty(receipt.approvedBy)||!validDate(receipt.approvedAt)) reasons.push('VOICE_APPROVAL_AUTHORITY_REQUIRED');
  if(!['VOICE_EXPLICIT_APPROVAL','DIRECTOR_EXPLICIT_VOICE_APPROVAL'].includes(receipt.authority)){
    reasons.push('VOICE_APPROVAL_AUTHORITY_INVALID');
  }
  reasons.push(...validateSpeakerFingerprintReceipt(fingerprint));
  return Object.freeze([...new Set(reasons)]);
}

export function admitCanonicalVoiceIdentity(
  identity: CanonicalVoiceIdentity,
  receipt: VoiceIdentityApprovalReceipt,
  fingerprint: SpeakerFingerprintReceipt,
): CanonicalVoiceIdentity {
  const baseReasons=validateCanonicalVoiceIdentity({...identity,status:'candidate'});
  const approvalReasons=validateVoiceApprovalReceipt(identity,receipt,fingerprint);
  const reasons=[...baseReasons,...approvalReasons];
  if(reasons.length) throw new Error(`VOICE_IDENTITY_ADMISSION_FAILED:${[...new Set(reasons)].join(';')}`);

  return Object.freeze({
    ...identity,
    status:'approved' as const,
    speakerFingerprintRefs:Object.freeze([...new Set([...identity.speakerFingerprintRefs,fingerprint.fingerprintRef])]),
    approvedAt:receipt.approvedAt,
    approvedBy:receipt.approvedBy,
  });
}

export function validateGeneratedCanonicalVoice(
  identity: CanonicalVoiceIdentity,
  artifact: GeneratedCanonicalVoiceArtifact,
  policy: CanonicalVoiceQcPolicy,
): CanonicalVoiceDecision {
  const reasons:string[]=[];
  reasons.push(...validateCanonicalVoiceIdentity(identity));
  if(identity.status!=='approved') reasons.push('VOICE_IDENTITY_NOT_APPROVED');
  if(artifact.voiceIdentityId!==identity.id) reasons.push('VOICE_ARTIFACT_IDENTITY_MISMATCH');
  if(!identity.providerBindings.some(binding=>binding.id===artifact.providerBindingId)){
    reasons.push('VOICE_PROVIDER_BINDING_NOT_AUTHORIZED');
  }
  if(!nonEmpty(artifact.audioAssetId)||!SHA256.test(artifact.audioSha256)||!artifact.evidenceIds.length){
    reasons.push('VOICE_ARTIFACT_PROVENANCE_REQUIRED');
  }
  if(!Number.isInteger(artifact.sampleRateHz)||artifact.sampleRateHz<8000||!Number.isFinite(artifact.durationSeconds)||artifact.durationSeconds<=0){
    reasons.push('VOICE_ARTIFACT_AUDIO_INVALID');
  }
  if(artifact.clippingDetected) reasons.push('VOICE_ARTIFACT_CLIPPING_DETECTED');
  const floor=Math.max(identity.minimumSpeakerSimilarity,policy.minimumSpeakerSimilarity);
  if(artifact.speakerSimilarity===undefined||artifact.speakerSimilarity<floor){
    reasons.push('VOICE_ARTIFACT_SPEAKER_SIMILARITY_LOW');
  }
  if(artifact.intelligibilityScore===undefined||artifact.intelligibilityScore<policy.minimumIntelligibility){
    reasons.push('VOICE_ARTIFACT_INTELLIGIBILITY_LOW');
  }
  return Object.freeze({admissible:reasons.length===0,reasons:Object.freeze([...new Set(reasons)])});
}
