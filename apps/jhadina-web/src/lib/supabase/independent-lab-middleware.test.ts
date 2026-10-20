import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { updateSession } from "./middleware";
import { INDEPENDENT_LAB_BRANCH, INDEPENDENT_LAB_PATH } from "./independent-lab-policy";

const prior = { env: process.env.VERCEL_ENV, ref: process.env.VERCEL_GIT_COMMIT_REF };
afterEach(() => {
  if (prior.env === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = prior.env;
  if (prior.ref === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
  else process.env.VERCEL_GIT_COMMIT_REF = prior.ref;
  mocks.createServerClient.mockReset();
});

describe("independent iPhone preview integration", () => {
  it("allows a static GET without attempting an unavailable Supabase session only on its specific preview", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = INDEPENDENT_LAB_BRANCH;
    const res = await updateSession(new NextRequest("https://owner-preview.vercel.app" + INDEPENDENT_LAB_PATH));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("does not bypass Supabase for a POST even on the exact preview branch", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = INDEPENDENT_LAB_BRANCH;
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }) } });
    const res = await updateSession(new NextRequest("https://owner-preview.vercel.app" + INDEPENDENT_LAB_PATH, { method: "POST" }));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("/login");
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
  });

  it("never opens the real command, saved feed or Memory APIs without owner claims", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = INDEPENDENT_LAB_BRANCH;
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }) } });
    for (const route of ["/api/jhadina/command", "/api/home/saved-social", "/api/personality/facebook/propose"]) {
      const res = await updateSession(new NextRequest("https://owner-preview.vercel.app" + route));
      expect(res.headers.get("location")).toContain("/login");
    }
    expect(mocks.createServerClient).toHaveBeenCalledTimes(3);
  });

  it("keeps the static prototype self-contained, synthetic, non-indexed and network-free", () => {
    const html = readFileSync(new URL("../../../public/jhadina-independent-lab.html", import.meta.url), "utf8");
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain('name="robots" content="noindex,nofollow,noarchive"');
    expect(html).toContain("connect-src 'none'");
    for (const route of ['id="home"', 'id="memory"', 'id="visual"', 'id="music"']) expect(html).toContain(route);
    expect(html).toContain("This does not create a Memory entry");
    expect(html).toContain("Synthetic tone sample only");
    expect(html).not.toMatch(/\bfetch\s*\(/);
    expect(html).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket)\b/);
    expect(html).not.toMatch(/<form[\s>]/i);
  });
});
