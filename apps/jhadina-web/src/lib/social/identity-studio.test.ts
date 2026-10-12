import {describe, expect, it} from "vitest";
import type {SocialAccount, SocialObservation} from "@jhadina/social-core";
import {buildIdentityStudioSnapshot} from "./identity-studio";
const t = "2026-10-11T15:00:00Z";
const owned:SocialAccount={
  id:"owner-account",userId:"owner-a",brand:"pupsonstuff",platform:"tiktok",
  provider:"hootsuite",providerProfileId:"owned-profile",
  displayName:"PupsonStuff TikTok",status:"connected",createdAt:t,updatedAt:t,
};
const other:SocialAccount={...owned,id:"other-account",userId:"owner-b",
  providerProfileId:"other-profile",displayName:"Different owner's TikTok"};
const obs=(id:string,changes:Partial<SocialObservation>={}):SocialObservation=>({
  id,userId:"owner-a",brand:"pupsonstuff",kind:"performance",source:"provider",
  provider:"hootsuite",providerProfileId:"owned-profile",platform:"tiktok",
  accountId:"owner-account",observedAt:"2026-10-10T12:00:00Z",contentId:"post-1",
  evidence:["provider:"+id],metrics:{views:100,shares:5},...changes,
});
describe("SOCIAL-ID.14 phone Identity Studio projection",()=>{
  it("renders owner-scoped account character and actual observation receipts only",async()=>{
    const view=await buildIdentityStudioSnapshot({
      verifiedUserId:"owner-a",accounts:[other,owned],
      observations:[obs("valid"),obs("different-owner",{userId:"owner-b"}),
        obs("different-brand",{brand:"atwood-bookie"}),
        obs("different-account",{accountId:"other-account"}),
        obs("different-provider-profile",{providerProfileId:"another"}),
        obs("future",{observedAt:"2026-11-11T15:00:00Z"})],asOf:t,
    });
    expect(view.accounts).toHaveLength(1);
    expect(view.accounts[0]?.character?.label).toBe("PupsonStuff");
    expect(view.accounts[0]?.identityStatus).toBe("not_configured");
    expect(view.accounts[0]?.observedPerformanceCount).toBe(1);
    expect(view.accounts[0]?.evidence[0]?.id).toBe("valid");
    expect(view.accounts[0]?.growthReadout.observedPerformanceRecords).toBe(1);
    expect(view.accounts[0]?.growthReadout.observedMetricTotals.views).toBe(100);
    expect(view.accounts[0]?.growthReadout.status).toBe("OBSERVATIONS_ONLY");
    expect(view.accounts[0]?.growthReadout.approvedIdentityLearning).toBe(false);
    expect(view.authority).toBe("READ_ONLY");
    expect(view.canPublish).toBe(false);
    expect(view.canApproveIdentity).toBe(false);
    expect(view.accounts[0]?.canReviewIdentityChanges).toBe(false);
    expect(view.accounts[0]?.observationsAreIdentityLearning).toBe(false);
  });
  it("refuses unverified or mismatched snapshots rather than reporting durable learning",async()=>{
    const view=await buildIdentityStudioSnapshot({
      verifiedUserId:"owner-a",accounts:[owned],observations:[],asOf:t,
      identityRepository:{load:async scope=>({
        schemaVersion:"jhadina.social.account-identity.v1",
        scope:{...scope,ownerUserId:"owner-b"},version:11,
        characterProfileRef:"forged",brandVoiceProfileRef:"forged",
        brandVoiceVersion:1,channelVoiceProfileRef:"forged",channelVoiceVersion:1,
        toneTraits:["strange"],pointOfView:"forged",evidenceRefs:["forged"],updatedAt:t,
        authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
      })},
    });
    expect(view.accounts[0]?.identityStatus).toBe("invalid_snapshot");
    expect(view.accounts[0]?.identityVersion).toBeUndefined();
  });
  it("labels an in-scope snapshot as unverified until real owner approval proof",async()=>{
    const view=await buildIdentityStudioSnapshot({
      verifiedUserId:"owner-a",accounts:[owned],observations:[obs("valid")],asOf:t,
      identityRepository:{load:async scope=>({
        schemaVersion:"jhadina.social.account-identity.v1",scope,version:3,
        characterProfileRef:"character:pupsonstuff",
        brandVoiceProfileRef:"brand-voice:pupsonstuff",brandVoiceVersion:1,
        channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
        toneTraits:["warm"],pointOfView:"Pups",evidenceRefs:["owner-reviewed"],updatedAt:t,
        authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
      })},
    });
    expect(view.accounts[0]?.identityStatus).toBe("unverified_snapshot");
    expect(view.accounts[0]?.identityVersion).toBe(3);
    expect(view.limitations.join(" ")).toMatch(/approval receipts/i);
  });
  it("filters disconnected accounts, and refuses invalid input limits",async()=>{
    const base={verifiedUserId:"owner-a",accounts:[{...owned,status:"revoked" as const}],
      observations:[obs("one")],asOf:t};
    expect((await buildIdentityStudioSnapshot(base)).accounts).toHaveLength(0);
    await expect(buildIdentityStudioSnapshot({...base,maxEvidencePerAccount:100}))
      .rejects.toThrow("SOCIAL_ID_STUDIO_EVIDENCE_LIMIT_INVALID");
  });
});
