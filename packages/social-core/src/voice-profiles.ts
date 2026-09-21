import type { JhadinaBrand, SocialPlatform } from "./types.js";

export interface BrandVoiceProfile {
  voiceProfileId: string;
  brand: JhadinaBrand;
  version: number;
  toneTraits: readonly string[];
  vocabularyPreferences: readonly string[];
  prohibitedPhrases: readonly string[];
  claimRefs: readonly string[];
  disclosureRules: readonly string[];
  escalationRules: readonly string[];
  approvedAt: string;
  evidenceRefs: readonly string[];
}

export interface ChannelVoiceProfile {
  channelVoiceProfileId: string;
  platform: SocialPlatform;
  version: number;
  formality: number;
  maxLength?: number;
  emojiDensity: number;
  pacing: "tight" | "balanced" | "expanded";
  ctaStyle: string;
  hookStyle: string;
  formatPreferences: readonly string[];
  prohibitedPatterns: readonly string[];
  platformPolicyRef: string;
  observedAt: string;
}

export interface VoiceRealizationConstraints {
  brandVoiceProfileId: string;
  brandVoiceVersion: number;
  channelVoiceProfileId: string;
  channelVoiceVersion: number;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  toneTraits: readonly string[];
  vocabularyPreferences: readonly string[];
  prohibitedPhrases: readonly string[];
  claimRefs: readonly string[];
  disclosureRules: readonly string[];
  escalationRules: readonly string[];
  formality: number;
  maxLength?: number;
  emojiDensity: number;
  pacing: ChannelVoiceProfile["pacing"];
  ctaStyle: string;
  hookStyle: string;
  formatPreferences: readonly string[];
  prohibitedPatterns: readonly string[];
  platformPolicyRef: string;
}

/**
 * Produces expression constraints only.
 *
 * These profiles may shape realization, but they never mutate PersonalityState,
 * claims, consent, identity, policy, or authorization.
 */
export function composeVoiceRealizationConstraints(
  brandVoice: BrandVoiceProfile,
  channelVoice: ChannelVoiceProfile,
): VoiceRealizationConstraints {
  assertBrandVoiceProfile(brandVoice);
  assertChannelVoiceProfile(channelVoice);

  return Object.freeze({
    brandVoiceProfileId: brandVoice.voiceProfileId,
    brandVoiceVersion: brandVoice.version,
    channelVoiceProfileId: channelVoice.channelVoiceProfileId,
    channelVoiceVersion: channelVoice.version,
    brand: brandVoice.brand,
    platform: channelVoice.platform,
    toneTraits: Object.freeze([...brandVoice.toneTraits]),
    vocabularyPreferences: Object.freeze([...brandVoice.vocabularyPreferences]),
    prohibitedPhrases: Object.freeze([...brandVoice.prohibitedPhrases]),
    claimRefs: Object.freeze([...brandVoice.claimRefs]),
    disclosureRules: Object.freeze([...brandVoice.disclosureRules]),
    escalationRules: Object.freeze([...brandVoice.escalationRules]),
    formality: channelVoice.formality,
    maxLength: channelVoice.maxLength,
    emojiDensity: channelVoice.emojiDensity,
    pacing: channelVoice.pacing,
    ctaStyle: channelVoice.ctaStyle,
    hookStyle: channelVoice.hookStyle,
    formatPreferences: Object.freeze([...channelVoice.formatPreferences]),
    prohibitedPatterns: Object.freeze([...channelVoice.prohibitedPatterns]),
    platformPolicyRef: channelVoice.platformPolicyRef,
  });
}

export function assertBrandVoiceProfile(profile: BrandVoiceProfile): void {
  if (!profile.voiceProfileId.trim()) throw new Error("SOCIAL_BRAND_VOICE_ID_REQUIRED");
  if (!Number.isInteger(profile.version) || profile.version < 1) throw new Error("SOCIAL_BRAND_VOICE_VERSION_INVALID");
  if (!profile.toneTraits.length) throw new Error("SOCIAL_BRAND_VOICE_TONE_REQUIRED");
  if (!profile.evidenceRefs.length) throw new Error("SOCIAL_BRAND_VOICE_EVIDENCE_REQUIRED");
  assertTimestamp(profile.approvedAt, "SOCIAL_BRAND_VOICE_APPROVED_AT_INVALID");
}

export function assertChannelVoiceProfile(profile: ChannelVoiceProfile): void {
  if (!profile.channelVoiceProfileId.trim()) throw new Error("SOCIAL_CHANNEL_VOICE_ID_REQUIRED");
  if (!Number.isInteger(profile.version) || profile.version < 1) throw new Error("SOCIAL_CHANNEL_VOICE_VERSION_INVALID");
  if (!Number.isFinite(profile.formality) || profile.formality < 0 || profile.formality > 1) {
    throw new Error("SOCIAL_CHANNEL_VOICE_FORMALITY_INVALID");
  }
  if (!Number.isFinite(profile.emojiDensity) || profile.emojiDensity < 0 || profile.emojiDensity > 1) {
    throw new Error("SOCIAL_CHANNEL_VOICE_EMOJI_DENSITY_INVALID");
  }
  if (profile.maxLength !== undefined && (!Number.isInteger(profile.maxLength) || profile.maxLength < 1)) {
    throw new Error("SOCIAL_CHANNEL_VOICE_MAX_LENGTH_INVALID");
  }
  if (!profile.ctaStyle.trim()) throw new Error("SOCIAL_CHANNEL_VOICE_CTA_REQUIRED");
  if (!profile.hookStyle.trim()) throw new Error("SOCIAL_CHANNEL_VOICE_HOOK_REQUIRED");
  if (!profile.platformPolicyRef.trim()) throw new Error("SOCIAL_CHANNEL_VOICE_POLICY_REF_REQUIRED");
  assertTimestamp(profile.observedAt, "SOCIAL_CHANNEL_VOICE_OBSERVED_AT_INVALID");
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
