export type EmotionEvidenceStatus = 'observed' | 'fallback' | 'inconclusive';

export interface SceneEmotionEvidence {
  id: string;
  projectId: string;
  sceneId: string;
  label: string;
  confidence: number;
  provider: string;
  modelId?: string;
  status: EmotionEvidenceStatus;
  evidenceRefs: readonly string[];
  limitations: readonly string[];
  observedAt: string;
}

export interface EmotionStoryboardDecision {
  usableAsAdvisoryEvidence: boolean;
  reasons: readonly string[];
  authority: 'ADVISORY_ONLY';
}

/**
 * Emotion inference may inform a storyboard proposal, but never becomes scene
 * truth by itself. Fallback labels and inconclusive outputs are explicitly
 * prevented from silently driving generation.
 */
export function evaluateSceneEmotionEvidence(
  evidence: SceneEmotionEvidence,
  minimumConfidence = 0.6,
): EmotionStoryboardDecision {
  const reasons: string[] = [];
  if (!evidence.label.trim()) reasons.push('DIRECTOR_EMOTION_LABEL_REQUIRED');
  if (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1) {
    reasons.push('DIRECTOR_EMOTION_CONFIDENCE_INVALID');
  }
  if (evidence.status !== 'observed') reasons.push('DIRECTOR_EMOTION_NOT_OBSERVED');
  if (evidence.confidence < minimumConfidence) reasons.push('DIRECTOR_EMOTION_CONFIDENCE_LOW');
  if (!evidence.evidenceRefs.length) reasons.push('DIRECTOR_EMOTION_EVIDENCE_REQUIRED');

  return Object.freeze({
    usableAsAdvisoryEvidence: reasons.length === 0,
    reasons: Object.freeze(reasons),
    authority: 'ADVISORY_ONLY',
  });
}
