
import type { SocialAccount } from "./types.js";
import type { SocialObservation } from "./observations.js";
import { assertSocialIdentityScope, proposeSocialIdentityRevision, type SocialAccountIdentity, type SocialIdentityRevision, type SocialIdentityScope } from "./identity-projection.js";

/**
 * Owner/account-bound performance evidence. This is an observation, not identity
 * authority, durable Memory, a right to publish, or a claim of causal lift.
 */
export interface SocialIdentityLearningEvidence {
  readonly schemaVersion: "jhadina.social.identity-learning.v1";
  readonly id: string;
  readonly scope: Readonly<SocialIdentityScope>;
  readonly contentId: string;
  readonly independenceKey: string;
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly source: string;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly authority: "OBSERVATION_ONLY";
  readonly canModifyIdentity: false;
}

function timestamp(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("SOCIAL_ID_LEARNING_DATE_INVALID");
  return ms;
}
function requireNonBlank(value: string | undefined, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("SOCIAL_ID_LEARNING_REQUIRED:" + name);
  return value.trim();
}
export function sameSocialIdentityScope(a: SocialIdentityScope, b: SocialIdentityScope): boolean {
  return a.ownerUserId === b.ownerUserId && a.brandId === b.brandId
    && a.accountId === b.accountId && a.platform === b.platform
    && a.provider === b.provider && a.providerProfileId === b.providerProfileId;
}
function uniqueEvidence(values: readonly string[]): readonly string[] {
  if (!values.length || values.some(value => !value.trim()))
    throw new Error("SOCIAL_ID_LEARNING_EVIDENCE_REQUIRED");
  return Object.freeze([...new Set(values.map(value => value.trim()))]);
}

/**
 * verifiedContentIds MUST come from an authenticated, owner-scoped repository
 * lookup that joins approved ContentProject/outbox/provider records. A browser
 * cannot be trusted to supply this list. This pure validator cannot attest it.
 */
export function admitSocialIdentityPerformance(input: {
  identity: SocialAccountIdentity;
  account: SocialAccount;
  observation: SocialObservation;
  verifiedContentIds: readonly string[];
  asOf: string;
  maxAgeDays?: number;
}): SocialIdentityLearningEvidence {
  const {identity, account, observation} = input;
  assertSocialIdentityScope(identity.scope, account);
  if (account.status !== "connected") throw new Error("SOCIAL_ID_LEARNING_ACCOUNT_DISCONNECTED");
  if (identity.version < 1 || identity.authority !== "EXPRESSION_ONLY"
      || identity.canPublish !== false || identity.canChangeJhadinaPersonality !== false)
    throw new Error("SOCIAL_ID_LEARNING_IDENTITY_INVALID");
  if (observation.kind !== "performance") throw new Error("SOCIAL_ID_LEARNING_NOT_PERFORMANCE");
  if (observation.userId !== identity.scope.ownerUserId
      || observation.brand !== identity.scope.brandId
      || observation.accountId !== identity.scope.accountId
      || observation.platform !== identity.scope.platform
      || observation.provider !== identity.scope.provider
      || observation.providerProfileId !== identity.scope.providerProfileId)
    throw new Error("SOCIAL_ID_LEARNING_OBSERVATION_SCOPE_MISMATCH");
  const contentId = requireNonBlank(observation.contentId, "contentId");
  if (!input.verifiedContentIds.includes(contentId))
    throw new Error("SOCIAL_ID_LEARNING_CONTENT_NOT_VERIFIED");
  const source = requireNonBlank(observation.source, "source");
  requireNonBlank(observation.id, "observationId");
  const observed = timestamp(observation.observedAt), now = timestamp(input.asOf);
  const maxAgeDays = input.maxAgeDays ?? 90;
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365)
    throw new Error("SOCIAL_ID_LEARNING_AGE_POLICY_INVALID");
  if (observed > now || observed < now - maxAgeDays * 86_400_000)
    throw new Error("SOCIAL_ID_LEARNING_STALE_OR_FUTURE");
  if (!observation.metrics || !Object.keys(observation.metrics).length)
    throw new Error("SOCIAL_ID_LEARNING_METRICS_REQUIRED");
  for (const metric of Object.values(observation.metrics)) {
    if (!Number.isFinite(metric) || metric < 0)
      throw new Error("SOCIAL_ID_LEARNING_METRIC_INVALID");
  }
  const rawConfidence = observation.attributes?.confidence;
  const confidence = rawConfidence === undefined ? 0.5 : rawConfidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)
      || confidence < 0 || confidence > 1)
    throw new Error("SOCIAL_ID_LEARNING_CONFIDENCE_INVALID");
  const independenceKey = observation.outboxId?.trim()
    || observation.proposalId?.trim() || contentId;
  return Object.freeze({
    schemaVersion: "jhadina.social.identity-learning.v1" as const,
    id: "social-identity-learning:" + observation.id,
    scope: Object.freeze({...identity.scope}),
    contentId,
    independenceKey,
    observedAt: observation.observedAt,
    expiresAt: new Date(observed + maxAgeDays * 86_400_000).toISOString(),
    source,
    confidence,
    evidenceRefs: uniqueEvidence(observation.evidence),
    metrics: Object.freeze({...observation.metrics}),
    authority: "OBSERVATION_ONLY" as const,
    canModifyIdentity: false as const,
  });
}

/** Revoke any observation supported by retired evidence; never rewrite it silently. */
export function reconcileSocialIdentityEvidence(input: {
  current: SocialAccountIdentity;
  evidence: readonly SocialIdentityLearningEvidence[];
  retiredEvidenceRefs: readonly string[];
  asOf: string;
}): readonly SocialIdentityLearningEvidence[] {
  const now = timestamp(input.asOf);
  const retired = new Set(input.retiredEvidenceRefs);
  const seen = new Set<string>();
  return Object.freeze(input.evidence.filter(item => {
    if (!sameSocialIdentityScope(item.scope, input.current.scope))
      throw new Error("SOCIAL_ID_LEARNING_CROSS_SCOPE");
    if (item.authority !== "OBSERVATION_ONLY" || item.canModifyIdentity !== false)
      throw new Error("SOCIAL_ID_LEARNING_AUTHORITY_INVALID");
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return timestamp(item.observedAt) <= now
      && timestamp(item.expiresAt) > now
      && !item.evidenceRefs.some(ref => retired.has(ref));
  }));
}

/**
 * Identity change requires >=3 qualified observations from >=2 distinct
 * source actions/posts. The result remains an INERT proposal; authorization,
 * real independent source verification and persistence are not performed here.
 */
export function proposeEvidenceBackedSocialIdentityChange(input: {
  current: SocialAccountIdentity;
  evidence: readonly SocialIdentityLearningEvidence[];
  id: string;
  proposedToneTraits: readonly string[];
  proposedPointOfView: string;
  rationale: string;
  proposedAt: string;
  retiredEvidenceRefs?: readonly string[];
}): SocialIdentityRevision {
  const active = reconcileSocialIdentityEvidence({
    current: input.current, evidence: input.evidence,
    retiredEvidenceRefs: input.retiredEvidenceRefs ?? [], asOf: input.proposedAt,
  }).filter(item => item.confidence >= 0.65);
  if (active.length < 3 || new Set(active.map(item => item.independenceKey)).size < 2
      || new Set(active.map(item => item.contentId)).size < 2)
    throw new Error("SOCIAL_ID_LEARNING_INDEPENDENT_OBSERVATIONS_REQUIRED");
  return proposeSocialIdentityRevision({
    current: input.current, id: input.id,
    proposedToneTraits: input.proposedToneTraits,
    proposedPointOfView: input.proposedPointOfView,
    independentEvidenceRefs: [...new Set(active.flatMap(item => item.evidenceRefs))],
    rationale: input.rationale, proposedAt: input.proposedAt,
  });
}
