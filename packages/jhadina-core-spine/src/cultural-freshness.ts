import type { EvidenceRef } from './types.js';

const VERIFIED_CULTURAL_REFERENCE = Symbol('jhadina.verified-cultural-reference');

export interface VerifiedCulturalReference {
  readonly value: string;
  readonly evidence: readonly EvidenceRef[];
  readonly verifiedAt: string;
  readonly freshnessWindowMs: number;
  readonly [VERIFIED_CULTURAL_REFERENCE]: true;
}

export interface CulturalReferenceVerificationInput {
  reference: string;
  knowledge: readonly EvidenceRef[];
  now: string;
  freshnessWindowMs: number;
}

function lexicalTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function supportsReference(value: string, reference: string): boolean {
  const referenceTokens = [...new Set(lexicalTokens(reference))];
  if (referenceTokens.length === 0) return false;
  const valueTokens = new Set(lexicalTokens(value));
  return referenceTokens.every((token) => valueTokens.has(token));
}

function validEvidence(ref: EvidenceRef): boolean {
  return Boolean(
    ref.id.trim() &&
    ref.source.trim() &&
    ref.summary.trim() &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
}

function assertVerificationWindow(now: string, freshnessWindowMs: number): number {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new RangeError('cultural freshness now must be a valid timestamp');
  }
  if (!Number.isFinite(freshnessWindowMs) || freshnessWindowMs <= 0) {
    throw new RangeError('cultural freshnessWindowMs must be greater than 0');
  }
  return nowMs;
}

function uniqueEvidence(refs: readonly EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const output: EvidenceRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    output.push({ ...ref });
  }
  return output;
}

/**
 * Verifies that a cultural reference is both sourced and fresh enough for the
 * caller's explicit freshness policy. The gate does not search or invent
 * references; production callers must supply Knowledge-layer evidence.
 */
export function verifyFreshCulturalReference(
  input: CulturalReferenceVerificationInput,
): VerifiedCulturalReference | undefined {
  const reference = input.reference.trim();
  if (!reference) return undefined;

  const nowMs = assertVerificationWindow(input.now, input.freshnessWindowMs);
  const supporting = uniqueEvidence(
    input.knowledge
      .filter(validEvidence)
      .filter((ref) => supportsReference(ref.summary, reference))
      .filter((ref) => {
        const observedAt = Date.parse(ref.observedAt);
        const age = nowMs - observedAt;
        return age >= 0 && age <= input.freshnessWindowMs;
      }),
  );

  if (supporting.length === 0) return undefined;

  return {
    value: reference,
    evidence: supporting,
    verifiedAt: input.now,
    freshnessWindowMs: input.freshnessWindowMs,
    [VERIFIED_CULTURAL_REFERENCE]: true,
  };
}

export function isVerifiedCulturalReference(
  value: unknown,
): value is VerifiedCulturalReference {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<VerifiedCulturalReference> & {
    [VERIFIED_CULTURAL_REFERENCE]?: boolean;
  };
  if (candidate[VERIFIED_CULTURAL_REFERENCE] !== true) return false;
  if (typeof candidate.value !== 'string' || !candidate.value.trim()) return false;
  if (typeof candidate.verifiedAt !== 'string' || !Number.isFinite(Date.parse(candidate.verifiedAt))) {
    return false;
  }
  if (
    typeof candidate.freshnessWindowMs !== 'number' ||
    !Number.isFinite(candidate.freshnessWindowMs) ||
    candidate.freshnessWindowMs <= 0
  ) {
    return false;
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) return false;

  return candidate.evidence.every(validEvidence);
}
