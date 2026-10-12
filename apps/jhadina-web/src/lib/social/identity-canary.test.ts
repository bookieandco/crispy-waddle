import {describe,it,expect} from "vitest";
import {runOfflineSocialIdentityCanary} from "./identity-canary";
import type {SocialAccount,SocialAccountIdentity} from "@jhadina/social-core";
const t="2026-10-11T21:00:00Z";
const account:SocialAccount={id:"a",userId:"owner",brand:"pupsonstuff",
 platform:"tiktok",provider:"hootsuite",providerProfileId:"p",displayName:"Pups",
 status:"connected",createdAt:t,updatedAt:t};
const state:SocialAccountIdentity={
 schemaVersion:"jhadina.social.account-identity.v1",
 scope:{ownerUserId:"owner",accountId:"a",brandId:"pupsonstuff",platform:"tiktok",provider:"hootsuite",providerProfileId:"p"},
 version:1,characterProfileRef:"character:pupsonstuff",brandVoiceProfileRef:"brand-voice:pupsonstuff",
 brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
 toneTraits:["warm"],pointOfView:"Real pets",evidenceRefs:["owner"],updatedAt:t,
 authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false};
describe("SOCIAL-ID.16 deterministic non-production canary",()=>{
 it("passes isolated CAS/replay/restore while explicitly denying production certification",async()=>{
   const receipt=await runOfflineSocialIdentityCanary({ownerUserId:"owner",account,initial:state});
   expect(receipt.passedChecks).toEqual(receipt.attemptedChecks);
   expect(receipt.historyLength).toBe(2);
   expect(receipt.category).toBe("OFFLINE_SIMULATION_ONLY");
   expect(receipt.productionRestored).toBe(false);
   expect(receipt.canAuthorizePublication).toBe(false);
 });
 it("rejects foreign owner identity admission",async()=>{
   await expect(runOfflineSocialIdentityCanary({ownerUserId:"owner",account,initial:{
     ...state,scope:{...state.scope,ownerUserId:"foreign"},
   }})).rejects.toThrow("SOCIAL_ID_CANARY_SCOPE_MISMATCH");
 });
});
