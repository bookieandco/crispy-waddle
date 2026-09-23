import { describe, expect, it } from "vitest"
import type { DecisionProposal } from "@jhadina/core-spine"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { PersistedExperiencePatternAdapter } from "../hippocampus/persisted-experience-pattern-adapter"
import { recordAskShortcutExperience } from "./ask-shortcut-experience"

function proposal(): DecisionProposal {
  return {
    id: "proposal-social-1",
    contextId: "context-social-1",
    disposition: "PROCEED",
    recommendation: "Use the connected Instagram account.",
    rationale: "Resolved from authenticated Social state.",
    evidence: [{
      id: "social-account:1",
      source: "social-account",
      observedAt: "2026-09-22T12:00:00.000Z",
      summary: "Connected Instagram account.",
      immutable: false,
    }],
    uncertainty: [],
    alternatives: [],
  }
}

describe("Ask Jhadina shortcut experience persistence", () => {
  it("persists a specialized shortcut into the canonical ReasoningEvent/Hippocampus path", async () => {
    const storage = new InMemoryStorage()
    const eventId = await recordAskShortcutExperience({
      userId: "user-shortcut",
      activeTask: "Which Instagram account should I work on?",
      proposal: proposal(),
      shortcut: "social",
      metadata: { accountCount: 1 },
    }, { storage })

    const repository = new ReasoningEventRepository(storage)
    const event = await repository.get(eventId)
    expect(event).toBeDefined()
    expect(event?.userMessage).toBe("Which Instagram account should I work on?")
    expect(event?.systemResponse).toBe("Use the connected Instagram account.")
    expect(event?.correlationId).toBe("context-social-1")
    expect(event?.metadata).toMatchObject({
      kind: "conversation-turn",
      source: "ask-jhadina-shortcut",
      shortcut: "social",
      authority: "experience-only",
      accountCount: 1,
    })

    const hippocampus = new PersistedExperiencePatternAdapter(storage)
    const detected = await hippocampus.detect({
      userId: "user-shortcut",
      experienceId: eventId,
    })
    expect(detected.experience.id).toBe(eventId)
    expect(detected.experience.content).toBe("Which Instagram account should I work on?")
  })

  it("never creates a pending or approved Memory record", async () => {
    const storage = new InMemoryStorage()
    await recordAskShortcutExperience({
      userId: "user-shortcut-no-memory",
      activeTask: "Show my campaigns",
      proposal: proposal(),
      shortcut: "growth",
    }, { storage })

    const memory = new MemoryRepository(storage)
    expect(await memory.listPending("user-shortcut-no-memory")).toHaveLength(0)
    expect(await memory.listApproved("user-shortcut-no-memory")).toHaveLength(0)
  })

  it("retains uncertainty as a conservative reasoning confidence", async () => {
    const storage = new InMemoryStorage()
    const uncertain = {
      ...proposal(),
      uncertainty: ["Provider status is stale."],
    }
    const eventId = await recordAskShortcutExperience({
      userId: "user-shortcut-uncertain",
      activeTask: "What needs attention?",
      proposal: uncertain,
      shortcut: "growth",
    }, { storage })

    const event = await new ReasoningEventRepository(storage).get(eventId)
    expect(event?.confidence).toBe(0.5)
    expect(event?.classification.confidence).toBe(0.5)
  })
})
