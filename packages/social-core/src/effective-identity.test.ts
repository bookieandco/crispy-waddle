import {describe,it,expect} from "vitest";
import type {SocialAccount} from "./types.js";
import type {SocialAccountIdentity} from "./identity-projection.js";
import type {SocialCharacterProfile} from "./character-profiles.js";
import type {BrandVoiceProfile,ChannelVoiceProfile} from "./voice-profiles.js";
import {resolveEffectiveSocialIdentity,assertEffectiveSocialIdentityTarget} from "./effective-identity.js";
const t="2026-10-11T20:00:00Z";
export const account:SocialAccount={id:"a1",userId:"owner1",brand:"pupsonstuff",
 platform:"tiktok",provider:"hootsuite",providerProfileId:"p1",displayName:"Pups",
 status:"connected",createdAt:t,updatedAt:t};
export const character:SocialCharacterProfile={id:"character:pupsonstuff",brand:"pupsonstuff",
 label:"Pups",description:"pets",aliases:["pups"],toneTraits:["warm"],pointOfView:"Pets first",
 voiceProfileRef:"brand-voice:pups",evidenceRefs:["character:approved"],status:"active",authority:"EXPRESSION_ONLY"};
export const brandVoice:BrandVoiceProfile={voiceProfileId:"brand-voice:pups",brand:"pupsonstuff",
 version:2,toneTraits:["warm"],vocabularyPreferences:[],prohibitedPhrases:["fabricated claim"],
 claimRefs:[],disclosureRules:["paid disclosure"],escalationRules:["safety review"],
 approvedAt:t,evidenceRefs:["approved:voice"]};
export const channelVoice:ChannelVoiceProfile={channelVoiceProfileId:"channel-voice:tiktok",platform:"tiktok",
 version:4,formality:0.3,emojiDensity:0.2,pacing:"tight",ctaStyle:"gentle",hookStyle:"clear",
 formatPreferences:[],prohibitedPatterns:[],platformPolicyRef:"policy:tiktok-v4",observedAt:t};
export const identity:SocialAccountIdentity={schemaVersion:"jhadina.social.account-identity.v1",
 scope:{ownerUserId:"owner1",brandId:"pupsonstuff",accountId:"a1",platform:"tiktok",
 provider:"hootsuite",providerProfileId:"p1"},version:3,
 characterProfileRef:"character:pupsonstuff",brandVoiceProfileRef:"brand-voice:pups",
 brandVoiceVersion:2,channelVoiceProfileRef:"channel-voice:tiktok",channelVoiceVersion:4,
 toneTraits:["warm","playful"],pointOfView:"Original pets, not made-up stories",
 evidenceRefs:["proof"],updatedAt:t,authority:"EXPRESSION_ONLY",
 canPublish:false,canChangeJhadinaPersonality:false};
export const make=()=>resolveEffectiveSocialIdentity({
 account,identity,character,brandVoice,channelVoice,verifiedOwnerUserId:"owner1"});
describe("SOCIAL-ID.10 effective identity",()=>{
 it("applies reviewed account expression without losing brand safety restrictions",()=>{
   const result=make();
   expect(result.version).toBe(3);
   expect(result.toneTraits).toEqual(["warm","playful"]);
   expect(result.prohibitedPhrases).toContain("fabricated claim");
   expect(result.disclosureRules).toContain("paid disclosure");
   expect(result.canPublish).toBe(false);
   expect(result.canChangeJhadinaPersonality).toBe(false);
   expect(Object.isFrozen(result)).toBe(true);
 });
 it("changes equality fingerprint if account identity evolves",()=>{
   const original=make();
   const next=resolveEffectiveSocialIdentity({
     account,identity:{...identity,version:4,pointOfView:"Real pets and practical examples"},
     character,brandVoice,channelVoice,verifiedOwnerUserId:"owner1"});
   expect(next.fingerprint).not.toEqual(original.fingerprint);
 });
 it("rejects forged owner and foreign platform/account/brand",()=>{
   expect(()=>resolveEffectiveSocialIdentity({account,identity,character,brandVoice,channelVoice,
     verifiedOwnerUserId:"owner2"})).toThrow("SOCIAL_EFFECTIVE_OWNER_MISMATCH");
   expect(()=>resolveEffectiveSocialIdentity({account:{...account,brand:"atwood-bookie"},
     identity,character,brandVoice,channelVoice,verifiedOwnerUserId:"owner1"}))
     .toThrow("SOCIAL_ID_SCOPE_MISMATCH");
   expect(()=>resolveEffectiveSocialIdentity({account:{...account,id:"other"},
     identity,character,brandVoice,channelVoice,verifiedOwnerUserId:"owner1"}))
     .toThrow("SOCIAL_ID_SCOPE_MISMATCH");
   expect(()=>resolveEffectiveSocialIdentity({account,identity,
     character,brandVoice,channelVoice:{...channelVoice,platform:"youtube"},
     verifiedOwnerUserId:"owner1"})).toThrow("SOCIAL_EFFECTIVE_PROFILE_OR_VERSION_MISMATCH");
 });
 it("rejects outdated voice versions and speaker impersonation",()=>{
   expect(()=>resolveEffectiveSocialIdentity({account,identity,
     character,brandVoice:{...brandVoice,version:3},channelVoice,
     verifiedOwnerUserId:"owner1"})).toThrow("SOCIAL_EFFECTIVE_PROFILE_OR_VERSION_MISMATCH");
   expect(()=>resolveEffectiveSocialIdentity({account,
     identity:{...identity,speakerIdentityRef:"unapproved-speaker"},
     character,brandVoice,channelVoice,verifiedOwnerUserId:"owner1"}))
     .toThrow("SOCIAL_EFFECTIVE_SPEAKER_MISMATCH");
 });
 it("checks exact target without granting a publication permit",()=>{
   const result=make();
   expect(()=>assertEffectiveSocialIdentityTarget(result,{
     accountId:"another",brand:"pupsonstuff",provider:"hootsuite",
     providerProfileId:"p1",platform:"tiktok"},"owner1")).toThrow("SOCIAL_EFFECTIVE_TARGET_MISMATCH");
   expect(()=>assertEffectiveSocialIdentityTarget(result,{
     accountId:"a1",brand:"pupsonstuff",provider:"hootsuite",
     providerProfileId:"p1",platform:"tiktok"},"owner1")).not.toThrow();
 });
});
