import type { ArtifactRuntimeState } from './artifact-extraction-runtime';

/**
 * Read-only compatibility plan for historical JLLM perception operations.
 * Only accepts canonical, owner-resolved jhadina_artifacts rows. Nothing is
 * enqueued, extracted, scanned, uploaded, persisted, or promoted by this API.
 */
export type CanonicalArtifactPlanningInput = {
  verifiedOwnerId: string;
  artifactOwnerId: string;
  artifact: ArtifactRuntimeState;
};
export type CanonicalArtifactPlanningOutcome = {
  artifactId: string;
  state: 'admitted' | 'review_existing_extractor' | 'blocked';
  canonicalSource: 'jhadina_artifacts';
  modality: 'image'|'audio'|'video'|'document'|'text'|'unsupported';
  reason: string;
};
export function planCanonicalArtifactPerception(input: CanonicalArtifactPlanningInput): CanonicalArtifactPlanningOutcome {
  if (!input.verifiedOwnerId.trim() || input.artifactOwnerId !== input.verifiedOwnerId)
    throw new Error('ARTIFACT_PERCEPTION_OWNER_DENIED');
  const a=input.artifact;
  if (!a.id.trim()) throw new Error('ARTIFACT_PERCEPTION_ID_REQUIRED');
  const modality: CanonicalArtifactPlanningOutcome['modality'] =
    a.mimeType.startsWith('image/')?'image':
    a.mimeType.startsWith('audio/')?'audio':
    a.mimeType.startsWith('video/')?'video':
    a.mimeType==='text/plain'?'text':
    ['application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(a.mimeType)?'document':'unsupported';
  const result=(state:CanonicalArtifactPlanningOutcome['state'],reason:string):CanonicalArtifactPlanningOutcome =>
   Object.freeze({ artifactId:a.id,state,reason,modality,canonicalSource:'jhadina_artifacts' });
  if (a.status!=='clean') return result('blocked','clean_scan_required');
  if (modality==='unsupported') return result('blocked','unsupported_media_type');
  if (a.contextReady) return result('admitted','canonical_clean_context_already_ready');
  if (a.extractionStatus==='pending') return result('review_existing_extractor','use_existing_owner_scoped_extraction_review');
  return result('blocked','no_clean_context_representation');
}
