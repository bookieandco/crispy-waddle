import { describe, expect, it } from "vitest";
import {
  composeVoiceRealizationConstraints,
  type BrandVoiceProfile,
  type ChannelVoiceProfile,
} from "./voice-profiles.js";

const brand: BrandVoiceProfile = {
  voiceProfileId: "voice:pupsonstuff:v1",
  brand: "pupsonstuff",
  version: 1,
  toneTraits: ["warm", "playful", "clear"],
  vocabularyPreferences: ["pet parent"],
  prohibitedPhrases: ["guaranteed cure"],
  claimRefs: ["claims:pupsonstuff:v4"],
  disclosureRules: ["affiliate-disclosure-when-material"],
  escalationRules: ["medical-claim-review"],
  approvedAt: "2026-09-21T12:00:00Z",
  evidenceRefs: ["evidence:brand-guide"],
};

const tiktok: ChannelVoiceProfile = {
  channelVoiceProfileId: "voice-channel:tiktok:v1",
  platform: "tiktok",
  version: 1,
  formality: 0.2,
  maxLength: 500,
  emojiDensity: 0.35,
  pacing: "tight",
  ctaStyle: "low-friction",
  hookStyle: "creator-native",
  formatPreferences: ["short hook", "one clear CTA"],
  prohibitedPatterns: ["fake urgency", "invented testimonial"],
  platformPolicyRef: "policy:tiktok:2026-09-21",
  observedAt: "2026-09-21T12:00:00Z",
};

describe("voice profiles", () => {
  it("combines brand and platform expression constraints without mutating inputs", () => {
    const result = composeVoiceRealizationConstraints(brand, tiktok);
    expect(result.platform).toBe("tiktok");
    expect(result.brand).toBe("pupsonstuff");
    expect(result.toneTraits).toContain("playful");
    expect(result.hookStyle).toBe("creator-native");
    expect(result.claimRefs).toEqual(["claims:pupsonstuff:v4"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.toneTraits)).toBe(true);
  });

  it("rejects unversioned or ungoverned channel profiles", () => {
    expect(() =>
      composeVoiceRealizationConstraints(brand, {
        ...tiktok,
        platformPolicyRef: "",
      }),
    ).toThrow(/POLICY_REF_REQUIRED/);
  });
});
