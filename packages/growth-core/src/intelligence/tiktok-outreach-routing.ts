import type { GrowthId, ISODateTime } from "../domain/types.js";

export type TikTokCreatorOutreachRoute =
  | "shop_target_collaboration"
  | "business_message_reply"
  | "comment_to_message"
  | "unsupported";

export interface TikTokCreatorReachability {
  creatorRef: GrowthId;
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
  isTikTokShopAffiliate?: boolean;
  sellerAffiliateCollaborationWrite?: boolean;
  existingBusinessConversation?: boolean;
  businessMessagingSendScope?: boolean;
  commentToMessageEligible?: boolean;
}

export interface TikTokCreatorOutreachRoutingDecision {
  route: TikTokCreatorOutreachRoute;
  creatorRef: GrowthId;
  rationale: readonly string[];
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

/**
 * Routes creator outreach to TikTok-supported surfaces.
 *
 * Proactive TikTok Shop outreach uses Target Collaboration when available.
 * Business Messaging is never treated as a general cold-DM channel.
 */
export function routeTikTokCreatorOutreach(
  input: TikTokCreatorReachability,
): TikTokCreatorOutreachRoutingDecision {
  if (!input.creatorRef.trim()) throw new Error("TIKTOK_CREATOR_REF_REQUIRED");
  if (!input.evidenceRefs.length) throw new Error("TIKTOK_REACHABILITY_EVIDENCE_REQUIRED");
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("TIKTOK_REACHABILITY_OBSERVED_AT_INVALID");
  }

  if (input.isTikTokShopAffiliate && input.sellerAffiliateCollaborationWrite) {
    return decision(input, "shop_target_collaboration", [
      "creator is evidenced as TikTok Shop affiliate",
      "seller has affiliate collaboration write capability",
      "proactive creator acquisition belongs in Target Collaboration",
    ]);
  }

  if (input.existingBusinessConversation && input.businessMessagingSendScope) {
    return decision(input, "business_message_reply", [
      "existing TikTok Business conversation is evidenced",
      "Business Messaging send scope is present",
      "reply is allowed through governed messaging",
    ]);
  }

  if (input.commentToMessageEligible && input.businessMessagingSendScope) {
    return decision(input, "comment_to_message", [
      "supported Comment-to-Message eligibility is evidenced",
      "Business Messaging send scope is present",
    ]);
  }

  return decision(input, "unsupported", [
    "no supported proactive Affiliate collaboration or existing-message route is evidenced",
    "do not substitute browser automation or cold-DM mimicry",
  ]);
}

function decision(
  input: TikTokCreatorReachability,
  route: TikTokCreatorOutreachRoute,
  rationale: string[],
): TikTokCreatorOutreachRoutingDecision {
  return Object.freeze({
    route,
    creatorRef: input.creatorRef,
    rationale: Object.freeze(rationale),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    observedAt: new Date(input.observedAt).toISOString(),
  });
}
