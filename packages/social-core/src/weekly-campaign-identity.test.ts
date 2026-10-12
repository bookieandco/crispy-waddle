import {describe,expect,it} from "vitest";
import {compileWeeklySocialCampaignPacket,type SocialProfileIdentityBinding,
 type WeeklySocialAction,type WeeklySocialCampaign} from "./weekly-campaign.js";
import type {EffectiveSocialIdentity} from "./effective-identity.js";
import {compileIdentityBoundWeeklySocialPacket,assertIdentityBoundWeeklyReviewCurrent}
 from "./weekly-campaign-identity.js";
const profile: SocialProfileIdentityBinding = {
  characterProfileRef: "character:pupsonstuff",
  voiceProfileRef: "brand-voice:pupsonstuff",
  evidenceRefs: ["profile:pupsonstuff"],
};

const actions: WeeklySocialAction[] = [
  {
    id: "action:director:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "director_production",
    profile,
    scheduledAt: "2026-10-13T16:00:00.000Z",
    socialContentProjectRef: "social-project:pupson:1",
    socialAssetRef: "social-asset:pupson:1",
    directorProjectRef: "director:pupson:1",
    productionBriefRef: "director-brief:pupson:1",
    requiredBy: "2026-10-12T16:00:00.000Z",
    experimentVariantRef: "variant:pupson:a",
    evidenceRefs: ["brief:pupson"],
  },
  {
    id: "action:organic:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "organic_publication",
    profile,
    scheduledAt: "2026-10-14T17:00:00.000Z",
    target: {
      accountId: "account:pupson:instagram",
      brand: "pupsonstuff",
      provider: "hootsuite",
      providerProfileId: "profile:ig:pupson",
      platform: "instagram",
    },
    contentProjectRef: "social-project:pupson:1",
    contentAssetRef: "social-asset:pupson:1",
    text: "Synthetic approved campaign copy.",
    mediaRefs: ["media:pupson:1"],
    destinationRef: "storefront:pupsonstuff",
    commercialLineageRef: "lineage:pupson:1",
    evidenceRefs: ["product:pupson", "creative:pupson"],
  },
  {
    id: "action:comment:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "public_comment",
    profile,
    scheduledAt: "2026-10-15T18:00:00.000Z",
    platform: "instagram",
    accountId: "account:pupson:instagram",
    targetContentRef: "instagram:post:pet-topic",
    targetCreatorRef: "creator:pet-account",
    text: "Synthetic relevant profile-voice comment.",
    relevanceScore: 92,
    relevanceReason: "The public post topic directly overlaps the brand audience and approved campaign.",
    commercialRelevanceEvidenceRefs: ["audience:pet-topic", "brand:pupsonstuff"],
    evidenceRefs: ["radar:pet-topic"],
  },
  {
    id: "action:paid:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "paid_campaign",
    profile,
    growthBrandId: "brand:pupsonstuff",
    campaignName: "PupsonStuff Meta creative test",
    provider: "markifact",
    idempotencyKey: "weekly:pupson:meta:creative:1",
    scheduledAt: "2026-10-16T16:00:00.000Z",
    channel: "meta",
    providerAccountId: "meta-account:pupson",
    objective: "sales",
    audienceIds: ["audience:pupson:high-intent", "audience:pupson:lookalike"],
    creativeIds: ["creative:pupson:control", "creative:pupson:treatment"],
    landingPageRef: "storefront:pupsonstuff",
    currency: "USD",
    dailyBudgetMinor: 2500,
    lifetimeBudgetMinor: 10000,
    startsAt: "2026-10-16T16:00:00.000Z",
    endsAt: "2026-10-18T23:00:00.000Z",
    experimentRef: "experiment:pupson:meta:1",
    paidAccelerationStatus: "BOUNDED_PAID_TEST_READY",
    paidAccelerationEvidenceRefs: ["paid-readiness:pupson:meta:1"],
    evidenceRefs: ["audience:pupson", "experiment:pupson"],
  },
];

const campaign: WeeklySocialCampaign = {
  id: "campaign:pupson:week",
  brand: "pupsonstuff",
  name: "PupsonStuff weekly growth",
  profile,
  objective: "Drive qualified product sales without sacrificing brand identity.",
  hypothesis: "Relevant creative plus high-intent and lookalike Meta audiences will outperform the current control on contribution-positive sales.",
  ownerIdeaRefs: ["owner-idea:pet-product"],
  actionIds: actions.map((action) => action.id),
  evidenceRefs: ["campaign:pupson:evidence"],
};


function packet(actionsInput:readonly WeeklySocialAction[]=actions){
 return compileWeeklySocialCampaignPacket({
  id:"weekly-social:2026-10-12",ownerUserId:"user:owner",
  weekStartsAt:"2026-10-12T00:00:00.000Z",
  weekEndsAt:"2026-10-19T00:00:00.000Z",
  createdAt:"2026-10-11T20:00:00.000Z",
  campaigns:[{...campaign,actionIds:actionsInput.map(a=>a.id)}],
  actions:actionsInput,evidenceRefs:["weekly:owner-proof"],
 });
}
const identity=(version=3):EffectiveSocialIdentity=>({
 scope:{ownerUserId:"user:owner",brandId:"pupsonstuff",accountId:"account:pupson:instagram",
  platform:"instagram",provider:"hootsuite",providerProfileId:"profile:ig:pupson"},
 version,characterProfileRef:profile.characterProfileRef,
 brandVoiceProfileRef:profile.voiceProfileRef,brandVoiceVersion:1,
 channelVoiceProfileRef:"channel:instagram",channelVoiceVersion:1,
 toneTraits:["warm"],pointOfView:"Original pets",prohibitedPhrases:[],
 disclosureRules:[],escalationRules:[],platformPolicyRef:"policy:instagram",
 fingerprint:"reviewed-identity:account:pupson:instagram:v"+version,
 authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
});
const compile=(actionsInput:readonly WeeklySocialAction[]=actions,version=3)=>
 compileIdentityBoundWeeklySocialPacket({
  verifiedOwnerUserId:"user:owner",packet:packet(actionsInput),
  effectiveIdentities:[identity(version)],
 });
describe("SOCIAL-ID.19 guarded #1136 weekly campaign forward-port",()=>{
 it("ports all four action kinds without unverified auto authorization",()=>{
  const p=packet();
  expect(p.report.totalActions).toBe(4);
  expect(p.report.totalOrganicPublications).toBe(1);
  expect(p.report.totalPublicComments).toBe(1);
  expect(p.report.totalPaidTests).toBe(1);
  expect(p.report.totalDirectorJobs).toBe(1);
  const locked=compile();
  expect(locked.accountBindings).toHaveLength(1);
  expect(locked.canPublish).toBe(false);
  expect(locked.canSpend).toBe(false);
  expect(locked.canComment).toBe(false);
  expect(locked.authority).toBe("PROPOSAL_ONLY");
 });
 it("requires re-review when account identity version changes",()=>{
  const reviewed=compile(),current=compile(actions,4);
  expect(reviewed.compositeFingerprint).not.toBe(current.compositeFingerprint);
  expect(()=>assertIdentityBoundWeeklyReviewCurrent({
   reviewed,current,verifiedReviewerUserId:"user:owner",
   verifiedReceiptFingerprint:reviewed.compositeFingerprint,
  })).toThrow("SOCIAL_WEEKLY_ID_REAPPROVAL_REQUIRED");
 });
 it("requires re-review on changed paid budget even with identical organic post",()=>{
  const reviewed=compile();
  const altered=actions.map(a=>a.kind==="paid_campaign"
    ? {...a,dailyBudgetMinor:a.dailyBudgetMinor+100} : a);
  expect(()=>assertIdentityBoundWeeklyReviewCurrent({
   reviewed,current:compile(altered),
   verifiedReviewerUserId:"user:owner",
   verifiedReceiptFingerprint:reviewed.compositeFingerprint,
  })).toThrow("SOCIAL_WEEKLY_ID_REAPPROVAL_REQUIRED");
 });
 it("also fingerprints comment changes, Director changes and organic copy",()=>{
  const reviewed=compile();
  const variations=[
   actions.map(a=>a.kind==="public_comment"?{...a,text:a.text+" revised"}:a),
   actions.map(a=>a.kind==="director_production"?{...a,productionBriefRef:"changed-brief"}:a),
   actions.map(a=>a.kind==="organic_publication"?{...a,text:"Changed text"}:a),
  ];
  for(const changed of variations)expect(compile(changed).compositeFingerprint)
    .not.toBe(reviewed.compositeFingerprint);
 });
 it("refuses owner mismatch, foreign account, wrong voice and extra identity",()=>{
  const p=packet();
  expect(()=>compileIdentityBoundWeeklySocialPacket({
   verifiedOwnerUserId:"foreign",packet:p,effectiveIdentities:[identity()],
  })).toThrow("SOCIAL_WEEKLY_ID_OWNER_MISMATCH");
  expect(()=>compileIdentityBoundWeeklySocialPacket({
   verifiedOwnerUserId:"user:owner",packet:p,
   effectiveIdentities:[{...identity(),scope:{...identity().scope,accountId:"other"}}],
  })).toThrow("SOCIAL_WEEKLY_ID_MISSING_ACCOUNT_IDENTITY");
  expect(()=>compileIdentityBoundWeeklySocialPacket({
   verifiedOwnerUserId:"user:owner",packet:p,
   effectiveIdentities:[{...identity(),brandVoiceProfileRef:"foreign-voice"}],
  })).toThrow("SOCIAL_WEEKLY_ID_BRAND_OR_VOICE_MISMATCH");
  expect(()=>compileIdentityBoundWeeklySocialPacket({
   verifiedOwnerUserId:"user:owner",packet:p,
   effectiveIdentities:[identity(),{...identity(),scope:{...identity().scope,accountId:"extra"}}],
  })).toThrow("SOCIAL_WEEKLY_ID_EXTRA_IDENTITY_NOT_IN_PACKET");
 });
 it("failing or absent receipt never grants permission",()=>{
  const reviewed=compile();
  expect(()=>assertIdentityBoundWeeklyReviewCurrent({
   reviewed,current:reviewed,verifiedReviewerUserId:"user:owner",
   verifiedReceiptFingerprint:"unverified-string",
  })).toThrow("SOCIAL_WEEKLY_ID_REAPPROVAL_REQUIRED");
  const match=assertIdentityBoundWeeklyReviewCurrent({
   reviewed,current:reviewed,verifiedReviewerUserId:"user:owner",
   verifiedReceiptFingerprint:reviewed.compositeFingerprint,
  });
  expect(match.status).toBe("REVIEW_FINGERPRINT_MATCH_ONLY");
  expect(match.canExecute).toBe(false);
 });
 it("changes fingerprint if supporting evidence or campaign metadata changes",()=>{
  const original=compile();
  const proofChanges=[
   actions.map(a=>a.kind==="organic_publication"
     ? {...a,evidenceRefs:["replaced:evidence"]}:a),
   actions.map(a=>a.kind==="public_comment"
     ? {...a,commercialRelevanceEvidenceRefs:["replaced:commercial-proof"]}:a),
   actions.map(a=>({...a,profile:{...a.profile,evidenceRefs:["changed:profile-proof"]}})),
  ];
  for(const modified of proofChanges){
   const updatedCampaign={...campaign,profile:modified[0]!.profile};
   const changedPacket=compileWeeklySocialCampaignPacket({
      id:"weekly-social:2026-10-12",ownerUserId:"user:owner",
      weekStartsAt:"2026-10-12T00:00:00.000Z",
      weekEndsAt:"2026-10-19T00:00:00.000Z",
      createdAt:"2026-10-11T20:00:00.000Z",
      campaigns:[{...updatedCampaign,actionIds:modified.map(a=>a.id)}],
      actions:modified,evidenceRefs:["weekly:owner-proof"],
   });
   const current=compileIdentityBoundWeeklySocialPacket({
      verifiedOwnerUserId:"user:owner",packet:changedPacket,effectiveIdentities:[identity()],
   });
   expect(current.compositeFingerprint).not.toBe(original.compositeFingerprint);
  }
  const originalPacket=packet();
  const renamed=compileWeeklySocialCampaignPacket({
    id:"weekly-social:2026-10-12",ownerUserId:"user:owner",
    weekStartsAt:"2026-10-12T00:00:00.000Z",weekEndsAt:"2026-10-19T00:00:00.000Z",
    createdAt:"2026-10-11T20:00:00.000Z",
    campaigns:[{...campaign,name:"Changed campaign label"}],
    actions,evidenceRefs:["weekly:owner-proof"],
  });
  expect(renamed.fingerprint).not.toBe(originalPacket.fingerprint);
 });

});
