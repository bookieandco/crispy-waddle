import { describe, expect, it } from "vitest";
import {
  getSocialCharacterProfileForBrand,
  resolveSocialCharacterProfiles,
} from "./character-profiles.js";

describe("social character profiles", () => {
  it("resolves natural-language character aliases deterministically", () => {
    const profiles = resolveSocialCharacterProfiles(
      "Use the Atwood Bookie personality for the next campaign",
    );
    expect(profiles.map((profile) => profile.id)).toEqual(["character:atwood-bookie"]);
    expect(profiles[0]?.authority).toBe("EXPRESSION_ONLY");
  });

  it("keeps character expression separate from Jhadina execution authority", () => {
    const profile = getSocialCharacterProfileForBrand("pupsonstuff");
    expect(profile?.voiceProfileRef).toBe("brand-voice:pupsonstuff");
    expect(profile?.authority).toBe("EXPRESSION_ONLY");
  });

  it("returns no invented profile when the request names an unknown character", () => {
    expect(resolveSocialCharacterProfiles("Use the dragon personality")).toEqual([]);
  });
});
