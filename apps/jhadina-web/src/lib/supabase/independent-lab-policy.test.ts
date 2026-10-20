import { describe, expect, it } from "vitest";
import { allowIndependentLabRead, INDEPENDENT_LAB_BRANCH, INDEPENDENT_LAB_PATH } from "./independent-lab-policy";

describe("JH-INDEPENDENT.BUILD preview-only lab policy", () => {
  const valid = { pathname: INDEPENDENT_LAB_PATH, method: "GET", vercelEnv: "preview", gitRef: INDEPENDENT_LAB_BRANCH };
  it("admits only the exact preview branch GET and HEAD", () => {
    expect(allowIndependentLabRead(valid)).toBe(true);
    expect(allowIndependentLabRead({ ...valid, method: "HEAD" })).toBe(true);
  });
  it.each(["production", "development", undefined, ""])("denies every non-preview deployment: %s", vercelEnv => {
    expect(allowIndependentLabRead({ ...valid, vercelEnv })).toBe(false);
  });
  it.each(["main", "feat/other-branch", undefined, ""])("denies non-canonical branch: %s", gitRef => {
    expect(allowIndependentLabRead({ ...valid, gitRef })).toBe(false);
  });
  it.each(["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "get"])("denies non-read method %s", method => {
    expect(allowIndependentLabRead({ ...valid, method })).toBe(false);
  });
  it.each([
    "/jhadina-independent-lab.html/",
    "/jhadina-independent-lab.html/anything",
    "/memory/facebook",
    "/api/jhadina/command",
    "/api/personality/facebook/propose",
    "/api/home/saved-social",
    "/api/music/playback",
  ])("denies nearby, privileged or unrelated path %s", pathname => {
    expect(allowIndependentLabRead({ ...valid, pathname })).toBe(false);
  });
});
