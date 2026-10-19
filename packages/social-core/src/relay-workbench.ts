import { createContentProject, type ContentProject } from "./content-projects.js";
import type { JhadinaBrand, SocialAccount, SocialPlatform } from "./types.js";
import type { SocialPublicationInput } from "./publication.js";
import type { SocialObservation } from "./observations.js";

/**
 * JH-SOCIAL-RELAY: a deterministic, source-bound, NO-EXECUTION creative workbench.
 * No website scraping, provider calls, generated media, external posting, DB writes,
 * or publication authority is performed here.
 */
export type RelayFormat = "short_video" | "carousel";
export type RelayReview = "draft" | "accepted_for_planning" | "rejected";

export interface RelayBrandBrief {
  id: string;
  ownerUserId: string;
  brand: JhadinaBrand;
  siteUrl: string;
  positioning: string;
  audience: string;
  offer: string;
  keywords: readonly string[];
  evidenceRefs: readonly string[];
  provenance: "owner_supplied";
  createdAt: string;
}

export interface RelayTrend {
  id: string;
  platform: SocialPlatform;
  format: RelayFormat;
  topic: string;
  pattern: string;
  sourceUrl: string;
  observedAt: string;
  evidenceRefs: readonly string[];
  source: "owner_submitted" | "authorized_observation";
}

export interface RelayRankedTrend extends RelayTrend {
  score: number;
  matchingKeywords: readonly string[];
  ageDays: number;
}

export interface RelayDraft {
  id: string;
  brandBriefId: string;
  sourceTrendId: string;
  platform: SocialPlatform;
  format: RelayFormat;
  angle: string;
  hook: string;
  caption: string;
  storyboard: readonly string[];
  evidenceRefs: readonly string[];
  project: ContentProject;
  review: RelayReview;
  reviewerId?: string;
  reviewedAt?: string;
}

export interface RelayCalendarSlot {
  id: string;
  draftId: string;
  ownerUserId: string;
  brand: JhadinaBrand;
  accountId: string;
  platform: SocialPlatform;
  scheduledAt: string;
  requiresCanonicalPublicationApproval: true;
  isQueued: false;
}

export interface RelayPerformance {
  draftId: string;
  platform: SocialPlatform;
  observedSamples: number;
  impressions: number | null;
  views: number | null;
  engagements: number | null;
  clicks: number | null;
  engagementRate: number | null;
  clickThroughRate: number | null;
  evidenceRefs: readonly string[];
  conclusion: "insufficient_evidence" | "observational_only";
}

const ANGLES = ["problem", "behind_the_scenes", "how_it_works", "common_question", "comparison", "customer_value"] as const;
const MAX_BATCH = 30;
const PLATFORMS: readonly SocialPlatform[] = [
  "facebook", "instagram", "tiktok", "youtube", "x", "linkedin",
  "threads", "bluesky", "reddit", "snapchat", "tumblr", "vk",
];

function required(value: string, code: string): string {
  if (!value || !value.trim()) throw new Error(code);
  return value.trim();
}
function iso(value: string, code: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(code);
  return ms;
}
function refs(values: readonly string[], code: string): readonly string[] {
  if (!values.length || values.some((v) => !v.trim())) throw new Error(code);
  return Object.freeze([...new Set(values.map((v) => v.trim()))]);
}
function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".")) {
      throw new Error("invalid");
    }
    if (url.username || url.password) throw new Error("invalid");
    return url.toString();
  } catch {
    throw new Error("RELAY_SOURCE_URL_INVALID");
  }
}
function assertPlatform(value: SocialPlatform): void {
  if (!PLATFORMS.includes(value)) throw new Error("RELAY_PLATFORM_INVALID");
}
function uniqueId(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "_");
}

export function createRelayBrandBrief(input: RelayBrandBrief): RelayBrandBrief {
  required(input.id, "RELAY_BRIEF_ID_REQUIRED");
  required(input.ownerUserId, "RELAY_OWNER_REQUIRED");
  required(input.positioning, "RELAY_POSITIONING_REQUIRED");
  required(input.audience, "RELAY_AUDIENCE_REQUIRED");
  required(input.offer, "RELAY_OFFER_REQUIRED");
  iso(input.createdAt, "RELAY_DATE_INVALID");
  if (input.provenance !== "owner_supplied") throw new Error("RELAY_UNVERIFIED_BRAND_PROVENANCE");
  const keywords = refs(input.keywords, "RELAY_BRAND_KEYWORDS_REQUIRED");
  if (keywords.length > 20) throw new Error("RELAY_TOO_MANY_KEYWORDS");
  return Object.freeze({
    ...input, siteUrl: safeUrl(input.siteUrl), keywords,
    evidenceRefs: refs(input.evidenceRefs, "RELAY_BRAND_EVIDENCE_REQUIRED"),
  });
}

export function rankRelayTrends(
  brief: RelayBrandBrief, trends: readonly RelayTrend[], now: string,
): readonly RelayRankedTrend[] {
  const nowMs = iso(now, "RELAY_DATE_INVALID");
  const ids = new Set<string>();
  return Object.freeze(trends.map((trend) => {
    required(trend.id, "RELAY_TREND_ID_REQUIRED");
    if (ids.has(trend.id)) throw new Error("RELAY_DUPLICATE_TREND");
    ids.add(trend.id);
    assertPlatform(trend.platform);
    if (trend.format !== "short_video" && trend.format !== "carousel") throw new Error("RELAY_FORMAT_INVALID");
    required(trend.topic, "RELAY_TREND_TOPIC_REQUIRED");
    required(trend.pattern, "RELAY_TREND_PATTERN_REQUIRED");
    if (!["owner_submitted", "authorized_observation"].includes(trend.source)) throw new Error("RELAY_SOURCE_INVALID");
    safeUrl(trend.sourceUrl);
    const observed = iso(trend.observedAt, "RELAY_DATE_INVALID");
    if (observed > nowMs) throw new Error("RELAY_FUTURE_TREND_DENIED");
    const evidence = refs(trend.evidenceRefs, "RELAY_TREND_EVIDENCE_REQUIRED");
    const ageDays = Math.floor((nowMs - observed) / 86400000);
    const body = (trend.topic + " " + trend.pattern).toLowerCase();
    const matchingKeywords = brief.keywords.filter((keyword) => body.includes(keyword.toLowerCase()));
    const fit = Math.min(60, matchingKeywords.length * 20);
    const freshness = ageDays <= 7 ? 30 : ageDays <= 30 ? 15 : 0;
    const score = fit + freshness + (trend.source === "authorized_observation" ? 10 : 0);
    return Object.freeze({
      ...trend, sourceUrl: safeUrl(trend.sourceUrl), evidenceRefs: evidence,
      score, matchingKeywords: Object.freeze([...matchingKeywords]), ageDays,
    });
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)));
}

export function generateRelayDraftBatch(input: {
  brief: RelayBrandBrief;
  trends: readonly RelayRankedTrend[];
  count: number;
  now: string;
}): readonly RelayDraft[] {
  const { brief, trends, count, now } = input;
  iso(now, "RELAY_DATE_INVALID");
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) throw new Error("RELAY_BATCH_LIMIT");
  if (!trends.length) throw new Error("RELAY_VERIFIED_TRENDS_REQUIRED");
  if (trends.some((t) => t.score < 15 || t.evidenceRefs.length === 0)) {
    throw new Error("RELAY_TREND_FIT_OR_EVIDENCE_REQUIRED");
  }
  return Object.freeze(Array.from({ length: count }, (_, i) => {
    const trend = trends[i % trends.length];
    const angle = ANGLES[Math.floor(i / trends.length) % ANGLES.length];
    const id = "relay:" + uniqueId(brief.id) + ":" + uniqueId(trend.id) + ":" + String(i + 1);
    // A structure for original authoring, not a reproduction of the source post.
    const hook = "A " + angle.replace(/_/g, " ") + " look at " + brief.offer + ".";
    const caption = hook + " For " + brief.audience + ": " + brief.positioning + ".";
    const storyboard = Object.freeze([
      "Open with an original " + angle.replace(/_/g, " ") + " question.",
      "Demonstrate " + brief.offer + " with brand-owned media and verifiable details.",
      "Close with an honest product-specific call to action; verify claims before use.",
    ]);
    const evidenceRefs = refs([...brief.evidenceRefs, ...trend.evidenceRefs, trend.sourceUrl], "RELAY_DRAFT_EVIDENCE_REQUIRED");
    const project = createContentProject({
      id: id + ":project", brand: brief.brand,
      authorityPositionRef: "relay-brand:" + brief.id,
      pillarRef: "relay-topic:" + uniqueId(trend.topic),
      bigIdeaRef: "relay-angle:" + angle + ":" + uniqueId(trend.id),
      primaryJob: "reach", origin: "ai_generated",
      evidenceRefs, createdAt: now,
      anchor: {
        id: id + ":anchor", kind: trend.format, platform: trend.platform,
        transformation: "original",
        text: caption + "\n" + storyboard.join("\n"),
        mediaRefs: [], evidenceRefs,
      },
    });
    return Object.freeze({
      id, brandBriefId: brief.id, sourceTrendId: trend.id, platform: trend.platform,
      format: trend.format, angle, hook, caption, storyboard, evidenceRefs, project,
      review: "draft" as const,
    });
  }));
}

export function reviewRelayDraft(
  draft: RelayDraft, decision: "accept" | "reject", reviewerId: string, at: string,
): RelayDraft {
  required(reviewerId, "RELAY_REVIEWER_REQUIRED");
  iso(at, "RELAY_DATE_INVALID");
  if (draft.review !== "draft") throw new Error("RELAY_ALREADY_REVIEWED");
  return Object.freeze({
    ...draft, review: decision === "accept" ? "accepted_for_planning" : "rejected",
    reviewerId, reviewedAt: at,
  });
}

/** This only proposes slots. It never creates SocialPublicationProposal or an outbox job. */
export function planRelayCalendar(input: {
  brief: RelayBrandBrief;
  drafts: readonly RelayDraft[];
  accounts: readonly SocialAccount[];
  targetAccountByDraftId: Readonly<Record<string, string>>;
  firstScheduledAt: string;
  now: string;
}): readonly RelayCalendarSlot[] {
  const nowMs = iso(input.now, "RELAY_DATE_INVALID");
  const firstMs = iso(input.firstScheduledAt, "RELAY_SCHEDULE_INVALID");
  if (firstMs <= nowMs) throw new Error("RELAY_FUTURE_SCHEDULE_REQUIRED");
  if (input.drafts.length > MAX_BATCH) throw new Error("RELAY_BATCH_LIMIT");
  const seen = new Set<string>();
  return Object.freeze(input.drafts.map((draft, i) => {
    if (seen.has(draft.id)) throw new Error("RELAY_DUPLICATE_DRAFT");
    seen.add(draft.id);
    if (draft.brandBriefId !== input.brief.id || draft.project.brand !== input.brief.brand) {
      throw new Error("RELAY_CROSS_BRAND_DENIED");
    }
    if (draft.review !== "accepted_for_planning" || draft.reviewerId !== input.brief.ownerUserId) {
      throw new Error("RELAY_OWNER_REVIEW_REQUIRED");
    }
    const accountId = input.targetAccountByDraftId[draft.id];
    const account = input.accounts.find((a) => a.id === accountId);
    if (!account || account.userId !== input.brief.ownerUserId || account.status !== "connected") {
      throw new Error("RELAY_CONNECTED_OWNER_ACCOUNT_REQUIRED");
    }
    if (account.brand !== input.brief.brand || account.platform !== draft.platform) {
      throw new Error("RELAY_TARGET_SCOPE_MISMATCH");
    }
    return Object.freeze({
      id: "relay-slot:" + draft.id, draftId: draft.id,
      ownerUserId: input.brief.ownerUserId,
      brand: input.brief.brand, accountId, platform: draft.platform,
      scheduledAt: new Date(firstMs + i * 86400000).toISOString(),
      requiresCanonicalPublicationApproval: true as const, isQueued: false as const,
    });
  }));
}

/**
 * Converts a fully reviewed, media-backed plan into a *request payload only*.
 * Caller must still invoke canonical Social approval and capability gates.
 */
export function prepareRelayPublication(input: {
  brief: RelayBrandBrief;
  draft: RelayDraft;
  slot: RelayCalendarSlot;
  account: SocialAccount;
}): SocialPublicationInput {
  const { brief, draft, slot, account } = input;
  if (draft.review !== "accepted_for_planning" || draft.reviewerId !== brief.ownerUserId) {
    throw new Error("RELAY_OWNER_REVIEW_REQUIRED");
  }
  if (draft.project.brand !== brief.brand || draft.brandBriefId !== brief.id
    || slot.draftId !== draft.id || slot.ownerUserId !== brief.ownerUserId
    || account.userId !== brief.ownerUserId || account.id !== slot.accountId
    || account.brand !== brief.brand || slot.brand !== brief.brand
    || account.platform !== draft.platform || slot.platform !== draft.platform
    || account.status !== "connected") throw new Error("RELAY_PUBLICATION_SCOPE_DENIED");
  if (!slot.requiresCanonicalPublicationApproval || slot.isQueued !== false) {
    throw new Error("RELAY_CANONICAL_APPROVAL_REQUIRED");
  }
  const mediaRefs = draft.project.assets[0]?.mediaRefs ?? [];
  if (!mediaRefs.length) throw new Error("RELAY_RENDERED_MEDIA_REQUIRED");
  mediaRefs.forEach(safeUrl);
  return Object.freeze({
    brand: brief.brand, text: draft.caption, mediaUrls: [...mediaRefs],
    scheduledAt: slot.scheduledAt, targets: [{
      accountId: account.id, brand: account.brand, provider: account.provider,
      providerProfileId: account.providerProfileId, platform: account.platform,
    }],
  });
}

/** Observational reporting, not causal attribution, provider authenticity, or a winning-post claim. */
export function evaluateRelayPerformance(
  draft: RelayDraft, observations: readonly SocialObservation[],
): RelayPerformance {
  const filtered = observations.filter((o) =>
    o.kind === "performance" && o.brand === draft.project.brand
    && o.platform === draft.platform && o.contentId === draft.project.assets[0]?.id
    && o.evidence.length > 0 && Number.isFinite(Date.parse(o.observedAt)),
  );
  // Provider metrics commonly represent cumulative snapshots. Use the latest
  // observation per account, not a sum of overlapping historical snapshots.
  // Unknown account IDs share one bucket and must not be multiplied.
  const latestByAccount = new Map<string, SocialObservation>();
  for (const observation of filtered) {
    const key = observation.accountId ?? "unknown-account";
    const prior = latestByAccount.get(key);
    if (!prior || observation.observedAt > prior.observedAt
      || (observation.observedAt === prior.observedAt && observation.id > prior.id)) {
      latestByAccount.set(key, observation);
    }
  }
  const sum = (key: string): number | null => {
    const values = [...latestByAccount.values()].map((o) => o.metrics?.[key]).filter((n): n is number =>
      typeof n === "number" && Number.isFinite(n) && n >= 0,
    );
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const impressions = sum("impressions");
  const views = sum("views");
  const engagements = sum("engagements");
  const clicks = sum("clicks");
  // Rates stay unknown without actual measured denominators.
  const rate = (num: number | null, den: number | null) =>
    num === null || den === null || den <= 0 ? null : num / den;
  return Object.freeze({
    draftId: draft.id, platform: draft.platform, observedSamples: filtered.length,
    impressions, views, engagements, clicks,
    engagementRate: rate(engagements, impressions ?? views),
    clickThroughRate: rate(clicks, impressions),
    evidenceRefs: Object.freeze([...new Set(filtered.flatMap((o) => [o.id, ...o.evidence]))]),
    conclusion: filtered.length ? "observational_only" : "insufficient_evidence",
  });
}
