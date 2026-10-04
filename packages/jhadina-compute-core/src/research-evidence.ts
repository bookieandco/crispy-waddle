export type ResearchCoherenceVerdict =
  | 'coherent'
  | 'mixed'
  | 'incoherent'
  | 'insufficient-evidence';

export type ResearchSourceRef = {
  id: string;
  url: string;
  observedAt: string;
  contentHash: string;
  title?: string;
  publisher?: string;
  sourceType?:
    | 'web'
    | 'repository'
    | 'paper'
    | 'video'
    | 'audio'
    | 'dataset'
    | 'document'
    | 'api'
    | 'user-supplied';
};

export type ResearchClaim = {
  id: string;
  statement: string;
  sourceIds: string[];
  confidence: number;
  status: 'supported' | 'contested' | 'unsupported' | 'unknown';
};

export type ResearchEvidenceEnvelope = {
  id: string;
  subsystemOwner: string;
  researchQuestion: string;
  observedAt: string;
  sources: ResearchSourceRef[];
  claims: ResearchClaim[];
  contradictions: string[];
  alternativeExplanations: string[];
  makeItMakeSense: {
    verdict: ResearchCoherenceVerdict;
    rationale: string;
  };
  authority: 'EVIDENCE_ONLY';
};

export type ResearchEvidenceValidation = {
  valid: boolean;
  reasons: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/i;

function validDate(value: string): boolean {
  return Boolean(value.trim()) && Number.isFinite(Date.parse(value));
}

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateResearchEvidence(
  envelope: ResearchEvidenceEnvelope,
): ResearchEvidenceValidation {
  const reasons: string[] = [];

  if (!envelope.id.trim()) reasons.push('RESEARCH_ID_REQUIRED');
  if (!envelope.subsystemOwner.trim()) reasons.push('RESEARCH_SUBSYSTEM_OWNER_REQUIRED');
  if (!envelope.researchQuestion.trim()) reasons.push('RESEARCH_QUESTION_REQUIRED');
  if (!validDate(envelope.observedAt)) reasons.push('RESEARCH_OBSERVED_AT_INVALID');
  if (envelope.authority !== 'EVIDENCE_ONLY') reasons.push('RESEARCH_AUTHORITY_MUST_BE_EVIDENCE_ONLY');
  if (envelope.sources.length === 0) reasons.push('RESEARCH_SOURCE_REQUIRED');

  const sourceIds = new Set<string>();
  for (const source of envelope.sources) {
    if (!source.id.trim()) reasons.push('RESEARCH_SOURCE_ID_REQUIRED');
    if (sourceIds.has(source.id)) reasons.push(`RESEARCH_SOURCE_ID_DUPLICATE:${source.id}`);
    sourceIds.add(source.id);

    if (!validUrl(source.url)) reasons.push(`RESEARCH_SOURCE_URL_INVALID:${source.id}`);
    if (!validDate(source.observedAt)) reasons.push(`RESEARCH_SOURCE_OBSERVED_AT_INVALID:${source.id}`);
    if (!SHA256_PATTERN.test(source.contentHash)) {
      reasons.push(`RESEARCH_SOURCE_HASH_INVALID:${source.id}`);
    }
  }

  const claimIds = new Set<string>();
  for (const claim of envelope.claims) {
    if (!claim.id.trim()) reasons.push('RESEARCH_CLAIM_ID_REQUIRED');
    if (claimIds.has(claim.id)) reasons.push(`RESEARCH_CLAIM_ID_DUPLICATE:${claim.id}`);
    claimIds.add(claim.id);

    if (!claim.statement.trim()) reasons.push(`RESEARCH_CLAIM_STATEMENT_REQUIRED:${claim.id}`);
    if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      reasons.push(`RESEARCH_CLAIM_CONFIDENCE_INVALID:${claim.id}`);
    }
    if (claim.sourceIds.length === 0 && claim.status === 'supported') {
      reasons.push(`RESEARCH_SUPPORTED_CLAIM_SOURCE_REQUIRED:${claim.id}`);
    }
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        reasons.push(`RESEARCH_CLAIM_SOURCE_UNKNOWN:${claim.id}:${sourceId}`);
      }
    }
  }

  if (!envelope.makeItMakeSense.rationale.trim()) {
    reasons.push('RESEARCH_MAKE_IT_MAKE_SENSE_RATIONALE_REQUIRED');
  }

  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export function assertResearchEvidence(envelope: ResearchEvidenceEnvelope): void {
  const result = validateResearchEvidence(envelope);
  if (!result.valid) {
    throw new Error(`RESEARCH_EVIDENCE_INVALID:${result.reasons.join(',')}`);
  }
}
