import { describe, expect, it } from "vitest"
import type { DecisionProposal } from "@jhadina/core-spine"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { PersistedExperiencePatternAdapter } from "../hippocampus/persisted-experience-pattern-adapter"
import { finalizeAskShortcutExperience, recordAskShortcutExperience } from "./ask-shortcut-experience"

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

  it("finalizes the same Experience after a subsystem outcome without creating a duplicate turn", async () => {
    const storage = new InMemoryStorage()
    const initial = proposal()
    const eventId = await recordAskShortcutExperience({
      userId: "user-finalize",
      activeTask: "Make the PupsonStuff video",
      proposal: initial,
      shortcut: "social",
      metadata: { stage: "pre-director" },
    }, { storage })

    const finalProposal: DecisionProposal = {
      ...initial,
      disposition: "DEFER",
      recommendation: "Director created the job, but provider submission is uncertain.",
      rationale: "The persisted Director job is authoritative while provider reconciliation is pending.",
      uncertainty: ["DIRECTOR_VIDEO_SUBMISSION_UNCERTAIN"],
    }

    await finalizeAskShortcutExperience({
      userId: "user-finalize",
      reasoningEventId: eventId,
      proposal: finalProposal,
      shortcut: "social",
      metadata: { stage: "post-director", videoJobId: "video-1" },
    }, { storage })

    const repository = new ReasoningEventRepository(storage)
    const events = await repository.list("user-finalize")
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe(eventId)
    expect(events[0].userMessage).toBe("Make the PupsonStuff video")
    expect(events[0].systemResponse).toBe(finalProposal.recommendation)
    expect(events[0].outcome).toBe("ask-shortcut:social:defer")
    expect(events[0].metadata).toMatchObject({
      stage: "post-director",
      videoJobId: "video-1",
      proposalId: finalProposal.id,
      disposition: "DEFER",
      authority: "experience-only",
    })
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
