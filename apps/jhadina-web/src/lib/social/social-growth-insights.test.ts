import {describe,expect,it} from "vitest";
import type {SocialAccount,SocialObservation} from "@jhadina/social-core";
import {buildSocialGrowthInsightReadout} from "./social-growth-insights";
const t="2026-10-11T20:00:00Z";
const account:SocialAccount={id:"a",userId:"owner-a",brand:"pupsonstuff",platform:"tiktok",provider:"hootsuite",
 providerProfileId:"profile-a",displayName:"Pups",status:"connected",createdAt:t,updatedAt:t};
const other:SocialAccount={...account,id:"b",userId:"owner-b",brand:"atwood-bookie",
 providerProfileId:"profile-b",displayName:"Atwood"};
const obs:SocialObservation={id:"obs-a",userId:"owner-a",brand:"pupsonstuff",platform:"tiktok",
 provider:"hootsuite",providerProfileId:"profile-a",accountId:"a",kind:"performance",
 observedAt:"2026-10-10T12:00:00Z",source:"provider",evidence:["receipt-a"],contentId:"post-a",
 metrics:{views:100,impressions:200,shares:8}};
const build=(overrides:Record<string,unknown>={})=>buildSocialGrowthInsightReadout({
 verifiedOwnerUserId:"owner-a",accounts:[account,other],
 observations:[obs,{...obs,id:"obs-b",userId:"owner-b",accountId:"b",brand:"atwood-bookie",providerProfileId:"profile-b",
 evidence:["receipt-b"]},{...obs,id:"future",observedAt:"2027-10-10T00:00:00Z"}],
 asOf:t,...overrides,
});
describe("SOCIAL-ID.18 read-only Social Growth readouts",()=>{
 it("stays account scoped and never calls observed metrics approved identity learning",()=>{
  const a=build();
  expect(a.accounts).toHaveLength(1);
  expect(a.accounts[0]?.observedPerformanceRecords).toBe(1);
  expect(a.accounts[0]?.observedMetricTotals.views).toBe(100);
  expect(a.accounts[0]?.observedMetricTotals.conversions).toBeUndefined();
  expect(a.accounts[0]?.status).toBe("OBSERVATIONS_ONLY");
  expect(a.accounts[0]?.approvedIdentityLearning).toBe(false);
  expect(a.accounts[0]?.nicheAnalysis).toHaveLength(0);
  expect(a.canPublish).toBe(false);
  expect(a.accounts[0]?.providerEvidenceRefs).not.toContain("receipt-b");
 });
 it("deduplicates observation IDs and rejects unverified foreign content binding",()=>{
  expect(build({observations:[obs,obs]}).accounts[0]?.observedMetricTotals.views).toBe(100);
  expect(()=>build({ownerVerifiedNicheBindings:[{
    account:other,
    approvedIdentity:{} as never,
    ownerAttestedContents:[],
  }]})).toThrow("SOCIAL_GROWTH_INSIGHTS_UNTRUSTED_BINDING");
 });
 it("disconnected or non-selected accounts never enter output",()=>{
  expect(build({selectedAccountIds:["absent"]}).accounts).toHaveLength(0);
  expect(build({accounts:[{...account,status:"revoked"}]}).accounts).toHaveLength(0);
 });
});
