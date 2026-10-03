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

  it("keeps Jhadina family expression profiles distinct while sharing one acoustic identity", () => {
    const main=getSocialCharacterProfileForBrand("jhadina")
    const tv=getSocialCharacterProfileForBrand("jhadinatv")
    const music=getSocialCharacterProfileForBrand("jhadina-music")
    expect(main?.voiceProfileRef).toBe("brand-voice:jhadina")
    expect(tv?.voiceProfileRef).toBe("brand-voice:jhadinatv")
    expect(music?.voiceProfileRef).toBe("brand-voice:jhadina-music")
    expect(new Set([
      main?.speakerIdentityRef,
      tv?.speakerIdentityRef,
      music?.speakerIdentityRef,
    ])).toEqual(new Set(["voice:jhadina:canonical:v1"]))
  })

  it("does not give unrelated brand characters Jhadina's acoustic identity", () => {
    expect(getSocialCharacterProfileForBrand("pupsonstuff")?.speakerIdentityRef).toBeUndefined()
    expect(getSocialCharacterProfileForBrand("atwood-bookie")?.speakerIdentityRef).toBeUndefined()
    expect(getSocialCharacterProfileForBrand("overageos")?.speakerIdentityRef).toBeUndefined()
  })

});
