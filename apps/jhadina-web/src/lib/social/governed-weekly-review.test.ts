import {describe,it,expect} from "vitest";
import {InMemoryApprovalReceiptStore} from "@jhadina/action-core";
import {
  compileWeeklySocialCampaignPacket,
  type EffectiveSocialIdentity,
  type WeeklySocialCampaignPacket,
  type WeeklySocialAction,
  type WeeklySocialCampaign,
} from "@jhadina/social-core";
import {
  requestWeeklySocialReview,
  consumeWeeklyReviewIntoChildPlans,
  type WeeklySocialReviewDependencies,
} from "./governed-weekly-review";

const now=Date.now();
const iso=(n:number)=>new Date(now+n).toISOString();
const profile={
  characterProfileRef:"character:pupsonstuff",
  voiceProfileRef:"brand-voice:pupsonstuff",
  evidenceRefs:["brand-review:1"],
};
const organic:WeeklySocialAction={
  id:"organic:1",campaignId:"campaign:1",brand:"pupsonstuff",kind:"organic_publication",
  profile,scheduledAt:iso(60*60_000),
  evidenceRefs:["draft:1"],target:{
    accountId:"account:1",brand:"pupsonstuff",
    platform:"instagram",provider:"hootsuite",providerProfileId:"provider:1",
  },contentProjectRef:"project:1",contentAssetRef:"asset:1",
  text:"Original dog-portrait example",mediaRefs:["asset:image:1"],
};
const comment:WeeklySocialAction={
  id:"comment:1",campaignId:"campaign:1",brand:"pupsonstuff",kind:"public_comment",
  profile,scheduledAt:iso(2*60*60_000),
  evidenceRefs:["radar:1"],platform:"instagram",accountId:"account:1",
  targetContentRef:"post:source:1",text:"Interesting dog portrait!",
  relevanceScore:90,relevanceReason:"Relevant pet portrait conversation",
  commercialRelevanceEvidenceRefs:["relevance:1"],
};
const paid:WeeklySocialAction={
  id:"paid:1",campaignId:"campaign:1",brand:"pupsonstuff",kind:"paid_campaign",
  profile,scheduledAt:iso(3*60*60_000),evidenceRefs:["budget:1"],
  growthBrandId:"brand:pupsonstuff",campaignName:"Portrait Creative Test",
  idempotencyKey:"paid:campaign:1",provider:"markifact",channel:"meta",
  providerAccountId:"meta:account:1",objective:"sales",
  audienceIds:["audience:1"],creativeIds:["creative:1"],currency:"USD",
  dailyBudgetMinor:1000,lifetimeBudgetMinor:3000,
  paidAccelerationStatus:"BOUNDED_PAID_TEST_READY",
  paidAccelerationEvidenceRefs:["paid-readiness:1"],
};
const director:WeeklySocialAction={
  id:"director:1",campaignId:"campaign:1",brand:"pupsonstuff",kind:"director_production",
  profile,scheduledAt:iso(4*60*60_000),evidenceRefs:["director:brief:1"],
  socialContentProjectRef:"project:1",socialAssetRef:"asset:1",
  directorProjectRef:"director-project:1",productionBriefRef:"director-brief:1",
  requiredBy:iso(3*60*60_000),
};
const actions:readonly WeeklySocialAction[]=[organic,comment,paid,director];
const campaign:WeeklySocialCampaign={
  id:"campaign:1",brand:"pupsonstuff",name:"Pups weekly",
  profile,objective:"Brand awareness",hypothesis:"Truthful pet portraits resonate",
  ownerIdeaRefs:["idea:1"],actionIds:actions.map(a=>a.id),evidenceRefs:["campaign:source:1"],
};
const packet=(list:readonly WeeklySocialAction[]=actions):WeeklySocialCampaignPacket=>
  compileWeeklySocialCampaignPacket({
    id:"packet:week:1",ownerUserId:"owner-1",
    weekStartsAt:iso(-60*60_000),weekEndsAt:iso(5*24*60*60_000),
    createdAt:iso(-50*60_000),campaigns:[{...campaign,actionIds:list.map(a=>a.id)}],
    actions:list,evidenceRefs:["weekly:source:1"],
  });
const effective=(version=1):EffectiveSocialIdentity=>({
  scope:{ownerUserId:"owner-1",brandId:"pupsonstuff",accountId:"account:1",
    platform:"instagram",provider:"hootsuite",providerProfileId:"provider:1"},
  version,characterProfileRef:profile.characterProfileRef,
  brandVoiceProfileRef:profile.voiceProfileRef,
  brandVoiceVersion:1,channelVoiceProfileRef:"channel:instagram",
  channelVoiceVersion:1,toneTraits:["warm"],pointOfView:"Real dogs",
  prohibitedPhrases:[],disclosureRules:[],escalationRules:[],
  platformPolicyRef:"policy:ig",
  fingerprint:"identity:account:1:version:"+version,
  authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
});
function setup(){
  const store=new InMemoryApprovalReceiptStore();
  let current=packet(),identities:readonly EffectiveSocialIdentity[]=[effective()];
  let viewer={userId:"owner-1",sessionId:"session-1"};
  const deps:WeeklySocialReviewDependencies={
    now:()=>new Date(now),
    verifyOwner:async()=>viewer,
    source:{
      loadPacket:async(owner,packetId)=>owner==="owner-1"&&packetId===current.id?current:null,
      loadCurrentIdentities:async()=>identities,
    },
    approvalStore:store,
  };
  return {deps,store,
    setPacket:(value:WeeklySocialCampaignPacket)=>{current=value;},
    setIdentities:(value:readonly EffectiveSocialIdentity[])=>{identities=value;},
    setViewer:(value:typeof viewer)=>{viewer=value;},
  };
}
describe("SOCIAL-ID.20 server-owned weekly review + child action planning",()=>{
 it("creates pending, then consumes a real one-time approved store receipt; children remain unauthorized",async()=>{
  const {deps,store}=setup();
  const pending=await requestWeeklySocialReview({packetId:"packet:week:1"},deps);
  expect(pending.receiptStatus).toBe("pending");
  expect(pending.canExecute).toBe(false);
  await store.approve(pending.approvalReceiptId,"owner-1");
  const reviewed=await consumeWeeklyReviewIntoChildPlans({
    packetId:pending.packetId,reviewedFingerprint:pending.compositeFingerprint,
    approvalReceiptId:pending.approvalReceiptId,
  },deps);
  expect(reviewed.childReviewPlans).toHaveLength(4);
  expect(reviewed.childReviewPlans.map(x=>x.actionKind).sort()).toEqual(
    ["director_production","organic_publication","paid_campaign","public_comment"]);
  expect(reviewed.childReviewPlans.every(x=>x.requiresIndependentActionPermit && !x.canExecute)).toBe(true);
  expect(reviewed.canPublish).toBe(false);
  expect(reviewed.canSpend).toBe(false);
  expect(reviewed.canComment).toBe(false);
  await expect(consumeWeeklyReviewIntoChildPlans({
    packetId:pending.packetId,reviewedFingerprint:pending.compositeFingerprint,
    approvalReceiptId:pending.approvalReceiptId,
  },deps)).rejects.toThrow("SOCIAL_WEEKLY_REVIEW_APPROVAL_INVALID_OR_REPLAYED");
 });
 it("does not accept pending or foreign-owner approval",async()=>{
  const {deps,store,setViewer}=setup();
  const p=await requestWeeklySocialReview({packetId:"packet:week:1"},deps);
  await expect(consumeWeeklyReviewIntoChildPlans({
    packetId:p.packetId,reviewedFingerprint:p.compositeFingerprint,
    approvalReceiptId:p.approvalReceiptId,
  },deps)).rejects.toThrow("SOCIAL_WEEKLY_REVIEW_APPROVAL_INVALID_OR_REPLAYED");
  await store.approve(p.approvalReceiptId,"owner-1");
  setViewer({userId:"owner-2",sessionId:"session-foreign"});
  await expect(consumeWeeklyReviewIntoChildPlans({
    packetId:p.packetId,reviewedFingerprint:p.compositeFingerprint,
    approvalReceiptId:p.approvalReceiptId,
  },deps)).rejects.toThrow("SOCIAL_WEEKLY_REVIEW_PACKET_OWNER_OR_ID_INVALID");
 });
 it("rechecks identity version and rejects stale review before receipt consumption",async()=>{
  const {deps,store,setIdentities}=setup();
  const p=await requestWeeklySocialReview({packetId:"packet:week:1"},deps);
  await store.approve(p.approvalReceiptId,"owner-1");
  setIdentities([effective(2)]);
  await expect(consumeWeeklyReviewIntoChildPlans({
    packetId:p.packetId,reviewedFingerprint:p.compositeFingerprint,
    approvalReceiptId:p.approvalReceiptId,
  },deps)).rejects.toThrow("SOCIAL_WEEKLY_REVIEW_STALE_REAPPROVAL_REQUIRED");
  setIdentities([effective()]);
  const ok=await consumeWeeklyReviewIntoChildPlans({
    packetId:p.packetId,reviewedFingerprint:p.compositeFingerprint,
    approvalReceiptId:p.approvalReceiptId,
  },deps);
  expect(ok.childReviewPlans).toHaveLength(4);
 });
 it("rechecks paid budgets, comment copy and supporting evidence before consuming",async()=>{
  for(const modified of [
    actions.map(a=>a.kind==="paid_campaign"?{...a,dailyBudgetMinor:a.dailyBudgetMinor+50}:a),
    actions.map(a=>a.kind==="public_comment"?{...a,text:"Completely different comment"}:a),
    actions.map(a=>a.kind==="organic_publication"?{...a,evidenceRefs:["replacement"]}:a),
  ]){
    const {deps,store,setPacket}=setup();
    const p=await requestWeeklySocialReview({packetId:"packet:week:1"},deps);
    await store.approve(p.approvalReceiptId,"owner-1");
    setPacket(packet(modified));
    await expect(consumeWeeklyReviewIntoChildPlans({
      packetId:p.packetId,reviewedFingerprint:p.compositeFingerprint,
      approvalReceiptId:p.approvalReceiptId,
    },deps)).rejects.toThrow("SOCIAL_WEEKLY_REVIEW_STALE_REAPPROVAL_REQUIRED");
  }
 });
 it("fails closed for lost session, unverified account or unavailable receipt persistence",async()=>{
  const {deps,setViewer,setIdentities}=setup();
  setViewer({userId:"owner-1",sessionId:""});
  await expect(requestWeeklySocialReview({packetId:"packet:week:1"},deps))
    .rejects.toThrow("SOCIAL_WEEKLY_REVIEW_AUTH_REQUIRED");
  setViewer({userId:"owner-1",sessionId:"session-1"});
  setIdentities([]);
  await expect(requestWeeklySocialReview({packetId:"packet:week:1"},deps))
    .rejects.toThrow("SOCIAL_WEEKLY_ID_MISSING_ACCOUNT_IDENTITY");
  setIdentities([effective()]);
  const unavailable:WeeklySocialReviewDependencies={
    ...deps,approvalStore:{
      createPending:async()=>{throw new Error("DB_UNAVAILABLE");},
      approve:async()=>{throw new Error("DB_UNAVAILABLE");},
      consume:async()=>{throw new Error("DB_UNAVAILABLE");},
    },
  };
  await expect(requestWeeklySocialReview({packetId:"packet:week:1"},unavailable))
    .rejects.toThrow("DB_UNAVAILABLE");
 });
});
