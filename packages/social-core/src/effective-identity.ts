import type { SocialAccount, SocialPublishTarget } from "./types.js";
import type { SocialCharacterProfile } from "./character-profiles.js";
import type { SocialAccountIdentity } from "./identity-projection.js";
import {
  composeVoiceRealizationConstraints,
  type BrandVoiceProfile,
  type ChannelVoiceProfile,
} from "./voice-profiles.js";
import { assertSocialIdentityScope } from "./identity-projection.js";

/** Only the approved account-specific identity can supply this overlay. */
export interface EffectiveSocialIdentity {
  readonly scope: SocialAccountIdentity["scope"];
  readonly version: number;
  readonly characterProfileRef: string;
  readonly brandVoiceProfileRef: string;
  readonly brandVoiceVersion: number;
  readonly channelVoiceProfileRef: string;
  readonly channelVoiceVersion: number;
  readonly speakerIdentityRef?: string;
  readonly toneTraits: readonly string[];
  readonly pointOfView: string;
  readonly prohibitedPhrases: readonly string[];
  readonly disclosureRules: readonly string[];
  readonly escalationRules: readonly string[];
  readonly platformPolicyRef: string;
  /** Equality fingerprint, not a cryptographic signature or approval receipt. */
  readonly fingerprint: string;
  readonly authority: "EXPRESSION_ONLY";
  readonly canPublish: false;
  readonly canChangeJhadinaPersonality: false;
}

export interface EffectiveSocialIdentityInput {
  account: SocialAccount;
  identity: SocialAccountIdentity;
  character: SocialCharacterProfile;
  brandVoice: BrandVoiceProfile;
  channelVoice: ChannelVoiceProfile;
  /** Must come from authenticated server context; never trust browser userId. */
  verifiedOwnerUserId: string;
}

function clean(value: string, label: string): string {
  if (!value || !value.trim()) throw new Error("SOCIAL_EFFECTIVE_REQUIRED:" + label);
  return value.trim();
}

export function resolveEffectiveSocialIdentity(input: EffectiveSocialIdentityInput): EffectiveSocialIdentity {
  const {account,identity,character,brandVoice,channelVoice} = input;
  if (clean(input.verifiedOwnerUserId, "owner") !== account.userId)
    throw new Error("SOCIAL_EFFECTIVE_OWNER_MISMATCH");
  assertSocialIdentityScope(identity.scope, account);
  if (account.status !== "connected") throw new Error("SOCIAL_EFFECTIVE_ACCOUNT_NOT_CONNECTED");
  if (identity.schemaVersion !== "jhadina.social.account-identity.v1" ||
      !Number.isSafeInteger(identity.version) || identity.version < 1 ||
      identity.authority !== "EXPRESSION_ONLY" ||
      identity.canPublish !== false || identity.canChangeJhadinaPersonality !== false)
    throw new Error("SOCIAL_EFFECTIVE_IDENTITY_INVALID");
  if (character.brand !== account.brand || brandVoice.brand !== account.brand ||
      character.status !== "active" || character.authority !== "EXPRESSION_ONLY")
    throw new Error("SOCIAL_EFFECTIVE_BRAND_INVALID");
  if (identity.characterProfileRef !== character.id ||
      identity.brandVoiceProfileRef !== brandVoice.voiceProfileId ||
      identity.channelVoiceProfileRef !== channelVoice.channelVoiceProfileId ||
      character.voiceProfileRef !== brandVoice.voiceProfileId ||
      channelVoice.platform !== account.platform ||
      identity.brandVoiceVersion !== brandVoice.version ||
      identity.channelVoiceVersion !== channelVoice.version)
    throw new Error("SOCIAL_EFFECTIVE_PROFILE_OR_VERSION_MISMATCH");
  if ((identity.speakerIdentityRef ?? "") !== (character.speakerIdentityRef ?? ""))
    throw new Error("SOCIAL_EFFECTIVE_SPEAKER_MISMATCH");
  const constraints=composeVoiceRealizationConstraints(brandVoice,channelVoice);
  const tones=[...new Set(identity.toneTraits.map(t=>clean(t,"tone")))];
  if (!tones.length) throw new Error("SOCIAL_EFFECTIVE_TONE_REQUIRED");
  const pointOfView=clean(identity.pointOfView,"pointOfView");
  const signature=JSON.stringify({
    schema:"jhadina.social.effective-identity.v1",
    ...identity.scope,
    version:identity.version, character:character.id,
    brandVoice:brandVoice.voiceProfileId,brandVoiceVersion:brandVoice.version,
    channelVoice:channelVoice.channelVoiceProfileId,channelVoiceVersion:channelVoice.version,
    speaker:identity.speakerIdentityRef ?? null,
    toneTraits:tones,pointOfView,
    prohibitedPhrases:constraints.prohibitedPhrases,
    disclosureRules:constraints.disclosureRules,
    escalationRules:constraints.escalationRules,
    platformPolicyRef:constraints.platformPolicyRef,
  });
  return Object.freeze({
    scope:Object.freeze({...identity.scope}),
    version:identity.version,
    characterProfileRef:character.id,
    brandVoiceProfileRef:brandVoice.voiceProfileId,
    brandVoiceVersion:brandVoice.version,
    channelVoiceProfileRef:channelVoice.channelVoiceProfileId,
    channelVoiceVersion:channelVoice.version,
    ...(identity.speakerIdentityRef ? {speakerIdentityRef:identity.speakerIdentityRef} : {}),
    toneTraits:Object.freeze(tones),
    pointOfView,
    prohibitedPhrases:Object.freeze([...constraints.prohibitedPhrases]),
    disclosureRules:Object.freeze([...constraints.disclosureRules]),
    escalationRules:Object.freeze([...constraints.escalationRules]),
    platformPolicyRef:constraints.platformPolicyRef,
    fingerprint:signature,
    authority:"EXPRESSION_ONLY" as const,
    canPublish:false as const,
    canChangeJhadinaPersonality:false as const,
  });
}

export function assertEffectiveSocialIdentityTarget(
  effective:EffectiveSocialIdentity,
  target:SocialPublishTarget,
  verifiedOwnerUserId:string,
):void {
  if (effective.scope.ownerUserId!==verifiedOwnerUserId ||
      effective.scope.accountId!==target.accountId ||
      effective.scope.brandId!==target.brand ||
      effective.scope.platform!==target.platform ||
      effective.scope.provider!==target.provider ||
      effective.scope.providerProfileId!==target.providerProfileId)
    throw new Error("SOCIAL_EFFECTIVE_TARGET_MISMATCH");
}
