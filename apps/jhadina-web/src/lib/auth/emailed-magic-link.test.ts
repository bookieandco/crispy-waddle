import { describe, expect, it } from "vitest";
import { parseEmailedMagicLink } from "./emailed-magic-link";

const origin = "https://kqbkaozfjubkjevdfvic.supabase.co";
const hash = "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";

describe("Phantom iPhone same-browser email link import", () => {
  it("extracts a real shape Supabase magiclink without following its redirect_to", () => {
    const link = origin + "/auth/v1/verify?token=" + hash +
      "&type=magiclink&redirect_to=https%3A%2F%2Fwrong-host.invalid";
    expect(parseEmailedMagicLink(link, origin)).toEqual({token_hash:hash,type:"magiclink"});
  });
  it("permits the email token verification type", () => {
    expect(parseEmailedMagicLink(origin+"/auth/v1/verify?type=email&token="+hash,origin))
      .toEqual({token_hash:hash,type:"email"});
  });
  it("rejects a malicious host, insecure scheme, credentials, duplicates and fragments", () => {
    const samples = [
      "https://kqbkaozfjubkjevdfvic.supabase.co.evil.test/auth/v1/verify?type=magiclink&token="+hash,
      "http://kqbkaozfjubkjevdfvic.supabase.co/auth/v1/verify?type=magiclink&token="+hash,
      "https://alice:pass@kqbkaozfjubkjevdfvic.supabase.co/auth/v1/verify?type=magiclink&token="+hash,
      origin+"/auth/v1/verify?type=magiclink&token="+hash+"&token="+hash,
      origin+"/auth/v1/verify?type=magiclink&token="+hash+"#session",
      origin+"/auth/v1/verify?type=recovery&token="+hash,
      origin+"/auth/v1/verify?type=magiclink&token="+hash+"&access_token=secret",
      "javascript:alert(1)",
      origin+"/auth/confirm?token_hash="+hash,
    ];
    for (const sample of samples) expect(()=>parseEmailedMagicLink(sample, origin)).toThrow();
  });
  it("requires the actual Supabase project, not a lookalike or arbitrary URL", () => {
    expect(()=>parseEmailedMagicLink(origin+"/auth/v1/verify?type=magiclink&token="+hash,
      "https://another-project.supabase.co")).toThrow("EMAIL_MAGIC_LINK_UNTRUSTED");
  });
});
