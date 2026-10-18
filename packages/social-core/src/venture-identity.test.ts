import { describe,expect,it } from "vitest";
import { getBrandSocialConfig,isVentureSocialBrand,ventureSocialBrand } from "./brands.js";
import { createVentureSocialCharacterProfile,getSocialCharacterProfileForBrand } from "./character-profiles.js";

describe("SOCIAL-ID.04 safe venture and known character forward-port",()=>{
  it("keeps Truckeros available as its own expression-only brand",()=>{
    const profile=getSocialCharacterProfileForBrand("truckeros");
    expect(profile?.brand).toBe("truckeros");
    expect(profile?.authority).toBe("EXPRESSION_ONLY");
  });
  it("accepts canonical venture keys without rewriting colliding references",()=>{
    expect(ventureSocialBrand("my_music_brand")).toBe("venture:my_music_brand");
    expect(isVentureSocialBrand("venture:my_music_brand")).toBe(true);
    expect(getBrandSocialConfig("venture:my_music_brand").id).toBe("venture:my_music_brand");
    expect(()=>ventureSocialBrand("../my_music_brand")).toThrow("SOCIAL_VENTURE_BRAND_REF_INVALID");
    expect(()=>ventureSocialBrand("Music Brand")).toThrow("SOCIAL_VENTURE_BRAND_REF_INVALID");
  });
  it("creates an inert candidate rather than registering or authorizing a venture",()=>{
    const profile=createVentureSocialCharacterProfile({
      ventureRef:"mybrand",label:"My Brand",toneTraits:["clear"],
      pointOfView:"Teach useful skills",voiceProfileRef:"brand-voice:mybrand",
      evidenceRefs:["owned-venture-proof"],
    });
    expect(profile.status).toBe("paused");
    expect(profile.authority).toBe("EXPRESSION_ONLY");
    expect(getSocialCharacterProfileForBrand(profile.brand)).toBeUndefined();
    expect(()=>createVentureSocialCharacterProfile({
      ventureRef:"mybrand",label:"My Brand",toneTraits:["clear"],pointOfView:"Teach",
      voiceProfileRef:"brand-voice:mybrand",evidenceRefs:[],
    })).toThrow("SOCIAL_VENTURE_CHARACTER_EVIDENCE_OR_IDENTITY_REQUIRED");
  });
});
