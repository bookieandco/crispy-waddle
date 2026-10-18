import { describe, expect, it } from "vitest";
import type { SocialAccount } from "./types.js";
import type { SocialCharacterProfile } from "./character-profiles.js";
import type { BrandVoiceProfile, ChannelVoiceProfile } from "./voice-profiles.js";
import {
  assertSocialIdentityScope, createSocialAccountIdentity,
  decideSocialIdentityRevision, proposeSocialIdentityRevision,
} from "./identity-projection.js";

const at = "2026-10-11T20:00:00Z";
const account: SocialAccount = {
  id:"acct-pups-1", userId:"owner-a", brand:"pupsonstuff", provider:"hootsuite",
  providerProfileId:"hs-pups-1", platform:"tiktok", displayName:"Pups",
  status:"connected", createdAt:at, updatedAt:at,
};
const character: SocialCharacterProfile = {
  id:"character:pupsonstuff", brand:"pupsonstuff", label:"PupsonStuff",
  aliases:["Pups"], description:"Pets", toneTraits:["warm","playful"],
  pointOfView:"Respect real pet identities", voiceProfileRef:"brand-voice:pupsonstuff",
  evidenceRefs:["character-authorized"], status:"active", authority:"EXPRESSION_ONLY",
};
const brandVoice: BrandVoiceProfile = {
  voiceProfileId:"brand-voice:pupsonstuff", brand:"pupsonstuff", version:1,
  toneTraits:["warm"], vocabularyPreferences:[], prohibitedPhrases:[],
  claimRefs:[], disclosureRules:[], escalationRules:[],
  approvedAt:at, evidenceRefs:["brand-approved"],
};
const channelVoice: ChannelVoiceProfile = {
  channelVoiceProfileId:"channel-voice:tiktok", platform:"tiktok", version:1,
  formality:0.3, emojiDensity:0.2, pacing:"tight", ctaStyle:"honest",
  hookStyle:"curious", formatPreferences:[], prohibitedPatterns:[],
  platformPolicyRef:"policy:tiktok", observedAt:at,
};
const make = () => createSocialAccountIdentity({
  account, character, brandVoice, channelVoice, observedAt:at,
  evidenceRefs:["account-owner-verified"],
});
const propose = () => proposeSocialIdentityRevision({
  current:make(), id:"proposal-1", proposedToneTraits:["kind","fun"],
  proposedPointOfView:"Show pets as individuals",
  independentEvidenceRefs:["approved-review-1","approved-review-2"],
  rationale:"Owner requested an updated expression", proposedAt:at,
});
describe("SOCIAL-ID.02-.03 owner-scoped identity governance", () => {
  it("creates frozen expression-only account identity", () => {
    const identity=make();
    expect(identity.scope.accountId).toBe(account.id);
    expect(identity.version).toBe(1);
    expect(identity.authority).toBe("EXPRESSION_ONLY");
    expect(identity.canPublish).toBe(false);
    expect(identity.canChangeJhadinaPersonality).toBe(false);
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.isFrozen(identity.scope)).toBe(true);
    expect(Object.isFrozen(identity.toneTraits)).toBe(true);
  });
  it("rejects disabled accounts, foreign brands, platform and voice mismatches", () => {
    expect(() => createSocialAccountIdentity({account:{...account,status:"revoked"},
      character,brandVoice,channelVoice,observedAt:at,evidenceRefs:["owner"]}))
      .toThrow("SOCIAL_ID_ACCOUNT_NOT_CONNECTED");
    expect(() => createSocialAccountIdentity({account:{...account,brand:"atwood-bookie"},
      character,brandVoice,channelVoice,observedAt:at,evidenceRefs:["owner"]}))
      .toThrow("SOCIAL_ID_BRAND_MISMATCH");
    expect(() => createSocialAccountIdentity({account,character,brandVoice,
      channelVoice:{...channelVoice,platform:"youtube"},observedAt:at,evidenceRefs:["owner"]}))
      .toThrow("SOCIAL_ID_CHANNEL_MISMATCH");
    expect(() => createSocialAccountIdentity({account,character:{...character,voiceProfileRef:"wrong"},
      brandVoice,channelVoice,observedAt:at,evidenceRefs:["owner"]}))
      .toThrow("SOCIAL_ID_VOICE_REF_MISMATCH");
  });
  it("rejects forged owner or account scope", () => {
    const identity=make();
    expect(() => assertSocialIdentityScope({...identity.scope,ownerUserId:"owner-b"},account))
      .toThrow("SOCIAL_ID_SCOPE_MISMATCH");
    expect(() => assertSocialIdentityScope({...identity.scope,accountId:"another"},account))
      .toThrow("SOCIAL_ID_SCOPE_MISMATCH");
  });
  it("requires multiple distinct evidence references before proposing identity changes", () => {
    expect(() => proposeSocialIdentityRevision({
      current:make(),id:"p",proposedToneTraits:["bold"],proposedPointOfView:"New",
      independentEvidenceRefs:["same","same"],rationale:"Reason",proposedAt:at,
    })).toThrow("SOCIAL_ID_REVISION_MULTIPLE_EVIDENCE_REQUIRED");
  });
  it("rejects unauthorized approver, unrelated scope and stale version", () => {
    const current=make(), proposal=propose();
    const base={current,proposal,approvalReceiptId:"owner-review-123",
      decision:"APPROVE" as const,decidedAt:at};
    expect(() => decideSocialIdentityRevision({...base,verifiedApproverUserId:"owner-b"}))
      .toThrow("SOCIAL_ID_WRONG_APPROVER");
    expect(() => decideSocialIdentityRevision({...base,current:{...current,version:2},
      verifiedApproverUserId:"owner-a"})).toThrow("SOCIAL_ID_STALE_REVISION");
    expect(() => decideSocialIdentityRevision({...base,proposal:{...proposal,scope:{
      ...proposal.scope,accountId:"other-account"}},verifiedApproverUserId:"owner-a"}))
      .toThrow("SOCIAL_ID_REVISION_SCOPE_MISMATCH");
  });
  it("rejection is inert; reviewed approval creates a new immutable version", () => {
    const current=make(), proposal=propose();
    const base={current,proposal,verifiedApproverUserId:"owner-a",
      approvalReceiptId:"verified-owner-review",decidedAt:at};
    const rejected=decideSocialIdentityRevision({...base,decision:"REJECT"});
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.next).toBeUndefined();
    const accepted=decideSocialIdentityRevision({...base,decision:"APPROVE"});
    expect(accepted.next?.version).toBe(2);
    expect(accepted.next?.scope).toEqual(current.scope);
    expect(accepted.next?.toneTraits).toEqual(["kind","fun"]);
    expect(accepted.next?.canPublish).toBe(false);
    expect(current.version).toBe(1);
    expect(current.toneTraits).toEqual(["warm","playful"]);
  });
});
