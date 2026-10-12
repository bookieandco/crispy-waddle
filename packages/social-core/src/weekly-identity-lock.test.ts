import {describe,it,expect} from "vitest";
import {resolveEffectiveSocialIdentity} from "./effective-identity.js";
import {compileWeeklySocialIdentityLock,assertWeeklyIdentityLockUnchanged} from "./weekly-identity-lock.js";
import type {SocialAccount} from "./types.js";
import type {SocialAccountIdentity} from "./identity-projection.js";
import type {SocialCharacterProfile} from "./character-profiles.js";
import type {BrandVoiceProfile,ChannelVoiceProfile} from "./voice-profiles.js";
const now="2026-10-11T20:00:00Z";
const account:SocialAccount={id:"a",userId:"owner",brand:"pupsonstuff",platform:"tiktok",
 provider:"hootsuite",providerProfileId:"p",displayName:"Pups",status:"connected",createdAt:now,updatedAt:now};
const character:SocialCharacterProfile={id:"character:pups",label:"Pups",brand:"pupsonstuff",
 aliases:[],description:"pet",toneTraits:["warm"],pointOfView:"Real pets",
 voiceProfileRef:"voice:pups",evidenceRefs:["char"],status:"active",authority:"EXPRESSION_ONLY"};
const brandVoice:BrandVoiceProfile={voiceProfileId:"voice:pups",brand:"pupsonstuff",version:1,
 toneTraits:["warm"],vocabularyPreferences:[],prohibitedPhrases:[],claimRefs:[],
 disclosureRules:[],escalationRules:[],approvedAt:now,evidenceRefs:["voice"]};
const channelVoice:ChannelVoiceProfile={channelVoiceProfileId:"channel:tiktok",platform:"tiktok",version:1,
 formality:0.4,emojiDensity:0.3,pacing:"tight",ctaStyle:"direct",hookStyle:"story",
 formatPreferences:[],prohibitedPatterns:[],platformPolicyRef:"policy:tiktok",observedAt:now};
const identity:SocialAccountIdentity={schemaVersion:"jhadina.social.account-identity.v1",
 scope:{ownerUserId:"owner",brandId:"pupsonstuff",accountId:"a",platform:"tiktok",provider:"hootsuite",providerProfileId:"p"},
 version:1,characterProfileRef:"character:pups",brandVoiceProfileRef:"voice:pups",
 brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
 toneTraits:["warm"],pointOfView:"Real pets",evidenceRefs:["v1"],updatedAt:now,
 authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false};
const make=(state=identity)=>resolveEffectiveSocialIdentity({
 account,identity:state,character,brandVoice,channelVoice,verifiedOwnerUserId:"owner"});
const pub={
 brand:"pupsonstuff" as const,text:"Real dogs are wonderful",mediaUrls:["https://example.org/pup.jpg"],
 targets:[{accountId:"a",provider:"hootsuite",providerProfileId:"p",brand:"pupsonstuff" as const,platform:"tiktok" as const}],
};
const actions=(id=make())=>[{actionId:"action:1",publication:pub,identities:[id]}];
describe("SOCIAL-ID.12 immutable weekly identity compatibility",()=>{
 it("binds the exact approval candidate while issuing no publication authority",()=>{
   const lock=compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",actions:actions()});
   expect(lock.authority).toBe("FINGERPRINT_ONLY");
   expect(lock.canPublish).toBe(false);
   expect(lock.requiresExistingPublicPublishApproval).toBe(true);
   expect(()=>assertWeeklyIdentityLockUnchanged({
      approved:lock,verifiedOwnerUserId:"owner",weekRef:"2026-W42",currentActions:actions(),
   })).not.toThrow();
 });
 it("requires reapproval for changed identity version, text, target or week",()=>{
   const approved=compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",actions:actions()});
   const verify=(currentActions:ReturnType<typeof actions>,weekRef="2026-W42")=>
     assertWeeklyIdentityLockUnchanged({approved,verifiedOwnerUserId:"owner",weekRef,currentActions});
   expect(()=>verify(actions(make({...identity,version:2})))).toThrow("SOCIAL_WEEKLY_IDENTITY_REAPPROVAL_REQUIRED");
   expect(()=>verify([{...actions()[0]!,publication:{...pub,text:"Changed copy"}}]))
     .toThrow("SOCIAL_WEEKLY_IDENTITY_REAPPROVAL_REQUIRED");
   expect(()=>verify(actions(),"2026-W43")).toThrow("SOCIAL_WEEKLY_IDENTITY_REAPPROVAL_REQUIRED");
 });
 it("fails closed on other user, missing target, changed brand or duplicate identity",()=>{
   const lock=compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",actions:actions()});
   expect(()=>assertWeeklyIdentityLockUnchanged({
     approved:lock,verifiedOwnerUserId:"other",weekRef:"2026-W42",currentActions:actions(),
   })).toThrow("SOCIAL_WEEKLY_IDENTITY_OWNER_MISMATCH");
   expect(()=>compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",
      actions:[{actionId:"1",publication:pub,identities:[]}]}))
     .toThrow("SOCIAL_WEEKLY_IDENTITY_TARGET_COVERAGE");
   expect(()=>compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",
     actions:[{actionId:"1",publication:pub,identities:[make(),make()]}]}))
     .toThrow("SOCIAL_WEEKLY_IDENTITY_TARGET_COVERAGE");
   expect(()=>compileWeeklySocialIdentityLock({weekRef:"2026-W42",verifiedOwnerUserId:"owner",
     actions:[{actionId:"1",publication:{...pub,targets:[{...pub.targets[0]!,accountId:"other"}]},identities:[make()]}]}))
     .toThrow("SOCIAL_WEEKLY_IDENTITY_TARGET_COVERAGE");
 });
});
