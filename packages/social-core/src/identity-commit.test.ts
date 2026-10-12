import {describe,it,expect} from "vitest";
import {
  fingerprintSocialIdentityChange,
  commitReviewedSocialIdentity,
  initializeReviewedSocialIdentity,
  type SocialIdentityCommitDeps,
} from "./identity-commit.js";
import {proposeSocialIdentityRevision, type SocialAccountIdentity, type SocialIdentityScope} from "./identity-projection.js";
import type {SocialAccount} from "./types.js";
const now="2026-10-11T21:00:00Z";
const scope:SocialIdentityScope={ownerUserId:"owner1",brandId:"pupsonstuff",
  accountId:"acct1",platform:"tiktok",provider:"hootsuite",providerProfileId:"p1"};
const account:SocialAccount={
  id:"acct1",userId:"owner1",brand:"pupsonstuff",platform:"tiktok",
  provider:"hootsuite",providerProfileId:"p1",displayName:"Pups",
  status:"connected",createdAt:now,updatedAt:now,
};
const initial:SocialAccountIdentity={
  schemaVersion:"jhadina.social.account-identity.v1",scope,version:1,
  characterProfileRef:"character:pupsonstuff",brandVoiceProfileRef:"brand-voice:pupsonstuff",
  brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
  toneTraits:["warm","playful"],pointOfView:"Real pets",evidenceRefs:["owner:char"],
  updatedAt:now,authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
};
function makeDeps(initialState:SocialAccountIdentity|null=initial) {
  let current=initialState ? structuredClone(initialState) : null;
  const versions:SocialAccountIdentity[]=current?[structuredClone(current)]:[];
  const receipts=new Set<string>();
  const ledger: Array<{proposal:string;receipt:string;version:number}>=[];
  const deps:SocialIdentityCommitDeps={
    loadAccount:async()=>account,
    verifyApprovalReceipt:async (id,fingerprint)=>({
      proposalId:"proposal-2",ownerUserId:"owner1",accountId:"acct1",
      receiptId:id,status:"APPROVED",fingerprint,
      expiresAt:"2026-12-11T21:00:00Z",
    }),
    store:{
      load:async()=>current?structuredClone(current):null,
      commit:async (_scope,record)=>{
        if(receipts.has(record.verifiedApprovalReceiptId))
          throw new Error("SOCIAL_ID_DB_APPROVAL_REPLAY");
        if((current?.version??0)!==record.expectedVersion)
          throw new Error("SOCIAL_ID_DB_CAS_CONFLICT");
        receipts.add(record.verifiedApprovalReceiptId);
        current=structuredClone(record.next);
        versions.push(structuredClone(record.next));
        ledger.push({proposal:record.proposalId,receipt:record.verifiedApprovalReceiptId,
          version:record.next.version});
      },
    },
  };
  return {deps,versions,ledger,getCurrent:()=>current};
}
function proposal(current:SocialAccountIdentity=initial){
 return proposeSocialIdentityRevision({
   current,id:"proposal-2",proposedToneTraits:["warm","gentle"],
   proposedPointOfView:"Real pets and care tips",
   independentEvidenceRefs:["provider:one","provider:two"],
   rationale:"Owner-reviewed evidence",proposedAt:now,
 });
}
describe("SOCIAL-ID.15 verified transactional identity lifecycle",()=>{
 it("commits only exact scope, version and server-verified owner receipt",async()=>{
   const {deps,versions}=makeDeps();
   const p=proposal(),fp=fingerprintSocialIdentityChange({scope,proposal:p});
   expect(fp).toContain("provider:one");
   const next=await commitReviewedSocialIdentity({
     verifiedOwnerUserId:"owner1",proposal:p,approvalReceiptId:"receipt-2",decidedAt:now,
   },deps);
   expect(next.version).toBe(2);
   expect(next.canPublish).toBe(false);
   expect(next.canChangeJhadinaPersonality).toBe(false);
   expect(versions.map(x=>x.version)).toEqual([1,2]);
 });
 it("denies owner spoofing, scope mixing and unapproved receipt",async()=>{
   const {deps}=makeDeps();
   await expect(commitReviewedSocialIdentity({
     verifiedOwnerUserId:"owner2",proposal:proposal(),approvalReceiptId:"r",decidedAt:now,
   },deps)).rejects.toThrow("SOCIAL_ID_COMMIT_OWNER_DENIED");
   await expect(commitReviewedSocialIdentity({
     verifiedOwnerUserId:"owner1",proposal:{...proposal(),scope:{...scope,brandId:"atwood-bookie"}},
     approvalReceiptId:"r",decidedAt:now,
   },deps)).rejects.toThrow("SOCIAL_ID_SCOPE_MISMATCH");
   await expect(commitReviewedSocialIdentity({
     verifiedOwnerUserId:"owner1",proposal:proposal(),approvalReceiptId:"r",decidedAt:now,
   },{...deps,verifyApprovalReceipt:async()=>null})).rejects.toThrow("SOCIAL_ID_COMMIT_APPROVAL_UNVERIFIED");
 });
 it("blocks replay and concurrent stale-version overwrites",async()=>{
   const {deps,versions}=makeDeps();
   const input={verifiedOwnerUserId:"owner1",proposal:proposal(),
     approvalReceiptId:"r1",decidedAt:now};
   const outcomes=await Promise.allSettled([
     commitReviewedSocialIdentity(input,deps),
     commitReviewedSocialIdentity({...input,approvalReceiptId:"r2"},deps),
   ]);
   expect(outcomes.filter(x=>x.status==="fulfilled")).toHaveLength(1);
   expect(outcomes.filter(x=>x.status==="rejected")).toHaveLength(1);
   expect(versions).toHaveLength(2);
   await expect(commitReviewedSocialIdentity(input,deps)).rejects.toThrow("SOCIAL_ID_STALE_REVISION");
 });
 it("requires reviewed receipt and version-zero CAS even for first initialization",async()=>{
   const {deps,versions}=makeDeps(null);
   const initialInput={verifiedOwnerUserId:"owner1",account,proposedInitial:initial,
     proposalId:"proposal-2",approvalReceiptId:"r-initial",decidedAt:now};
   const x=await initializeReviewedSocialIdentity(initialInput,deps);
   expect(x.version).toBe(1);
   expect(versions).toHaveLength(1);
   await expect(initializeReviewedSocialIdentity(initialInput,deps))
     .rejects.toThrow("SOCIAL_ID_COMMIT_ALREADY_INITIALIZED");
 });
 it("requires fresh, owner-bound receipt for every revision",async()=>{
   const {deps}=makeDeps();
   await expect(commitReviewedSocialIdentity({
     verifiedOwnerUserId:"owner1",proposal:proposal(),approvalReceiptId:"r",
     decidedAt:now,
   },{...deps,verifyApprovalReceipt:async()=>({
     proposalId:"proposal-2",ownerUserId:"owner1",accountId:"acct-other",
     receiptId:"r",fingerprint:"mismatch",status:"APPROVED",
     expiresAt:"2026-12-11T21:00:00Z",
   })})).rejects.toThrow("SOCIAL_ID_COMMIT_APPROVAL_UNVERIFIED");
 });
});
