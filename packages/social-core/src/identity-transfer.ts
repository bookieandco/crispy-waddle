
import type { SocialAccountIdentity } from "./identity-projection.js";
import { reconcileSocialIdentityEvidence, sameSocialIdentityScope, type SocialIdentityLearningEvidence } from "./identity-learning.js";

export type TransferableSocialMechanic =
  | "question_open" | "tutorial_structure" | "visual_reveal"
  | "before_after_structure" | "story_arc" | "format_choice"
  | "timing_hypothesis" | "editing_pacing";

export interface SocialLearningTransferCandidate {
  readonly id: string;
  readonly sourceScope: SocialAccountIdentity["scope"];
  readonly targetScope: SocialAccountIdentity["scope"];
  readonly mechanic: TransferableSocialMechanic;
  readonly sourceLearningIds: readonly string[];
  readonly sourceEvidenceRefs: readonly string[];
  readonly observedAt: string;
  readonly status: "CANDIDATE_ONLY";
  readonly abstractionRule: "STRUCTURE_NOT_STYLE_OR_IDENTITY";
  readonly canTransferVoiceOrPersona: false;
  readonly canModifyIdentity: false;
  readonly canPublish: false;
  readonly requiresNewTargetExperiment: true;
}

/**
 * Only abstract, enumerated creative mechanics cross account boundaries.
 * No raw text, person profiles, speaker IDs, audience rows or private memory
 * enter the output. Caller must independently establish owner authorization.
 */
export function proposeCrossAccountSocialLearning(input: {
  source: SocialAccountIdentity;
  target: SocialAccountIdentity;
  sourceEvidence: readonly SocialIdentityLearningEvidence[];
  retiredEvidenceRefs?: readonly string[];
  mechanism: TransferableSocialMechanic;
  id: string;
  observedAt: string;
  verifiedOwnerUserId: string;
}): SocialLearningTransferCandidate {
  if (input.verifiedOwnerUserId !== input.source.scope.ownerUserId
      || input.verifiedOwnerUserId !== input.target.scope.ownerUserId)
    throw new Error("SOCIAL_ID_TRANSFER_OWNER_DENIED");
  if (sameSocialIdentityScope(input.source.scope, input.target.scope))
    throw new Error("SOCIAL_ID_TRANSFER_SAME_ACCOUNT");
  if (input.source.authority !== "EXPRESSION_ONLY" || input.target.authority !== "EXPRESSION_ONLY"
      || input.source.canPublish !== false || input.target.canPublish !== false
      || input.source.canChangeJhadinaPersonality !== false
      || input.target.canChangeJhadinaPersonality !== false)
    throw new Error("SOCIAL_ID_TRANSFER_AUTHORITY_INVALID");
  const kinds: readonly TransferableSocialMechanic[] = [
    "question_open","tutorial_structure","visual_reveal","before_after_structure",
    "story_arc","format_choice","timing_hypothesis","editing_pacing",
  ];
  if (!kinds.includes(input.mechanism)) throw new Error("SOCIAL_ID_TRANSFER_MECHANIC_INVALID");
  if (!/^[-a-zA-Z0-9:_]{1,128}$/.test(input.id))
    throw new Error("SOCIAL_ID_TRANSFER_ID_INVALID");
  const active = reconcileSocialIdentityEvidence({
    current: input.source, evidence: input.sourceEvidence,
    retiredEvidenceRefs: input.retiredEvidenceRefs ?? [], asOf: input.observedAt,
  }).filter(x => x.confidence >= 0.65);
  if (active.length < 3 || new Set(active.map(x=>x.independenceKey)).size < 2
    || new Set(active.map(x=>x.contentId)).size < 2)
    throw new Error("SOCIAL_ID_TRANSFER_PROOF_INSUFFICIENT");
  return Object.freeze({
    id: input.id,
    sourceScope: Object.freeze({...input.source.scope}),
    targetScope: Object.freeze({...input.target.scope}),
    mechanic: input.mechanism,
    sourceLearningIds: Object.freeze([...new Set(active.map(x=>x.id))]),
    sourceEvidenceRefs: Object.freeze([...new Set(active.flatMap(x=>x.evidenceRefs))]),
    observedAt: input.observedAt,
    status: "CANDIDATE_ONLY" as const,
    abstractionRule: "STRUCTURE_NOT_STYLE_OR_IDENTITY" as const,
    canTransferVoiceOrPersona: false as const,
    canModifyIdentity: false as const,
    canPublish: false as const,
    requiresNewTargetExperiment: true as const,
  });
}
