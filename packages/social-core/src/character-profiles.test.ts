import { describe, expect, it } from "vitest";
import {
  createVentureSocialCharacterProfile,
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

  it("gives Truckeros its own industry-native profile", () => {
    const profile = getSocialCharacterProfileForBrand("truckeros");
    expect(profile?.id).toBe("character:truckeros");
    expect(profile?.voiceProfileRef).toBe("brand-voice:truckeros");
    expect(profile?.toneTraits).toContain("industry-native");
  });

  it("creates a governed expression-only profile for a Business Factory venture", () => {
    const profile = createVentureSocialCharacterProfile({
      ventureRef: "etsy-digital-product-lab",
      label: "Etsy Digital Product Lab",
      toneTraits: ["useful", "creator-native", "concise"],
      pointOfView: "Help buyers solve a narrow problem with a clear digital product.",
      voiceProfileRef: "brand-voice:venture:etsy-digital-product-lab",
      aliases: ["etsy lab"],
      evidenceRefs: ["venture:etsy-digital-product-lab", "offer:template-pack"],
    });

    expect(profile.brand).toBe("venture:etsy-digital-product-lab");
    expect(profile.id).toBe("character:venture:etsy-digital-product-lab");
    expect(profile.authority).toBe("EXPRESSION_ONLY");
    expect(profile.speakerIdentityRef).toBeUndefined();
  });

});
