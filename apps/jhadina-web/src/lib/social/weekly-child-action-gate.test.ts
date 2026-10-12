import {describe,it,expect} from "vitest";
import {InMemoryApprovalReceiptStore} from "@jhadina/action-core";
import {compileIdentityBoundWeeklySocialPacket,compileWeeklySocialCampaignPacket,
 type EffectiveSocialIdentity,type WeeklySocialCampaignPacket,
 type WeeklySocialAction,type WeeklySocialCampaign} from "@jhadina/social-core";
import {requestWeeklySocialReview,type WeeklySocialReviewDependencies} from "./governed-weekly-review";
import {stageReviewedWeeklyChildBatch,type WeeklyChildPlanDependencies,
 type AtomicWeeklyChildBatchStore,type StagedWeeklyChildBatch}
 from "./durable-weekly-child-plans";
import {requestWeeklyChildIndependentApproval,stageApprovedWeeklyChildOutbox,
 recoverStagedWeeklyChildOutbox,type WeeklyChildAuthorizationDependencies,
 type AtomicWeeklyChildOutboxStore,type WeeklyChildOutboxRecord}
 from "./weekly-child-action-gate";

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


async function authHarness(){
 const h=makeHarness();
 const parent=await approved(h);
 await stageReviewedWeeklyChildBatch({
   packetId:parent.packetId,approvalReceiptId:parent.approvalReceiptId,
   reviewedFingerprint:parent.compositeFingerprint,
 },h.deps);
 const approvals=new InMemoryApprovalReceiptStore();
 const outboxRows=new Map<string,WeeklyChildOutboxRecord>();
 let loseAfterCommit=false;
 let dbAvailable=true;
 let beforeTransaction:(()=>void)|undefined;
 const outbox:AtomicWeeklyChildOutboxStore={
   async consumeApprovalAndStageChild(input){
     if(!dbAvailable)throw new Error("CHILD_DB_OFFLINE");
     const key=input.expectedOwnerUserId+":"+input.proposed.packetId+":"+input.proposed.childActionId;
     const existing=outboxRows.get(key);
     if(existing){
       if(existing.approvalReceiptId!==input.proposed.approvalReceiptId ||
         existing.fingerprint!==input.expectedReceiptFingerprint)
         throw new Error("CHILD_DB_IDEMPOTENCY_CONFLICT");
       return structuredClone(existing);
     }
     beforeTransaction?.();
     const packetNow=await h.deps.source.loadPacket(
       input.expectedOwnerUserId,input.proposed.packetId);
     if(!packetNow)throw new Error("CHILD_DB_CANONICAL_UNAVAILABLE");
     const identities=await h.deps.source.loadCurrentIdentities(input.expectedOwnerUserId,packetNow);
     const bound=compileIdentityBoundWeeklySocialPacket({
       packet:packetNow,verifiedOwnerUserId:input.expectedOwnerUserId,
       effectiveIdentities:identities,
     });
     if(bound.compositeFingerprint!==input.expectedPacketFingerprint)
       throw new Error("CHILD_DB_CANONICAL_CHANGED");
     if(!input.proposed.parentApprovalReceiptId ||
       input.proposed.parentApprovalReceiptId!==parent.approvalReceiptId ||
       !input.proposed.childFingerprint ||
       input.proposed.canExecute!==false || input.proposed.canDispatch!==false)
       throw new Error("CHILD_DB_PLAN_INVALID");
     const ok=await approvals.consume(input.proposed.approvalReceiptId,{
       actionId:input.expectedReceiptActionId,
       userId:input.expectedOwnerUserId,
       type:input.expectedReceiptType,
       fingerprint:input.expectedReceiptFingerprint,
     });
     if(!ok)throw new Error("CHILD_DB_RECEIPT_INVALID_OR_REPLAYED");
     outboxRows.set(key,structuredClone(input.proposed));
     if(loseAfterCommit){
       loseAfterCommit=false;
       throw new Error("CHILD_NETWORK_LOST_AFTER_COMMIT");
     }
     return structuredClone(input.proposed);
   },
   async readStagedChild(input){
     if(!dbAvailable)throw new Error("CHILD_DB_OFFLINE");
     const row=outboxRows.get(input.ownerUserId+":"+input.packetId+":"+input.childActionId);
     return row?.approvalReceiptId===input.approvalReceiptId ? structuredClone(row) : null;
   },
 };
 const deps:WeeklyChildAuthorizationDependencies={
   ...h.deps,childApprovalStore:approvals,outbox,
 };
 return {h,parent,deps,approvals,outboxRows,
  setLoseResponse:()=>{loseAfterCommit=true;},
  setDb:(v:boolean)=>{dbAvailable=v;},
  setBeforeTransaction:(fn:()=>void)=>{beforeTransaction=fn;},
 };
}
async function requestAndApprove(
 harness:Awaited<ReturnType<typeof authHarness>>,childActionId:string
){
 const request=await requestWeeklyChildIndependentApproval({
   packetId:harness.parent.packetId,
   parentApprovalReceiptId:harness.parent.approvalReceiptId,
   childActionId,
 },harness.deps);
 await harness.approvals.approve(request.approvalReceiptId,"owner-1");
 return request;
}
function admission(h:Awaited<ReturnType<typeof authHarness>>,actionId:string,receiptId:string){
 return {
  packetId:h.parent.packetId,
  parentApprovalReceiptId:h.parent.approvalReceiptId,
  childActionId:actionId,
  approvalReceiptId:receiptId,
 };
}
describe("SOCIAL-ID.22 independent approvals + inert idempotent outbox",()=>{
 it("requires an independent owner receipt for each of four capabilities and never dispatches",async()=>{
  const h=await authHarness();
  const kinds={
    "organic:1":"public.publish",
    "comment:1":"consequential.outreach",
    "paid:1":"paid-ad.publish",
    "director:1":"take.generate",
  } as const;
  for(const [actionId,capability] of Object.entries(kinds)){
    const pending=await requestWeeklyChildIndependentApproval({
      packetId:h.parent.packetId,parentApprovalReceiptId:h.parent.approvalReceiptId,
      childActionId:actionId,
    },h.deps);
    expect(pending.capability).toBe(capability);
    expect(pending.state).toBe("PENDING_INDEPENDENT_OWNER_APPROVAL");
    expect(pending.canExecute).toBe(false);
    await expect(stageApprovedWeeklyChildOutbox(admission(h,actionId,pending.approvalReceiptId),h.deps))
      .rejects.toThrow("CHILD_DB_RECEIPT_INVALID_OR_REPLAYED");
    await h.approvals.approve(pending.approvalReceiptId,"owner-1");
    const row=await stageApprovedWeeklyChildOutbox(admission(h,actionId,pending.approvalReceiptId),h.deps);
    expect(row.capability).toBe(capability);
    expect(row.state).toBe("AWAITING_DISPATCH_CERTIFICATION");
    expect(row.canExecute).toBe(false);
    expect(row.canDispatch).toBe(false);
    expect(row.requiresFreshActionSecurityPermit).toBe(true);
    const recovered=await recoverStagedWeeklyChildOutbox(
      admission(h,actionId,pending.approvalReceiptId),h.deps);
    expect(recovered).toEqual(row);
  }
  expect(h.outboxRows.size).toBe(4);
 });
 it("recovers lost response after single-use receipt consumption without double insert",async()=>{
   const h=await authHarness(),approved=await requestAndApprove(h,"organic:1");
   h.setLoseResponse();
   await expect(stageApprovedWeeklyChildOutbox(
     admission(h,"organic:1",approved.approvalReceiptId),h.deps))
     .rejects.toThrow("CHILD_NETWORK_LOST_AFTER_COMMIT");
   const recovered=await stageApprovedWeeklyChildOutbox(
     admission(h,"organic:1",approved.approvalReceiptId),h.deps);
   expect(recovered.approvalReceiptId).toBe(approved.approvalReceiptId);
   expect(h.outboxRows.size).toBe(1);
   const changed=await requestWeeklyChildIndependentApproval({
     packetId:h.parent.packetId,parentApprovalReceiptId:h.parent.approvalReceiptId,
     childActionId:"organic:1",
   },h.deps);
   await h.approvals.approve(changed.approvalReceiptId,"owner-1");
   await expect(stageApprovedWeeklyChildOutbox(admission(h,"organic:1",changed.approvalReceiptId),h.deps))
     .rejects.toThrow("CHILD_DB_IDEMPOTENCY_CONFLICT");
 });
 it("denies changed identity or paid budget before accessing child receipt",async()=>{
   const h=await authHarness(),approved=await requestAndApprove(h,"paid:1");
   h.h.setIdentities([effective(2)]);
   await expect(stageApprovedWeeklyChildOutbox(admission(h,"paid:1",approved.approvalReceiptId),h.deps))
     .rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
   h.h.setIdentities([effective()]);
   h.h.setPacket(packet(actions.map(a=>a.kind==="paid_campaign"?
     {...a,dailyBudgetMinor:a.dailyBudgetMinor+100}:a)));
   await expect(stageApprovedWeeklyChildOutbox(admission(h,"paid:1",approved.approvalReceiptId),h.deps))
     .rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
   expect(h.outboxRows.size).toBe(0);
 });
 it("rechecks again under DB transaction boundary; source race cannot stage",async()=>{
   const h=await authHarness(),approved=await requestAndApprove(h,"organic:1");
   h.setBeforeTransaction(()=>h.h.setIdentities([effective(2)]));
   await expect(stageApprovedWeeklyChildOutbox(admission(h,"organic:1",approved.approvalReceiptId),h.deps))
     .rejects.toThrow("CHILD_DB_CANONICAL_CHANGED");
   expect(h.outboxRows.size).toBe(0);
 });
 it("rejects Security deny, foreign session, unknown child and unavailable store",async()=>{
   const h=await authHarness();
   const denied:WeeklyChildAuthorizationDependencies={
     ...h.deps,policy:{evaluate:async()=> "deny" as const},
   };
   await expect(requestWeeklyChildIndependentApproval({
     packetId:h.parent.packetId,parentApprovalReceiptId:h.parent.approvalReceiptId,
     childActionId:"comment:1",
   },denied)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_SECURITY_DENIED");
   expect(h.outboxRows.size).toBe(0);
   h.h.setViewer({userId:"owner-b",sessionId:"session-b"});
   await expect(requestWeeklyChildIndependentApproval({
     packetId:h.parent.packetId,parentApprovalReceiptId:h.parent.approvalReceiptId,
     childActionId:"organic:1",
   },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PACKET_UNAVAILABLE_OR_FOREIGN");
   h.h.setViewer({userId:"owner-1",sessionId:"session-1"});
   await expect(requestWeeklyChildIndependentApproval({
     packetId:h.parent.packetId,parentApprovalReceiptId:h.parent.approvalReceiptId,
     childActionId:"fake:1",
   },h.deps)).rejects.toThrow("SOCIAL_WEEKLY_CHILD_ACTION_NOT_IN_PACKET");
   const approved=await requestAndApprove(h,"organic:1");
   h.setDb(false);
   await expect(stageApprovedWeeklyChildOutbox(
     admission(h,"organic:1",approved.approvalReceiptId),h.deps))
     .rejects.toThrow("CHILD_DB_OFFLINE");
   expect(h.outboxRows.size).toBe(0);
 });
 it("denies corrupt persisted row on readback and is never a transport lease",async()=>{
   const h=await authHarness(),approved=await requestAndApprove(h,"director:1");
   const input=admission(h,"director:1",approved.approvalReceiptId);
   const row=await stageApprovedWeeklyChildOutbox(input,h.deps);
   const key="owner-1:"+h.parent.packetId+":director:1";
   h.outboxRows.set(key,{...row,canDispatch:true as never});
   await expect(recoverStagedWeeklyChildOutbox(input,h.deps))
      .rejects.toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_MISMATCH");
 });
});
