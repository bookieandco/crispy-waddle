import { describe, expect, it } from "vitest";
import {
  createRelayBrandBrief, rankRelayTrends, generateRelayDraftBatch,
  reviewRelayDraft, planRelayCalendar, prepareRelayPublication,
  evaluateRelayPerformance,
  type RelayBrandBrief, type RelayTrend, type RelayDraft,
} from "./relay-workbench.js";
import { bindContentAssetMedia } from "./content-projects.js";
import type { SocialAccount, SocialObservation } from "./index.js";

const now = "2026-10-19T20:00:00.000Z";
function brand(overrides: Partial<RelayBrandBrief> = {}) {
  return createRelayBrandBrief({
    id: "pupson-v1", ownerUserId: "owner-1", brand: "pupsonstuff",
    siteUrl: "https://pupsonstuff.example/products",
    positioning: "Custom portraits inspired by your own dog",
    audience: "Dog parents", offer: "custom dog portrait gifts",
    keywords: ["dog", "portrait"], evidenceRefs: ["owner-brief:1"],
    provenance: "owner_supplied", createdAt: now, ...overrides,
  });
}
function trend(overrides: Partial<RelayTrend> = {}): RelayTrend {
  return {
    id: "trend-1", platform: "tiktok", format: "short_video",
    topic: "dog portrait gift demo", pattern: "product reveal",
    sourceUrl: "https://example.com/trend1",
    observedAt: "2026-10-18T20:00:00.000Z",
    evidenceRefs: ["owner-source:1"], source: "owner_submitted", ...overrides,
  };
}
function draft() {
  const brief = brand();
  const ranked = rankRelayTrends(brief, [trend()], now);
  return { brief, draft: generateRelayDraftBatch({ brief, trends: ranked, count: 1, now })[0] };
}
function account(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: "account-1", userId: "owner-1", brand: "pupsonstuff",
    provider: "hootsuite", providerProfileId: "profile-1", platform: "tiktok",
    displayName: "Dog Shop", status: "connected", createdAt: now, updatedAt: now,
    ...overrides,
  };
}
function plan(brief: RelayBrandBrief, draft: RelayDraft, a = account()) {
  return planRelayCalendar({
    brief, drafts: [draft], accounts: [a],
    targetAccountByDraftId: { [draft.id]: a.id },
    firstScheduledAt: "2026-10-20T20:00:00.000Z", now,
  })[0];
}
describe("JH-SOCIAL-RELAY .01–.06 source-only workbench", () => {
  it(".01 requires explicit owner evidence, never treats site URL as scraped", () => {
    expect(brand().provenance).toBe("owner_supplied");
    expect(() => brand({ evidenceRefs: [] })).toThrow("RELAY_BRAND_EVIDENCE_REQUIRED");
    expect(() => brand({ siteUrl: "file:///etc/passwd" })).toThrow("RELAY_SOURCE_URL_INVALID");
  });
  it(".02 ranks niche and freshness, rejects unverifiable/future/duplicate trends", () => {
    const b = brand();
    const ranked = rankRelayTrends(b, [
      trend({ id: "offtopic", topic: "general news", pattern: "random" }),
      trend({ id: "on-topic" }),
    ], now);
    expect(ranked[0].id).toBe("on-topic");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(() => rankRelayTrends(b, [trend({ observedAt: "2027-01-01T00:00:00Z" })], now)).toThrow("RELAY_FUTURE_TREND_DENIED");
    expect(() => rankRelayTrends(b, [trend(), trend()], now)).toThrow("RELAY_DUPLICATE_TREND");
  });
  it(".03 batch creates canonical content projects with source lineage and no generated media", () => {
    const b = brand();
    const batch = generateRelayDraftBatch({
      brief: b, trends: rankRelayTrends(b, [trend()], now), count: 30, now,
    });
    expect(batch).toHaveLength(30);
    expect(new Set(batch.map((d) => d.hook)).size).toBe(30);
    expect(new Set(batch.map((d) => d.id)).size).toBe(30);
    expect(batch[0].project.brand).toBe("pupsonstuff");
    expect(batch[0].project.assets[0].evidenceRefs).toContain("owner-source:1");
    expect(batch.every((d) => d.project.assets[0].mediaRefs.length === 0)).toBe(true);
    expect(() => generateRelayDraftBatch({ brief: b, trends: [], count: 1, now })).toThrow("RELAY_VERIFIED_TRENDS_REQUIRED");
    expect(() => generateRelayDraftBatch({ brief: b, trends: rankRelayTrends(b, [trend({ topic: "unrelated", pattern: "abstract" })], now), count: 1, now })).toThrow("RELAY_TREND_FIT_OR_EVIDENCE_REQUIRED");
    expect(() => generateRelayDraftBatch({ brief: b, trends: rankRelayTrends(b, [trend()], now), count: 31, now })).toThrow("RELAY_BATCH_LIMIT");
  });
  it(".04 owner review cannot be silently repeated or translated into publish authority", () => {
    const { draft: d } = draft();
    const accepted = reviewRelayDraft(d, "accept", "owner-1", now);
    expect(accepted.review).toBe("accepted_for_planning");
    expect(() => reviewRelayDraft(accepted, "accept", "owner-1", now)).toThrow("RELAY_ALREADY_REVIEWED");
    expect(() => planRelayCalendar({
      brief: brand(), drafts: [d], accounts: [account()],
      targetAccountByDraftId: { [d.id]: "account-1" },
      firstScheduledAt: "2026-10-20T20:00:00Z", now,
    })).toThrow("RELAY_OWNER_REVIEW_REQUIRED");
  });
  it(".05 refuses cross-owner, cross-brand, disconnected, mismatched targets", () => {
    const { brief, draft: d } = draft();
    const accepted = reviewRelayDraft(d, "accept", "owner-1", now);
    const slot = plan(brief, accepted);
    expect(slot.isQueued).toBe(false);
    expect(slot.requiresCanonicalPublicationApproval).toBe(true);
    expect(() => plan(brief, accepted, account({ userId: "stranger" }))).toThrow("RELAY_CONNECTED_OWNER_ACCOUNT_REQUIRED");
    expect(() => plan(brief, accepted, account({ brand: "jhadina" }))).toThrow("RELAY_TARGET_SCOPE_MISMATCH");
    expect(() => plan(brief, accepted, account({ platform: "facebook" }))).toThrow("RELAY_TARGET_SCOPE_MISMATCH");
    expect(() => plan(brief, accepted, account({ status: "revoked" }))).toThrow("RELAY_CONNECTED_OWNER_ACCOUNT_REQUIRED");
    expect(() => prepareRelayPublication({ brief, draft: accepted, slot, account: account() }))
      .toThrow("RELAY_RENDERED_MEDIA_REQUIRED");
  });
  it(".05 only prepares canonical publication input after bound media; never publishes", () => {
    const { brief, draft: d } = draft();
    const accepted = reviewRelayDraft(d, "accept", "owner-1", now);
    const withMedia = {
      ...accepted, project: bindContentAssetMedia(
        accepted.project, accepted.project.assets[0].id,
        ["https://owned-media.example/portrait.mp4"], ["director-review:1"], now,
      ),
    };
    const slot = plan(brief, withMedia);
    const proposal = prepareRelayPublication({ brief, draft: withMedia, slot, account: account() });
    expect(proposal.targets).toHaveLength(1);
    expect(proposal.scheduledAt).toBe(slot.scheduledAt);
    expect(proposal.mediaUrls).toEqual(["https://owned-media.example/portrait.mp4"]);
  });
  it(".06 reports unknown metrics as unknown, rejects cross-brand and unsupported evidence", () => {
    const { draft: d } = draft();
    const observation: SocialObservation = {
      id: "observed-1", brand: "pupsonstuff", kind: "performance",
      platform: "tiktok", source: "owned-analytics", contentId: d.project.assets[0].id,
      observedAt: now, evidence: ["provider-receipt:1"],
      metrics: { impressions: 100, engagements: 8, clicks: 2 },
    };
    const score = evaluateRelayPerformance(d, [
      observation, { ...observation, id: "wrong", brand: "jhadina", metrics: { impressions: 100000 } },
      { ...observation, id: "unverified", evidence: [], metrics: { impressions: 100000 } },
    ]);
    const snapshots = evaluateRelayPerformance(d, [
      { ...observation, id: "sample-old", accountId: "account-1", observedAt: "2026-10-17T20:00:00Z", metrics: { impressions: 70 } },
      { ...observation, id: "sample-new", accountId: "account-1", observedAt: now, metrics: { impressions: 100 } },
    ]);
    expect(snapshots.impressions).toBe(100);
    expect(score.impressions).toBe(100);
    expect(score.engagementRate).toBeCloseTo(0.08);
    expect(score.clickThroughRate).toBeCloseTo(0.02);
    expect(score.views).toBeNull();
    expect(score.conclusion).toBe("observational_only");
    expect(evaluateRelayPerformance(d, []).conclusion).toBe("insufficient_evidence");
    expect(evaluateRelayPerformance(d, []).clickThroughRate).toBeNull();
  });
});
