import type { OwnerContextContribution } from "@jhadina/core-spine"
import type { OwnerContextProvider } from "./context-builder"

export const BOOKIE_OWNER_CONTEXT_HUB = "https://solo.to/bookieandco"
const OWNER_CONTEXT_OBSERVED_AT = "2026-09-23T00:00:00.000Z"

/**
 * Canonical production seed for the owner's public context graph.
 *
 * This adapter intentionally contributes only the owner-declared hub itself.
 * Linked-site ingestion belongs behind separate provenance-aware adapters so a
 * changing social/music page can never silently become durable Memory or a
 * personality mutation.
 */
export function createProductionOwnerContextProvider(): OwnerContextProvider {
  return {
    async getContext(): Promise<OwnerContextContribution> {
      return {
        hub: BOOKIE_OWNER_CONTEXT_HUB,
        references: [{
          evidence: {
            id: "owner-context:bookieandco:hub",
            source: "owner-context:user-supplied-hub",
            observedAt: OWNER_CONTEXT_OBSERVED_AT,
            summary: "Canonical public owner-context hub supplied by the owner: solo.to/bookieandco",
            immutable: true,
          },
          ownerAuthored: true,
          contentType: "hub",
          sourceUrl: BOOKIE_OWNER_CONTEXT_HUB,
          reuseScope: "context-only",
        }],
        limitations: [
          "linked music/social artifacts require their own fresh provenance before reuse",
          "owner-context evidence is read-only and never auto-promoted to durable Memory or Personality",
        ],
      }
    },
  }
}
