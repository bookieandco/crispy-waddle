import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers",()=>({
  headers:()=>new Headers({"x-vercel-oidc-token":"request-context-oidc"}),
}));

import { currentVercelOidcToken } from "./vercel-oidc-runtime";

const original=process.env.VERCEL_OIDC_TOKEN;

afterEach(()=>{
  if(original===undefined) delete process.env.VERCEL_OIDC_TOKEN;
  else process.env.VERCEL_OIDC_TOKEN=original;
});

describe("Vercel runtime OIDC resolution",()=>{
  it("uses the request-context token when the environment token is absent",()=>{
    delete process.env.VERCEL_OIDC_TOKEN;
    expect(currentVercelOidcToken()).toBe("request-context-oidc");
  });

  it("keeps the explicit environment token as the deterministic test/local override",()=>{
    process.env.VERCEL_OIDC_TOKEN="environment-oidc";
    expect(currentVercelOidcToken()).toBe("environment-oidc");
  });
});
