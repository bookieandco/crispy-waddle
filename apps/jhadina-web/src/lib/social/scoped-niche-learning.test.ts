import {describe,expect,it} from "vitest";
import type {SocialAccount,SocialAccountIdentity,SocialObservation} from "@jhadina/social-core";
import {buildGovernedSocialNicheProjection,type ScopedSocialLearningBinding} from "./scoped-niche-learning";
const now="2026-10-11T20:00:00Z";
function binding(id:string,brand:"pupsonstuff"|"atwood-bookie"="pupsonstuff",owner="owner-a"):ScopedSocialLearningBinding {
  const account:SocialAccount={
    id,userId:owner,brand,platform:"tiktok",provider:"hootsuite",
    providerProfileId:"provider-"+id,displayName:id,status:"connected",createdAt:now,updatedAt:now,
  };
  const identity:SocialAccountIdentity={
    schemaVersion:"jhadina.social.account-identity.v1",
    scope:{ownerUserId:owner,brandId:brand,accountId:id,platform:"tiktok",
      provider:"hootsuite",providerProfileId:"provider-"+id},
    version:1,characterProfileRef:"character:"+brand,brandVoiceProfileRef:"voice:"+brand,
    brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
    toneTraits:["grounded"],pointOfView:"Stay on brand",evidenceRefs:["review"],
    updatedAt:now,authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
  };
  return {account,approvedIdentity:identity,ownerAttestedContents:[
    {contentId:"post-"+id,nicheKey:"pets",verificationReceiptRef:"approved-content:"+id},
  ]};
}
function obs(id:string,changes:Partial<SocialObservation>={}):SocialObservation {
  return {
    id:"obs-"+id,kind:"performance",userId:"owner-a",brand:"pupsonstuff",
    platform:"tiktok",provider:"hootsuite",providerProfileId:"provider-"+id,
    accountId:id,contentId:"post-"+id,source:"provider-export",observedAt:"2026-10-10T12:00:00Z",
    evidence:["provider-evidence:"+id],metrics:{
      impressions:200,views:120,shares:12,conversions:2,
    },attributes:{confidence:0.9},...changes,
  };
}
const run=(changes:Record<string,unknown>={})=>
  buildGovernedSocialNicheProjection({
    verifiedOwnerUserId:"owner-a",brandId:"pupsonstuff",platform:"tiktok",
    nicheKey:"pets",bindings:[binding("one"),binding("two")],
    observations:[obs("one"),obs("two")],asOf:now,...changes,
  });
describe("SOCIAL-ID.17: selective #1136 owner/brand safe niche integration",()=>{
  it("aggregates approved same-brand account performance as advisory-only",()=>{
    const result=run();
    expect(result.profile?.sampleSize).toBe(2);
    expect(result.profile?.shareRatePerView).toBeCloseTo(0.1);
    expect(result.profile?.conversionRatePerImpression).toBeCloseTo(0.01);
    expect(result.disposition).toBe("ADVISORY_ONLY");
    expect(result.canPublish).toBe(false);
    expect(result.canModifySocialIdentity).toBe(false);
    expect(result.canModifyJhadinaPersonality).toBe(false);
    expect(result.profile?.evidenceRefs).toContain("approved-content:one");
  });
  it("account scoped result cannot leak other account evidence",()=>{
    const result=run({accountId:"one"});
    expect(result.profile?.sampleSize).toBe(1);
    expect(result.profile?.accountId).toBe("one");
    expect(result.profile?.observationIds).toEqual(["social-identity-learning:obs-one"]);
    expect(result.profile?.evidenceRefs).not.toContain("provider-evidence:two");
  });
  it("refuses foreign brand/owner/platform bindings even when niche is the same",()=>{
    expect(()=>run({bindings:[binding("one"),binding("other","atwood-bookie")]}))
      .toThrow("SOCIAL_SCOPED_NICHE_ACCOUNT_SCOPE_DENIED");
    expect(()=>run({bindings:[binding("one","pupsonstuff","owner-b")]}))
      .toThrow("SOCIAL_SCOPED_NICHE_ACCOUNT_SCOPE_DENIED");
    expect(()=>run({bindings:[{...binding("one"),account:{
      ...binding("one").account,platform:"youtube",
    }}]})).toThrow("SOCIAL_SCOPED_NICHE_ACCOUNT_SCOPE_DENIED");
  });
  it("rejects same-account observation with forged brand/owner/provider",()=>{
    expect(()=>run({observations:[obs("one",{userId:"owner-b"})]}))
      .toThrow("SOCIAL_ID_LEARNING_OBSERVATION_SCOPE_MISMATCH");
    expect(()=>run({observations:[obs("one",{brand:"atwood-bookie"})]}))
      .toThrow("SOCIAL_ID_LEARNING_OBSERVATION_SCOPE_MISMATCH");
    expect(()=>run({observations:[obs("one",{providerProfileId:"wrong"})]}))
      .toThrow("SOCIAL_ID_LEARNING_OBSERVATION_SCOPE_MISMATCH");
  });
  it("never counts unapproved content, future data or missing receipts",()=>{
    expect(()=>run({observations:[obs("one",{contentId:"unapproved"})]}))
      .toThrow("SOCIAL_ID_LEARNING_CONTENT_NOT_VERIFIED");
    expect(()=>run({observations:[obs("one",{observedAt:"2026-12-12T00:00:00Z"})]}))
      .toThrow("SOCIAL_ID_LEARNING_STALE_OR_FUTURE");
    expect(()=>run({bindings:[{...binding("one"),ownerAttestedContents:[]}],
      observations:[obs("one")]})).toThrow("SOCIAL_ID_LEARNING_CONTENT_NOT_VERIFIED");
  });
  it("returns insufficient evidence for incomplete metrics or low confidence",()=>{
    const result=run({observations:[obs("one",{metrics:{views:12}}),
      obs("two",{attributes:{confidence:0.4}})]});
    expect(result.disposition).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.profile).toBeNull();
    expect(result.skippedIncompleteMetrics).toBe(1);
    expect(result.skippedLowConfidence).toBe(1);
  });
  it("does not use revoked evidence or admit duplicate receipt IDs",()=>{
    const result=run({retiredEvidenceRefs:["provider-evidence:one"]});
    expect(result.profile?.sampleSize).toBe(1);
    expect(result.profile?.evidenceRefs).not.toContain("provider-evidence:one");
    expect(()=>run({observations:[obs("one"),obs("one")]}))
      .toThrow("SOCIAL_SCOPED_NICHE_DUPLICATE_OBSERVATION");
  });
  it("never turns global mixed account observations into target scope",()=>{
    const foreign=obs("other",{id:"obs-foreign",accountId:"other",
      userId:"owner-z",brand:"atwood-bookie",providerProfileId:"p-foreign"});
    const result=run({accountId:"one",observations:[obs("one"),foreign]});
    expect(result.profile?.sampleSize).toBe(1);
    expect(result.profile?.evidenceRefs).not.toContain("provider-evidence:other");
  });
});
