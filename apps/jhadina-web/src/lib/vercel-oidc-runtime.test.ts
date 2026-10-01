import { afterEach, describe, expect, it, vi } from "vitest";
import { getVercelOidcToken } from "@vercel/oidc";

vi.mock("@vercel/oidc",()=>({
  getVercelOidcToken:vi.fn(),
}));

import { currentVercelOidcToken } from "./vercel-oidc-runtime";

afterEach(()=>vi.resetAllMocks());

describe("Vercel runtime OIDC resolution",()=>{
  it("uses the supported refresh-capable Vercel helper",async()=>{
    vi.mocked(getVercelOidcToken).mockResolvedValue("request-context-oidc");
    await expect(currentVercelOidcToken()).resolves.toBe("request-context-oidc");
  });

  it("fails closed when Vercel cannot supply an OIDC token",async()=>{
    vi.mocked(getVercelOidcToken).mockRejectedValue(new Error("oidc unavailable"));
    await expect(currentVercelOidcToken()).resolves.toBe("");
  });
});
