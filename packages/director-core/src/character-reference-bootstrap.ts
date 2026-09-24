export type CharacterReferenceView =
  | 'unknown'
  | 'front'
  | 'profile-left'
  | 'profile-right'
  | 'three-quarter-left'
  | 'three-quarter-right'
  | 'full-body'
  | 'close-up';

export interface CharacterReferenceUpload {
  id: string;
  assetId: string;
  sha256: string;
  width: number;
  height: number;
  view: CharacterReferenceView;
  rightsRef: string;
  consentRef?: string;
  evidenceIds: readonly string[];
}

export type CharacterBootstrapStage =
  | 'admit-reference'
  | 'normalize-canvas'
  | 'neutral-anchor'
  | 'multi-angle'
  | 'expression-sheet'
  | 'appearance-variants'
  | 'motion-probes'
  | 'qa'
  | 'lock';

export interface CharacterReferenceBootstrapRequest {
  id: string;
  projectId: string;
  characterId: string;
  displayName: string;
  archetype: 'human' | 'cartoon' | 'puppet' | 'creature';
  uploads: readonly CharacterReferenceUpload[];
  requestedAppearanceLabels?: readonly string[];
  buildMotionProbes?: boolean;
  commercialUse: boolean;
}

export interface CharacterReferenceBootstrapPlan {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  canonicalUploadId: string;
  stages: readonly CharacterBootstrapStage[];
  targetViews: readonly CharacterReferenceView[];
  authority: 'PROPOSAL_ONLY';
}

export interface CharacterDerivedReferenceCandidate {
  id: string;
  projectId: string;
  characterId: string;
  parentReferenceAssetIds: readonly string[];
  assetId: string;
  sha256: string;
  kind: 'neutral-anchor' | 'angle' | 'expression' | 'appearance' | 'motion-frame';
  view?: CharacterReferenceView;
  label?: string;
  identityScore: number;
  styleScore: number;
  anatomyScore: number;
  qualityScore: number;
  evidenceIds: readonly string[];
  generationAttemptId: string;
}

export interface CharacterDerivedReferenceDecision {
  admissible: boolean;
  score: number;
  reasons: readonly string[];
}

export function planCharacterReferenceBootstrap(
  request: CharacterReferenceBootstrapRequest,
): CharacterReferenceBootstrapPlan {
  const errors = validateCharacterReferenceBootstrapRequest(request);
  if (errors.length) throw new Error(errors.join(';'));

  const canonical = [...request.uploads].sort((a,b) => {
    const rank = (view: CharacterReferenceView) =>
      view === 'close-up' ? 0 :
      view === 'front' ? 1 :
      view === 'three-quarter-left' || view === 'three-quarter-right' ? 2 :
      view === 'profile-left' || view === 'profile-right' ? 3 :
      view === 'full-body' ? 4 : 5;
    return rank(a.view)-rank(b.view) || b.width*b.height-a.width*a.height || a.id.localeCompare(b.id);
  })[0];

  const stages: CharacterBootstrapStage[] = [
    'admit-reference',
    'normalize-canvas',
    'neutral-anchor',
    'multi-angle',
    'expression-sheet',
    ...(request.requestedAppearanceLabels?.length ? ['appearance-variants' as const] : []),
    ...(request.buildMotionProbes !== false ? ['motion-probes' as const] : []),
    'qa',
    'lock',
  ];

  const targetViews: readonly CharacterReferenceView[] = Object.freeze([
    'front',
    'profile-left',
    'profile-right',
    'three-quarter-left',
    'three-quarter-right',
    'full-body',
    'close-up',
  ]);

  return Object.freeze({
    id: request.id,
    projectId: request.projectId,
    characterId: request.characterId,
    continuityRef: `character:${request.characterId}:v1`,
    canonicalUploadId: canonical.id,
    stages: Object.freeze(stages),
    targetViews,
    authority: 'PROPOSAL_ONLY',
  });
}

export function validateCharacterReferenceBootstrapRequest(
  request: CharacterReferenceBootstrapRequest,
): readonly string[] {
  const reasons: string[] = [];
  if (!request.id.trim() || !request.projectId.trim() || !request.characterId.trim() || !request.displayName.trim()) {
    reasons.push('DIRECTOR_CHARACTER_BOOTSTRAP_IDENTITY_REQUIRED');
  }
  if (!request.uploads.length) reasons.push('DIRECTOR_CHARACTER_REFERENCE_REQUIRED');
  const hashes = new Set<string>();
  for (const upload of request.uploads) {
    if (!upload.assetId.trim() || !upload.sha256.trim()) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_ASSET_REQUIRED:${upload.id}`);
    if (!upload.rightsRef.trim()) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_RIGHTS_REQUIRED:${upload.id}`);
    if (!Number.isInteger(upload.width) || !Number.isInteger(upload.height) || upload.width < 128 || upload.height < 128) {
      reasons.push(`DIRECTOR_CHARACTER_REFERENCE_DIMENSIONS_INVALID:${upload.id}`);
    }
    if (!upload.evidenceIds.length) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_EVIDENCE_REQUIRED:${upload.id}`);
    if (hashes.has(upload.sha256)) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_DUPLICATE:${upload.id}`);
    hashes.add(upload.sha256);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function evaluateCharacterDerivedReference(
  candidate: CharacterDerivedReferenceCandidate,
  policy: {
    minimumIdentityScore: number;
    minimumStyleScore: number;
    minimumAnatomyScore: number;
    minimumQualityScore: number;
  },
): CharacterDerivedReferenceDecision {
  const reasons: string[] = [];
  const metrics: Array<[string, number, number]> = [
    ['IDENTITY', candidate.identityScore, policy.minimumIdentityScore],
    ['STYLE', candidate.styleScore, policy.minimumStyleScore],
    ['ANATOMY', candidate.anatomyScore, policy.minimumAnatomyScore],
    ['QUALITY', candidate.qualityScore, policy.minimumQualityScore],
  ];
  for (const [name,value,minimum] of metrics) {
    if (!Number.isFinite(value) || value < 0 || value > 1) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_${name}_INVALID`);
    else if (value < minimum) reasons.push(`DIRECTOR_CHARACTER_REFERENCE_${name}_LOW`);
  }
  if (!candidate.parentReferenceAssetIds.length) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PARENT_REQUIRED');
  if (!candidate.evidenceIds.length) reasons.push('DIRECTOR_CHARACTER_REFERENCE_QA_EVIDENCE_REQUIRED');
  if (!candidate.generationAttemptId.trim()) reasons.push('DIRECTOR_CHARACTER_REFERENCE_ATTEMPT_REQUIRED');

  const score =
    candidate.identityScore * 0.5 +
    candidate.styleScore * 0.15 +
    candidate.anatomyScore * 0.2 +
    candidate.qualityScore * 0.15;

  return Object.freeze({ admissible: reasons.length === 0, score, reasons: Object.freeze(reasons) });
}

export function chooseBestCharacterReference(
  candidates: readonly CharacterDerivedReferenceCandidate[],
  policy: {
    minimumIdentityScore: number;
    minimumStyleScore: number;
    minimumAnatomyScore: number;
    minimumQualityScore: number;
  },
): CharacterDerivedReferenceCandidate | undefined {
  return [...candidates]
    .map((candidate) => ({ candidate, decision: evaluateCharacterDerivedReference(candidate, policy) }))
    .filter(({decision}) => decision.admissible)
    .sort((a,b) => b.decision.score-a.decision.score || a.candidate.id.localeCompare(b.candidate.id))[0]?.candidate;
}
