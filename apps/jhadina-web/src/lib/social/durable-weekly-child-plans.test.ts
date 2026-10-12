import {describe,it,expect} from "vitest";
import {InMemoryApprovalReceiptStore} from "@jhadina/action-core";
import {
  compileIdentityBoundWeeklySocialPacket,
  compileWeeklySocialCampaignPacket,
  type EffectiveSocialIdentity,
  type WeeklySocialCampaignPacket,
  type WeeklySocialAction,
  type WeeklySocialCampaign,
} from "@jhadina/social-core";
import {
  requestWeeklySocialReview,
  type WeeklySocialReviewDependencies,
} from "./governed-weekly-review";
import {
  stageReviewedWeeklyChildBatch,
  recoverReviewedWeeklyChildBatch,
  preflightWeeklyChildAtDispatch,
  type WeeklyChildPlanDependencies,
  type AtomicWeeklyChildBatchStore,
  type StagedWeeklyChildBatch,
} from "./durable-weekly-child-plans";
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

function makeHarness(){
  const base=setup();
  const persisted=new Map<string,StagedWeeklyChildBatch>();
  let failAfterCommit=false;
  let dbAvailable=true;
  const key=(user:string,id:string)=>user+":"+id;
  const planStore:AtomicWeeklyChildBatchStore={
    async commitApprovedBatch(input){
      if(!dbAvailable)throw new Error("WEEKLY_DB_UNAVAILABLE");
      const k=key(input.ownerUserId,input.packetId);
      const existing=persisted.get(k);
      if(existing){
        if(existing.approvalReceiptId!==input.approvalReceiptId ||
          existing.compositeFingerprint!==input.expectedFingerprint)
          throw new Error("WEEKLY_DB_CONFLICT");
        return structuredClone(existing);
      }
      // The fixture emulates a single SQL transaction with a shared Map.
      // Production must re-check packet+identity revisions under DB locks.
      const current=await base.deps.source.loadPacket(input.ownerUserId,input.packetId);
      if(!current)throw new Error("WEEKLY_DB_PACKET_GONE");
      const identities=await base.deps.source.loadCurrentIdentities(input.ownerUserId,current);
      const bound=compileIdentityBoundWeeklySocialPacket({
        packet:current,effectiveIdentities:identities,
        verifiedOwnerUserId:input.ownerUserId,
      });
      if(bound.compositeFingerprint!==input.expectedFingerprint)
        throw new Error("WEEKLY_DB_REVISION_CHANGED");
      const ok=await base.store.consume(input.approvalReceiptId,{
        actionId:input.expectedReceiptActionId,userId:input.ownerUserId,
        type:input.expectedReceiptType,fingerprint:input.expectedFingerprint,
      });
      if(!ok)throw new Error("WEEKLY_DB_APPROVAL_INVALID");
      persisted.set(k,structuredClone(input.batch));
      if(failAfterCommit){
        failAfterCommit=false;
        throw new Error("WEEKLY_NETWORK_LOST_AFTER_COMMIT");
      }
      return structuredClone(input.batch);
    },
    async readBatch(owner,packetId,receiptId){
      if(!dbAvailable)throw new Error("WEEKLY_DB_UNAVAILABLE");
      const value=persisted.get(key(owner,packetId));
      return value?.approvalReceiptId===receiptId?structuredClone(value):null;
    },
  };
  const deps:WeeklyChildPlanDependencies={
    verifyOwner:base.deps.verifyOwner,
    source:base.deps.source,
    batches:planStore,
    now:base.deps.now,
  };
  return {
    ...base,deps,
    persisted,
    getDbKey:()=>key("owner-1","packet:week:1"),
    setFailAfterCommit:()=>{failAfterCommit=true;},
    setDbAvailable:(next:boolean)=>{dbAvailable=next;},
    restarted:()=>({...deps}),
  };
}
async function approved(h:ReturnType<typeof makeHarness>){
  const receipt=await requestWeeklySocialReview({packetId:"packet:week:1"},{
    ...h.deps,approvalStore:h.store,
  });
  await h.store.approve(receipt.approvalReceiptId,"owner-1");
  return receipt;
}
describe("SOCIAL-ID.21 recoverable weekly child planning",()=>{
  it("stages four non-executable children and restores them after process restart",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    const input={
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    };
    const batch=await stageReviewedWeeklyChildBatch(input,h.deps);
    expect(batch.children).toHaveLength(4);
    expect(batch.canExecute).toBe(false);
    expect(batch.canPublish).toBe(false);
    expect(batch.canSpend).toBe(false);
    expect(batch.children.every(x=>x.state==="AWAITING_INDEPENDENT_ACTION_PERMIT")).toBe(true);
    const afterRestart=await recoverReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
    },h.restarted());
    expect(afterRestart).toEqual(batch);
    for(const actionId of actions.map(a=>a.id)){
      const result=await preflightWeeklyChildAtDispatch({
        packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,actionId,
      },h.restarted());
      expect(result.actionId).toBe(actionId);
      expect(result.status).toBe("REVALIDATED_ONLY");
      expect(result.canExecute).toBe(false);
      expect(result.requiresIndependentActionCorePermit).toBe(true);
    }
  });
  it("recovers after commit succeeded but response was lost, without consuming twice",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    const input={
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    };
    h.setFailAfterCommit();
    await expect(stageReviewedWeeklyChildBatch(input,h.deps))
      .rejects.toThrow("WEEKLY_NETWORK_LOST_AFTER_COMMIT");
    expect(h.persisted.size).toBe(1);
    const resumed=await stageReviewedWeeklyChildBatch(input,h.restarted());
    expect(resumed.children).toHaveLength(4);
    expect(h.persisted.size).toBe(1);
    await expect(stageReviewedWeeklyChildBatch({
      ...input,approvalReceiptId:"different",
    },h.deps)).rejects.toThrow("WEEKLY_DB_CONFLICT");
  });
  it("fails closed when identity changes before staging and receipt remains unconsumed",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    h.setIdentities([effective(2)]);
    await expect(stageReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_REAPPROVAL_REQUIRED");
    expect(h.persisted.size).toBe(0);
    h.setIdentities([effective()]);
    const good=await stageReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    },h.deps);
    expect(good.children).toHaveLength(4);
  });
  it("rejects drift after persistence at exact dispatch preflight",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    await stageReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    },h.deps);
    h.setPacket(packet(actions.map(a=>a.kind==="paid_campaign"?
      {...a,dailyBudgetMinor:a.dailyBudgetMinor+100}:a)));
    await expect(preflightWeeklyChildAtDispatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,actionId:"paid:1",
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
    h.setPacket(packet());
    h.setIdentities([effective(3)]);
    await expect(recoverReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
  });
  it("rejects foreign sessions, mismatched persisted rows and invented child ids",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    await stageReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    },h.deps);
    await expect(preflightWeeklyChildAtDispatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,actionId:"forged",
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_ACTION_NOT_IN_PACKET");
    const key=h.getDbKey();
    const existing=h.persisted.get(key)!;
    h.persisted.set(key,{...existing,children:existing.children.map(child=>
      child.actionId==="organic:1"?{...child,canExecute:true as never}:child)});
    await expect(preflightWeeklyChildAtDispatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,actionId:"organic:1",
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
    h.setViewer({userId:"foreign",sessionId:"session"});
    await expect(recoverReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
    },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PACKET_UNAVAILABLE_OR_FOREIGN");
  });
  it("never silently returns synthetic plans during database outage",async()=>{
    const h=makeHarness(),receipt=await approved(h);
    h.setDbAvailable(false);
    await expect(stageReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
      reviewedFingerprint:receipt.compositeFingerprint,
    },h.deps)).rejects.toThrow("WEEKLY_DB_UNAVAILABLE");
    await expect(recoverReviewedWeeklyChildBatch({
      packetId:receipt.packetId,approvalReceiptId:receipt.approvalReceiptId,
    },h.deps)).rejects.toThrow("WEEKLY_DB_UNAVAILABLE");
  });
});
