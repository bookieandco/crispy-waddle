import {describe,it,expect} from "vitest";
import {createContentProject,getSocialCharacterProfile,type SocialAccountIdentity} from "@jhadina/social-core";
import type {SocialAccount,BrandVoiceProfile,ChannelVoiceProfile} from "@jhadina/social-core";
import {buildDirectorBriefFromSocial,acceptDirectorAssetIntoSocial} from "./director-bridge";
const at="2026-10-11T20:00:00Z";
const character=getSocialCharacterProfile("character:pupsonstuff")!;
const account:SocialAccount={id:"pups-tt",userId:"owner-a",brand:"pupsonstuff",platform:"tiktok",
 provider:"hootsuite",providerProfileId:"pups-prof",displayName:"Pups",status:"connected",
 createdAt:at,updatedAt:at};
const identity:SocialAccountIdentity={
 schemaVersion:"jhadina.social.account-identity.v1",
 scope:{ownerUserId:"owner-a",brandId:"pupsonstuff",accountId:"pups-tt",
 platform:"tiktok",provider:"hootsuite",providerProfileId:"pups-prof"},version:2,
 characterProfileRef:character.id,brandVoiceProfileRef:character.voiceProfileRef,
 brandVoiceVersion:1,channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
 toneTraits:["warm","informative"],pointOfView:"Real pets and useful demonstrations",
 evidenceRefs:["reviewed:identity"],updatedAt:at,
 authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
};
const brandVoice:BrandVoiceProfile={
 voiceProfileId:character.voiceProfileRef,brand:"pupsonstuff",version:1,
 toneTraits:["warm"],vocabularyPreferences:[],prohibitedPhrases:["fake claims"],
 claimRefs:[],disclosureRules:["paid disclosure"],escalationRules:[],
 approvedAt:at,evidenceRefs:["voice:approved"],
};
const channelVoice:ChannelVoiceProfile={
 channelVoiceProfileId:"channel:tiktok",platform:"tiktok",version:1,
 formality:0.3,emojiDensity:0.2,pacing:"tight",ctaStyle:"honest",hookStyle:"curious",
 formatPreferences:[],prohibitedPatterns:[],platformPolicyRef:"tiktok:policy",observedAt:at,
};
const project=createContentProject({
 id:"pup-proj",brand:"pupsonstuff",authorityPositionRef:"brand:pups",
 pillarRef:"education",bigIdeaRef:"pets",primaryJob:"useful",origin:"ai_generated",
 characterProfileRef:character.id,voiceProfileRef:character.voiceProfileRef,
 evidenceRefs:["creative:review"],createdAt:at,anchor:{
 id:"anchor",kind:"short_video",platform:"tiktok",transformation:"original",
 text:"Show how to personalize the real pet photo",mediaRefs:[],evidenceRefs:["creative:review"],
 }});
const context=(state=identity)=>({
 account,identity:state,character,brandVoice,channelVoice,verifiedOwnerUserId:"owner-a",
});
describe("SOCIAL-ID.11 Director identity lineage",()=>{
 it("locks exact approved account version into Director brief and preserves expression limits",()=>{
   const brief=buildDirectorBriefFromSocial(project,"anchor",{
     directorProjectId:"director:pup",identityContext:context(),
   });
   expect(brief.evidenceRefs.some(ref=>ref.startsWith("social-effective-identity:"))).toBe(true);
   expect(brief.intent).toContain("identity version 2");
   expect(brief.intent).toContain("Account point of view:");
   expect(brief.intent).toContain("cannot change the underlying brand identity");
 });
 it("rejects identity for a different account or platform",()=>{
   expect(()=>buildDirectorBriefFromSocial(project,"anchor",{
     directorProjectId:"director:pup",identityContext:context({
       ...identity,scope:{...identity.scope,accountId:"other"},
     }),
   })).toThrow("SOCIAL_ID_SCOPE_MISMATCH");
   expect(()=>buildDirectorBriefFromSocial(project,"anchor",{
     directorProjectId:"director:pup",identityContext:context({
       ...identity,scope:{...identity.scope,platform:"youtube"},
     }),
   })).toThrow("SOCIAL_ID_SCOPE_MISMATCH");
 });
 it("blocks receipt from missing or changed identity context",()=>{
   const brief=buildDirectorBriefFromSocial(project,"anchor",{
     directorProjectId:"director:pup",identityContext:context(),
   });
   const fake={project,receiptId:"r",brief,asset:{} as any,review:{} as any};
   expect(()=>acceptDirectorAssetIntoSocial(fake))
      .toThrow("SOCIAL_DIRECTOR_IDENTITY_CONTEXT_REQUIRED");
   expect(()=>acceptDirectorAssetIntoSocial({
     ...fake,identityContext:context({...identity,version:3}),
   })).toThrow("SOCIAL_DIRECTOR_IDENTITY_CHANGED_REAPPROVAL_REQUIRED");
 });
});
