import {describe,it,expect,vi} from "vitest";
import {createSupabaseSocialIdentityReader,decodeStoredSocialIdentity,
  createPrivilegedSocialIdentityCommitStore,createSupabaseIdentityApprovalVerifier} from "./supabase-identity-repository";
const scope={ownerUserId:"user-1",brandId:"pupsonstuff" as const,
  accountId:"account-1",platform:"tiktok" as const,provider:"hootsuite",providerProfileId:"provider-1"};
const saved={schemaVersion:"jhadina.social.account-identity.v1" as const,
  scope,version:2,characterProfileRef:"character:pupsonstuff",brandVoiceProfileRef:"brand-voice:pupsonstuff",
  brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
  toneTraits:["warm"],pointOfView:"Real pets",evidenceRefs:["receipt"],updatedAt:"2026-10-11T00:00:00Z",
  authority:"EXPRESSION_ONLY" as const,canPublish:false as const,canChangeJhadinaPersonality:false as const};
function readClient(row:unknown,err:unknown=null) {
  const maybeSingle=vi.fn(async()=>({data:row,error:err}));
  const chain={
    select:vi.fn(()=>chain),
    eq:vi.fn(()=>chain),
    maybeSingle,
  };
  return {from:vi.fn(()=>chain),chain};
}
describe("SOCIAL-ID.15 strict RLS reader, version decoder and atomic CAS",()=>{
 it("loads only owner-scoped records and rejects foreign owner early",async()=>{
   const mock=readClient({user_id:"user-1",account_id:"account-1",brand:"pupsonstuff",platform:"tiktok",
     provider:"hootsuite",provider_profile_id:"provider-1",version:2,snapshot:saved});
   const reader=createSupabaseSocialIdentityReader({client:mock as any,verifiedOwnerUserId:"user-1"});
   expect((await reader.load(scope))?.version).toBe(2);
   expect(mock.chain.eq).toHaveBeenCalledTimes(6);
   await expect(reader.load({...scope,ownerUserId:"other"})).rejects.toThrow("SOCIAL_ID_REPO_OWNER_MISMATCH");
 });
 it("never trusts mismatched or malformed payloads",async()=>{
   expect(()=>decodeStoredSocialIdentity({...saved,scope:{...scope,accountId:"other"}},scope))
      .toThrow("SOCIAL_ID_PERSISTED_SCOPE_OR_SCHEMA_INVALID");
   expect(()=>decodeStoredSocialIdentity({...saved,canPublish:true},scope))
      .toThrow("SOCIAL_ID_PERSISTED_SCOPE_OR_SCHEMA_INVALID");
   const client=readClient({...{user_id:"user-1",account_id:"account-1",brand:"pupsonstuff",
      platform:"tiktok",provider:"hootsuite",provider_profile_id:"provider-1",version:99},
      snapshot:saved});
   await expect(createSupabaseSocialIdentityReader({client:client as any,verifiedOwnerUserId:"user-1"})
      .load(scope)).rejects.toThrow("SOCIAL_ID_REPO_VERSION_MISMATCH");
 });
 it("rejects DB outages instead of presenting fabricated empty memory",async()=>{
   const client=readClient(null,{code:"57P03"});
   await expect(createSupabaseSocialIdentityReader({client:client as any,verifiedOwnerUserId:"user-1"})
      .load(scope)).rejects.toThrow("SOCIAL_ID_REPO_READ_UNAVAILABLE");
 });
 it("passes exact receipt, scope and expected version to an atomic server-only RPC",async()=>{
   const rpc=vi.fn(async()=>({data:3,error:null}));
   const client={...readClient(null),rpc};
   const writer=createPrivilegedSocialIdentityCommitStore({
     client:client as any,verifiedOwnerUserId:"user-1",
   });
   await writer.commit(scope,{
     proposalId:"proposal-1",expectedVersion:2,next:{...saved,version:3},
     verifiedApprovalReceiptId:"receipt-1",approvalFingerprint:"fingerprint-1",
   });
   expect(rpc).toHaveBeenCalledWith("jhadina_social_commit_identity_snapshot",expect.objectContaining({
     p_account_id:"account-1",p_owner_user_id:"user-1",p_expected_version:2,
     p_receipt_id:"receipt-1",p_fingerprint:"fingerprint-1",
   }));
   await expect(writer.commit(scope,{
     proposalId:"proposal-2",expectedVersion:1,next:{...saved,version:3},
     verifiedApprovalReceiptId:"receipt-2",approvalFingerprint:"fingerprint-2",
   })).rejects.toThrow("SOCIAL_ID_REPO_CAS_VERSION_INVALID");
 });
 it("accepts only unconsumed identity-type receipt matching supplied fingerprint",async()=>{
   const client=readClient({
     id:"r",action_id:"social-identity:account-1:proposal-1",user_id:"user-1",
     type:"social.identity.modify",fingerprint:"fp",status:"approved",
     expires_at:"2026-12-11T20:00:00Z",
   });
   const verify=createSupabaseIdentityApprovalVerifier({
     client:client as any,verifiedOwnerUserId:"user-1",
   });
   expect(await verify("r","fp")).toMatchObject({
     accountId:"account-1",proposalId:"proposal-1",ownerUserId:"user-1",status:"APPROVED",
   });
 });
});
