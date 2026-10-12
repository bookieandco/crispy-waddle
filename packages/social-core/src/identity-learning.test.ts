
import { describe, it, expect } from "vitest";
import type { SocialAccount } from "./types.js";
import type { SocialObservation } from "./observations.js";
import type { SocialAccountIdentity } from "./identity-projection.js";
import {
  admitSocialIdentityPerformance,
  reconcileSocialIdentityEvidence,
  proposeEvidenceBackedSocialIdentityChange,
} from "./identity-learning.js";
import { assessSocialIdentityDrift } from "./identity-drift.js";
import { proposeCrossAccountSocialLearning } from "./identity-transfer.js";

const now = "2026-10-11T20:00:00.000Z";
const scope = {
  ownerUserId:"owner-1",brandId:"pupsonstuff" as const,accountId:"account-1",
  platform:"tiktok" as const,provider:"hootsuite",providerProfileId:"profile-1",
};
const account: SocialAccount = {
  id:scope.accountId,userId:scope.ownerUserId,brand:scope.brandId,
  platform:scope.platform,provider:scope.provider,providerProfileId:scope.providerProfileId,
  displayName:"Pups",status:"connected",createdAt:now,updatedAt:now,
};
const identity: SocialAccountIdentity = {
  schemaVersion:"jhadina.social.account-identity.v1",scope,version:1,
  characterProfileRef:"character:pupsonstuff",
  brandVoiceProfileRef:"brand-voice:pups",brandVoiceVersion:1,
  channelVoiceProfileRef:"channel:tiktok",channelVoiceVersion:1,
  toneTraits:["warm","playful"],pointOfView:"Keep the real pet recognizable",
  evidenceRefs:["original-brand-guide"],updatedAt:now,
  authority:"EXPRESSION_ONLY",canPublish:false,canChangeJhadinaPersonality:false,
};
function observation(n: number, changes: Partial<SocialObservation>={}): SocialObservation {
  return {
    id:"obs-"+n,userId:scope.ownerUserId,brand:scope.brandId,kind:"performance",
    source:"verified-provider",provider:scope.provider,platform:scope.platform,
    accountId:scope.accountId,providerProfileId:scope.providerProfileId,
    contentId:"post-"+n,outboxId:"outbox-"+n,observedAt:"2026-10-10T12:00:00.000Z",
    evidence:["provider-receipt-"+n],metrics:{views:1000+n,shares:30+n,conversions:2},
    attributes:{confidence:0.92},...changes,
  };
}
function admit(n: number, changes: Partial<SocialObservation>={}) {
  return admitSocialIdentityPerformance({
    identity,account,observation:observation(n,changes),
    verifiedContentIds:["post-"+n],asOf:now,
  });
}
const evidence = () => [admit(1),admit(2),admit(3)];
const change = () => proposeEvidenceBackedSocialIdentityChange({
  current:identity,evidence:evidence(),id:"proposal-1",
  proposedToneTraits:["warm","playful","clear"],
  proposedPointOfView:"Keep the real pet recognizable",
  rationale:"Three distinct approved performance receipts",proposedAt:now,
});
describe("SOCIAL-ID.05 strict performance admission",()=>{
  it("binds evidence to exact owned account, verified post, and inert authority",()=>{
    const result=admit(1);
    expect(result.scope).toEqual(scope);
    expect(result.authority).toBe("OBSERVATION_ONLY");
    expect(result.canModifyIdentity).toBe(false);
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });
  it.each([
    ["foreign owner",{userId:"owner-2"}],
    ["foreign brand",{brand:"atwood-bookie"}],
    ["foreign account",{accountId:"account-9"}],
    ["foreign provider",{provider:"other"}],
    ["foreign profile",{providerProfileId:"profile-9"}],
    ["foreign platform",{platform:"youtube"}],
  ] as const)("rejects %s",(_label,changes)=>{
    expect(()=>admit(1,changes)).toThrow("SOCIAL_ID_LEARNING_OBSERVATION_SCOPE_MISMATCH");
  });
  it("rejects disconnected accounts, unverified content and non-performance records",()=>{
    expect(()=>admitSocialIdentityPerformance({
      identity,account:{...account,status:"revoked"},observation:observation(1),
      verifiedContentIds:["post-1"],asOf:now,
    })).toThrow("SOCIAL_ID_LEARNING_ACCOUNT_DISCONNECTED");
    expect(()=>admitSocialIdentityPerformance({
      identity,account,observation:observation(1),verifiedContentIds:["post-other"],asOf:now,
    })).toThrow("SOCIAL_ID_LEARNING_CONTENT_NOT_VERIFIED");
    expect(()=>admit(1,{kind:"trend"})).toThrow("SOCIAL_ID_LEARNING_NOT_PERFORMANCE");
  });
  it("rejects forged metrics, invalid confidence, stale and future observations",()=>{
    expect(()=>admit(1,{metrics:{views:-2}})).toThrow("SOCIAL_ID_LEARNING_METRIC_INVALID");
    expect(()=>admit(1,{metrics:{views:Number.NaN}})).toThrow("SOCIAL_ID_LEARNING_METRIC_INVALID");
    expect(()=>admit(1,{attributes:{confidence:3}})).toThrow("SOCIAL_ID_LEARNING_CONFIDENCE_INVALID");
    expect(()=>admit(1,{observedAt:"2026-12-11T00:00:00Z"})).toThrow("SOCIAL_ID_LEARNING_STALE_OR_FUTURE");
    expect(()=>admit(1,{observedAt:"2026-01-11T00:00:00Z"})).toThrow("SOCIAL_ID_LEARNING_STALE_OR_FUTURE");
  });
});
describe("SOCIAL-ID.07-.08 governed learning and drift",()=>{
  it("requires 3 qualified independent observations across 2 posts",()=>{
    expect(change().authority).toBe("REVIEW_ONLY");
    const a=admit(1);
    expect(()=>proposeEvidenceBackedSocialIdentityChange({
      current:identity,evidence:[a,a,a],id:"p",
      proposedToneTraits:["new"],proposedPointOfView:"New",
      rationale:"Reasons",proposedAt:now,
    })).toThrow("SOCIAL_ID_LEARNING_INDEPENDENT_OBSERVATIONS_REQUIRED");
    const samePost=evidence().map(x=>({...x,contentId:"post-one",independenceKey:"outbox-one"}));
    expect(()=>proposeEvidenceBackedSocialIdentityChange({
      current:identity,evidence:samePost,id:"p",
      proposedToneTraits:["new"],proposedPointOfView:"New",
      rationale:"Reasons",proposedAt:now,
    })).toThrow("SOCIAL_ID_LEARNING_INDEPENDENT_OBSERVATIONS_REQUIRED");
  });
  it("revokes supporting evidence and fails closed on foreign scope",()=>{
    expect(reconcileSocialIdentityEvidence({
      current:identity,evidence:evidence(),retiredEvidenceRefs:["provider-receipt-1"],asOf:now,
    })).toHaveLength(2);
    expect(()=>proposeEvidenceBackedSocialIdentityChange({
      current:identity,evidence:evidence(),retiredEvidenceRefs:["provider-receipt-1"],
      id:"p",proposedToneTraits:["new"],proposedPointOfView:"New",
      rationale:"Reasons",proposedAt:now,
    })).toThrow("SOCIAL_ID_LEARNING_INDEPENDENT_OBSERVATIONS_REQUIRED");
    expect(()=>reconcileSocialIdentityEvidence({
      current:identity,evidence:[{...admit(1),scope:{...scope,ownerUserId:"owner-other"}}],
      retiredEvidenceRefs:[],asOf:now,
    })).toThrow("SOCIAL_ID_LEARNING_CROSS_SCOPE");
  });
  it("reports material identity drift without applying changes",()=>{
    const proposal=change();
    const result=assessSocialIdentityDrift({current:identity,proposed:proposal});
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.canAutoApply).toBe(false);
    expect(identity.toneTraits).toEqual(["warm","playful"]);
    const major=assessSocialIdentityDrift({current:identity,proposed:{
      ...proposal,proposedToneTraits:["unrelated"],proposedPointOfView:"Different mission",
    }});
    expect(major.severity).toBe("major");
    expect(major.reasonCodes).toContain("IDENTITY_POINT_OF_VIEW_REVIEW");
    expect(()=>assessSocialIdentityDrift({current:identity,proposed:{
      ...proposal,scope:{...scope,brandId:"atwood-bookie"},
    }})).toThrow("SOCIAL_ID_DRIFT_SCOPE_MISMATCH");
  });
});
describe("SOCIAL-ID.09 abstract learning transfer",()=>{
  const target: SocialAccountIdentity = {
    ...identity,scope:{...scope,brandId:"atwood-bookie",accountId:"account-2",
      platform:"instagram",providerProfileId:"profile-2"},
    characterProfileRef:"character:atwood-bookie",
    pointOfView:"Unique artistic character",toneTraits:["bold","artistic"],
  };
  it("only transfers an experiment candidate, never identity, voice or permission",()=>{
    const result=proposeCrossAccountSocialLearning({
      source:identity,target,sourceEvidence:evidence(),mechanism:"question_open",
      id:"transfer-1",observedAt:now,verifiedOwnerUserId:"owner-1",
    });
    expect(result.status).toBe("CANDIDATE_ONLY");
    expect(result.requiresNewTargetExperiment).toBe(true);
    expect(result.canTransferVoiceOrPersona).toBe(false);
    expect(result.canPublish).toBe(false);
    expect(result.canModifyIdentity).toBe(false);
    expect(JSON.stringify(result)).not.toContain("Unique artistic character");
    expect(JSON.stringify(result)).not.toContain("Keep the real pet recognizable");
  });
  it("rejects cross-owner, unsupported mechanics and fake self-transfer",()=>{
    const base={
      source:identity,target,sourceEvidence:evidence(),
      mechanism:"question_open" as const,id:"transfer-1",observedAt:now,
      verifiedOwnerUserId:"owner-1",
    };
    expect(()=>proposeCrossAccountSocialLearning({
      ...base,target:{...target,scope:{...target.scope,ownerUserId:"owner-2"}},
    })).toThrow("SOCIAL_ID_TRANSFER_OWNER_DENIED");
    expect(()=>proposeCrossAccountSocialLearning({...base,target:identity}))
      .toThrow("SOCIAL_ID_TRANSFER_SAME_ACCOUNT");
    expect(()=>proposeCrossAccountSocialLearning({
      ...base,mechanism:"imitate_creator_voice" as any,
    })).toThrow("SOCIAL_ID_TRANSFER_MECHANIC_INVALID");
    expect(()=>proposeCrossAccountSocialLearning({
      ...base,retiredEvidenceRefs:["provider-receipt-2"],
    })).toThrow("SOCIAL_ID_TRANSFER_PROOF_INSUFFICIENT");
  });
});
