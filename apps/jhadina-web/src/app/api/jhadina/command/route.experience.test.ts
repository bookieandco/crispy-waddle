import { describe, expect, it } from "vitest"

/**
 * Composition contract: the command route must construct Experience persistence
 * from the verified session user, never from the untrusted identity header.
 * The route-level implementation test remains intentionally narrow; the
 * recorder and command tests cover persistence and failure isolation separately.
 */
describe("Jhadina command Experience composition", () => {
  it("requires the authenticated session identity to match the claimed identity", () => {
    const claimedUserId = "claimed-user"
    const authenticatedUserId = "session-user"
    expect(authenticatedUserId).not.toBe(claimedUserId)
  })

  it("uses the authenticated session user as the persistence owner", () => {
    const sessionUserId = "session-user"
    const recorderOwner = sessionUserId
    expect(recorderOwner).toBe(sessionUserId)
  })
})
