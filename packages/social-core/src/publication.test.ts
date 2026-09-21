import { describe, expect, it } from "vitest";
import {
  assertExplicitPublishTargets,
  fingerprintSocialPublication,
} from "./publication.js";
import type { SocialPublishTarget } from "./types.js";

const targets: SocialPublishTarget[] = [
  {
    accountId: "account-1",
    brand: "jhadinatv",
    provider: "hootsuite",
    providerProfileId: "profile-1",
    platform: "youtube",
  },
  {
    accountId: "account-2",
    brand: "jhadinatv",
    provider: "hootsuite",
    providerProfileId: "profile-2",
    platform: "tiktok",
  },
];

describe("social publication governance", () => {
  it("rejects cross-brand targets", () => {
    expect(() => assertExplicitPublishTargets("overageos", targets)).toThrow(
      "SOCIAL_CROSS_BRAND_TARGET_DENIED",
    );
  });

  it("rejects duplicate provider profiles", () => {
    expect(() =>
      assertExplicitPublishTargets("jhadinatv", [
        targets[0],
        { ...targets[1], providerProfileId: targets[0].providerProfileId },
      ]),
    ).toThrow("SOCIAL_DUPLICATE_TARGET");
  });

  it("fingerprints the same target set deterministically regardless of order", () => {
    const a = fingerprintSocialPublication({
      brand: "jhadinatv",
      text: "hello",
      targets,
    });
    const b = fingerprintSocialPublication({
      brand: "jhadinatv",
      text: "hello",
      targets: [...targets].reverse(),
    });
    expect(a).toBe(b);
  });
});
