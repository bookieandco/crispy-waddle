import {
  admitSocialIdentityPerformance,
  assertSocialIdentityScope,
  type SocialAccount,
  type SocialAccountIdentity,
  type SocialObservation,
} from "@jhadina/social-core";
import {
  buildScopedSocialNicheProfile,
  type ScopedSocialNicheObservation,
  type ScopedSocialNicheProfile,
} from "@jhadina/growth-core";

export interface OwnerAttestedSocialContent {
  /** Server-looked-up approved content id. This pure function cannot authenticate it. */
  readonly contentId: string;
  readonly nicheKey: string;
  readonly verificationReceiptRef: string;
}
export interface ScopedSocialLearningBinding {
  readonly account: SocialAccount;
  readonly approvedIdentity: SocialAccountIdentity;
  readonly ownerAttestedContents: readonly OwnerAttestedSocialContent[];
}
export interface GovernedSocialNicheProjection {
  readonly schema: "jhadina.social.governed-niche.v1";
  readonly ownerUserId: string;
  readonly brandId: SocialAccount["brand"];
  readonly platform: SocialAccount["platform"];
  readonly nicheKey: string;
  readonly accountId?: string;
  readonly profile: ScopedSocialNicheProfile | null;
  readonly admittedObservationIds: readonly string[];
  readonly skippedLowConfidence: number;
  readonly skippedIncompleteMetrics: number;
  readonly disposition: "ADVISORY_ONLY" | "INSUFFICIENT_EVIDENCE";
  readonly requiresSeparateExperimentAndOwnerReview: true;
  readonly canModifySocialIdentity: false;
  readonly canModifyJhadinaPersonality: false;
  readonly canPublish: false;
}

function requireValue(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("SOCIAL_SCOPED_NICHE_REQUIRED:" + field);
  }
  return value.trim();
}
const keys = ["impressions", "views", "shares", "conversions"] as const;
function usableMetricSet(metrics: Readonly<Record<string, number>>): boolean {
  return keys.every(key => typeof metrics[key] === "number" &&
    Number.isFinite(metrics[key]) && metrics[key] >= 0);
}
/**
 * Selective #1136 Social-Juggernaut bridge.
 *
 * BINDINGS MUST COME FROM AUTHENTICATED OWNER+ACCOUNT REPOSITORY LOOKUPS.
 * This is deterministic/source-only; contents/receipts are *attestations by
 * that caller*, not verified provider rights or cryptographic proof here.
 *
 * Unlike #1136 buildNicheAlgorithmProfile, owner+brand+platform+account and
 * approved content membership are mandatory. No cross-brand niche pooling.
 */
export function buildGovernedSocialNicheProjection(input: {
  verifiedOwnerUserId: string;
  brandId: SocialAccount["brand"];
  platform: SocialAccount["platform"];
  nicheKey: string;
  accountId?: string;
  bindings: readonly ScopedSocialLearningBinding[];
  observations: readonly SocialObservation[];
  asOf: string;
  maxAgeDays?: number;
  minimumConfidence?: number;
  retiredEvidenceRefs?: readonly string[];
}): GovernedSocialNicheProjection {
  const ownerId = requireValue(input.verifiedOwnerUserId, "owner");
  const nicheKey = requireValue(input.nicheKey, "nicheKey");
  requireValue(input.brandId, "brandId");
  requireValue(input.platform, "platform");
  if (input.accountId !== undefined) requireValue(input.accountId, "accountId");
  if (!Number.isFinite(Date.parse(input.asOf))) {
    throw new Error("SOCIAL_SCOPED_NICHE_DATE_INVALID");
  }
  const minimumConfidence = input.minimumConfidence ?? 0.65;
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 ||
      minimumConfidence > 1) {
    throw new Error("SOCIAL_SCOPED_NICHE_CONFIDENCE_INVALID");
  }
  if (!input.bindings.length) {
    throw new Error("SOCIAL_SCOPED_NICHE_ACCOUNT_BINDINGS_REQUIRED");
  }
  const selected = new Map<string, {
    readonly binding: ScopedSocialLearningBinding;
    readonly verifiedContentIds: readonly string[];
    readonly nicheProofs: ReadonlyMap<string, string>;
  }>();
  for (const binding of input.bindings) {
    const { account, approvedIdentity } = binding;
    if (account.userId !== ownerId || account.brand !== input.brandId ||
        account.platform !== input.platform || account.status !== "connected") {
      throw new Error("SOCIAL_SCOPED_NICHE_ACCOUNT_SCOPE_DENIED");
    }
    assertSocialIdentityScope(approvedIdentity.scope, account);
    if (approvedIdentity.authority !== "EXPRESSION_ONLY" ||
        approvedIdentity.canPublish !== false ||
        approvedIdentity.canChangeJhadinaPersonality !== false) {
      throw new Error("SOCIAL_SCOPED_NICHE_IDENTITY_AUTHORITY_DENIED");
    }
    if (selected.has(account.id)) {
      throw new Error("SOCIAL_SCOPED_NICHE_DUPLICATE_ACCOUNT");
    }
    const contentRefs = new Map<string,string>();
    for (const content of binding.ownerAttestedContents) {
      const contentId = requireValue(content.contentId,"contentId");
      requireValue(content.nicheKey,"contentNicheKey");
      const receiptRef = requireValue(content.verificationReceiptRef,"verificationReceiptRef");
      if (content.nicheKey !== nicheKey) continue;
      if (contentRefs.has(contentId)) {
        throw new Error("SOCIAL_SCOPED_NICHE_DUPLICATE_CONTENT");
      }
      contentRefs.set(contentId,receiptRef);
    }
    selected.set(account.id,{
      binding,verifiedContentIds:Object.freeze([...contentRefs.keys()]),
      nicheProofs:contentRefs,
    });
  }
  if (input.accountId && !selected.has(input.accountId)) {
    throw new Error("SOCIAL_SCOPED_NICHE_ACCOUNT_NOT_BOUND");
  }
  const inScope = input.accountId
    ? new Map([...selected].filter(([id])=>id === input.accountId))
    : selected;
  const retired = new Set(input.retiredEvidenceRefs ?? []);
  const rows: ScopedSocialNicheObservation[] = [];
  const admittedIds: string[] = [];
  const seenIds = new Set<string>();
  let skippedLowConfidence=0;
  let skippedIncompleteMetrics=0;
  for (const observation of input.observations) {
    if (observation.kind !== "performance" || !observation.accountId) continue;
    const entry = inScope.get(observation.accountId);
    if (!entry) continue; // Other accounts cannot affect this scoped projection.
    if (seenIds.has(observation.id)) {
      throw new Error("SOCIAL_SCOPED_NICHE_DUPLICATE_OBSERVATION");
    }
    seenIds.add(observation.id);
    // Even same-account spoofed owner/brand/provider/profile fails closed here.
    const admitted=admitSocialIdentityPerformance({
      identity:entry.binding.approvedIdentity,
      account:entry.binding.account,
      observation,
      verifiedContentIds:entry.verifiedContentIds,
      asOf:input.asOf,
      maxAgeDays:input.maxAgeDays ?? 45,
    });
    if (admitted.evidenceRefs.some(ref=>retired.has(ref) ||
        retired.has(entry.nicheProofs.get(admitted.contentId) ?? ""))) continue;
    if (admitted.confidence < minimumConfidence) {
      skippedLowConfidence++;
      continue;
    }
    if (!usableMetricSet(admitted.metrics)) {
      skippedIncompleteMetrics++;
      continue;
    }
    const receiptRef=entry.nicheProofs.get(admitted.contentId);
    if (!receiptRef) throw new Error("SOCIAL_SCOPED_NICHE_CONTENT_ATTESTATION_MISSING");
    rows.push({
      id:admitted.id,
      ownerUserId:ownerId,
      brandId:input.brandId,
      accountId:admitted.scope.accountId,
      platform:input.platform,
      nicheKey,
      observedAt:admitted.observedAt,
      impressions:admitted.metrics.impressions!,
      views:admitted.metrics.views!,
      shares:admitted.metrics.shares!,
      conversions:admitted.metrics.conversions!,
      evidenceRefs:Object.freeze([...new Set([...admitted.evidenceRefs, receiptRef])]),
    });
    admittedIds.push(admitted.id);
  }
  const profile = rows.length
    ? buildScopedSocialNicheProfile({
        scope:{
          ownerUserId:ownerId,brandId:input.brandId,platform:input.platform,
          nicheKey,...(input.accountId ? {accountId:input.accountId} : {}),
        },
        observations:rows,asOf:input.asOf,maxAgeDays:input.maxAgeDays,
      })
    : null;
  return Object.freeze({
    schema:"jhadina.social.governed-niche.v1" as const,
    ownerUserId:ownerId,brandId:input.brandId,platform:input.platform,nicheKey,
    ...(input.accountId ? {accountId:input.accountId} : {}),
    profile,
    admittedObservationIds:Object.freeze(admittedIds),
    skippedLowConfidence,skippedIncompleteMetrics,
    disposition:profile ? "ADVISORY_ONLY" as const : "INSUFFICIENT_EVIDENCE" as const,
    requiresSeparateExperimentAndOwnerReview:true as const,
    canModifySocialIdentity:false as const,
    canModifyJhadinaPersonality:false as const,
    canPublish:false as const,
  });
}
