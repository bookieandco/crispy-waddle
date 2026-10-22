import { describe, expect, it } from "vitest"
import type { SocialAccount } from "@jhadina/social-core"
import { buildSocialConnectionReadiness } from "./connection-readiness"

const owner = "owner-1"
const account: SocialAccount = {
  id: "account-1", userId: owner, brand: "pupsonstuff",
  provider: "hootsuite", providerProfileId: "exact-p1",
  platform: "instagram", status: "connected", displayName: "PupsonStuff",
  createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z",
}
describe("Social read-only provider readiness", () => {
  it("never mistakes registration and a token for successful posting", () => {
    const statuses = buildSocialConnectionReadiness(owner, [account], {
      HOOTSUITE_OWNER_USER_ID: owner, HOOTSUITE_ACCESS_TOKEN: "private",
    })
    expect(statuses[0].state).toBe("registered_unverified")
    expect(statuses[0].verifiedLiveDelivery).toBe(false)
    expect(statuses[0].postingCommissioned).toBe(false)
    expect(JSON.stringify(statuses)).not.toContain("private")
    expect(statuses[0].supportedRuntimeMethods).not.toContain("comments.reply")
  })
  it("cannot assign a foreign account or credential owner to this user", () => {
    const statuses = buildSocialConnectionReadiness(owner, [{ ...account, userId: "foreign" }], {
      HOOTSUITE_OWNER_USER_ID: "foreign", HOOTSUITE_ACCESS_TOKEN: "private",
    })
    expect(statuses[0].state).toBe("unconfigured")
    expect(statuses[0].registeredAccountCount).toBe(0)
  })
  it("requires Ayrshare binding evidence in addition to a key", () => {
    const statuses = buildSocialConnectionReadiness(owner, [], {
      AYRSHARE_OWNER_USER_ID: owner, AYRSHARE_API_KEY: "hidden",
    })
    expect(statuses[1].state).toBe("unconfigured")
  })
})
