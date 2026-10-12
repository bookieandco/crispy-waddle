import {describe,it,expect} from "vitest";
import {explainSocialAccountIdentity} from "./account-identity-explanation";
import type {SocialAccount,SocialObservation} from "@jhadina/social-core";
const at="2026-10-11T20:00:00Z";
const accounts:SocialAccount[]=[
  {id:"pups",userId:"owner1",brand:"pupsonstuff",provider:"h",
   providerProfileId:"h-pups",platform:"tiktok",displayName:"Pups",status:"connected",
   createdAt:at,updatedAt:at},
  {id:"atwood",userId:"owner2",brand:"atwood-bookie",provider:"h",
   providerProfileId:"h-atwood",platform:"tiktok",displayName:"Atwood",status:"connected",
   createdAt:at,updatedAt:at},
];
const observations:SocialObservation[]=[
  {id:"one",userId:"owner1",brand:"pupsonstuff",kind:"performance",source:"provider",
   provider:"h",providerProfileId:"h-pups",platform:"tiktok",accountId:"pups",
   observedAt:at,contentId:"one",evidence:["provider:1"],metrics:{views:100}},
  {id:"two",userId:"owner2",brand:"atwood-bookie",kind:"performance",source:"provider",
   provider:"h",providerProfileId:"h-atwood",platform:"tiktok",accountId:"atwood",
   observedAt:at,contentId:"two",evidence:["provider:2"],metrics:{views:100}},
];
describe("SOCIAL-ID.13 read only identity introspection",()=>{
 it("only uses authenticated connected accounts and aligned observed evidence",async()=>{
   const x=await explainSocialAccountIdentity({verifiedUserId:"owner1",accounts,observations,
     selectedAccountIds:["pups","atwood"],observedAt:at});
   expect(x.recommendation).toContain("Pups");
   expect(x.recommendation).not.toContain("Atwood");
   expect(x.evidence).toHaveLength(1);
   expect(x.authority).toBe("READ_ONLY");
 });
 it("does not fabricate durable identity growth from raw performance",async()=>{
   const x=await explainSocialAccountIdentity({verifiedUserId:"owner1",accounts,observations,
     selectedAccountIds:["pups"],observedAt:at});
   expect(x.recommendation).toContain("no verified persisted account-identity snapshot");
   expect(x.recommendation).toContain("NOT a verified identity change");
 });
});
