
import { type SocialAccountIdentity, type SocialIdentityRevision } from "./identity-projection.js";
import { sameSocialIdentityScope } from "./identity-learning.js";

export interface SocialIdentityDriftAssessment {
  readonly proposalId: string;
  readonly identityVersion: number;
  readonly severity: "minor" | "material" | "major";
  readonly removedTraits: readonly string[];
  readonly addedTraits: readonly string[];
  readonly pointOfViewChanged: boolean;
  readonly reasonCodes: readonly string[];
  readonly authority: "REVIEW_ONLY";
  readonly requiresHumanApproval: true;
  readonly canAutoApply: false;
}

/** A drift receipt is review guidance, never automatic personality evolution. */
export function assessSocialIdentityDrift(input: {
  current: SocialAccountIdentity;
  proposed: SocialIdentityRevision;
}): SocialIdentityDriftAssessment {
  const {current, proposed} = input;
  if (!sameSocialIdentityScope(current.scope, proposed.scope))
    throw new Error("SOCIAL_ID_DRIFT_SCOPE_MISMATCH");
  if (current.version !== proposed.expectedVersion) throw new Error("SOCIAL_ID_DRIFT_STALE_REVISION");
  if (proposed.authority !== "REVIEW_ONLY" || proposed.state !== "PROPOSED"
      || proposed.requiresVerifiedOwnerApproval !== true)
    throw new Error("SOCIAL_ID_DRIFT_INVALID_PROPOSAL");
  if (current.authority !== "EXPRESSION_ONLY" || current.canPublish !== false
      || current.canChangeJhadinaPersonality !== false)
    throw new Error("SOCIAL_ID_DRIFT_IDENTITY_AUTHORITY_INVALID");
  const before = new Set(current.toneTraits.map(x => x.trim().toLowerCase()));
  const after = new Set(proposed.proposedToneTraits.map(x => x.trim().toLowerCase()));
  const removedTraits = [...before].filter(x => !after.has(x));
  const addedTraits = [...after].filter(x => !before.has(x));
  const pointOfViewChanged = current.pointOfView.trim() !== proposed.proposedPointOfView.trim();
  const reasonCodes: string[] = [];
  if (removedTraits.length) reasonCodes.push("IDENTITY_TRAIT_REMOVAL_REVIEW");
  if (addedTraits.length) reasonCodes.push("IDENTITY_NEW_TRAITS_REVIEW");
  if (pointOfViewChanged) reasonCodes.push("IDENTITY_POINT_OF_VIEW_REVIEW");
  const severity: SocialIdentityDriftAssessment["severity"] =
    (removedTraits.length >= 2 || (removedTraits.length >= 1 && pointOfViewChanged))
      ? "major" : pointOfViewChanged || removedTraits.length || addedTraits.length >= 2
        ? "material" : "minor";
  return Object.freeze({
    proposalId: proposed.id, identityVersion: current.version, severity,
    removedTraits: Object.freeze(removedTraits),
    addedTraits: Object.freeze(addedTraits), pointOfViewChanged,
    reasonCodes: Object.freeze(reasonCodes),
    authority: "REVIEW_ONLY" as const,
    requiresHumanApproval: true as const,
    canAutoApply: false as const,
  });
}
