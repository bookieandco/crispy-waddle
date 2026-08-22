import { describe, it, expect } from "vitest"
import { IntelligenceRouter, type ModelProvider } from "@jhadina/intelligence-core"
import type { DecisionProposal } from "@jhadina/core-spine"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, type ContextBuilderDeps } from "./context-builder"

function freshDeps(): ContextBuilderDeps & { memoryRepo: MemoryRepository; timelineRepo: TimelineRepository; reasoningRepo: ReasoningEventRepository } {
  const storage = new InMemoryStorage()
  return {
    memoryRepo: new MemoryRepository(storage),
    timelineRepo: new TimelineRepository(storage),
    reasoningRepo: new ReasoningEventRepository(storage),
  }
}

/** Creates and approves a memory through the real Step 2 governed flow (candidate -> explicit approve), same as JanetService. */
async function approveMemory(
  deps: ReturnType<typeof freshDeps>,
  userId: string,
  content: string,
): Promise<void> {
  const reasoningEvent = await deps.reasoningRepo.create({
    userId,
    userMessage: content,
    observation: { raw: content, extracted: content, timestamp: new Date().toISOString() },
    classification: { type: "CONTEXT", confidence: 0.9 },
    systemResponse: "noted",
    confidence: 0.9,
  })
  const candidate = await deps.memoryRepo.createCandidate({
    userId,
    content,
    type: "CONTEXT",
    confidence: 0.9,
    reasoningEventId: reasoningEvent.id,
  })
  const memory = await deps.memoryRepo.approve(candidate.id, userId)
  await deps.timelineRepo.recordApproval({
    userId,
    memoryId: memory.id,
    memoryType: memory.type,
    memoryContent: memory.content,
  })
}

describe("Context Builder (Phase 1 Step 4)", () => {
  it("1. produces a valid, empty-but-honest context for a brand-new user with nothing recorded", async () => {
    const deps = freshDeps()
    const assembled = await buildContext(deps, { userId: "user-empty", activeTask: "hello there" })

    expect(assembled.contextPacket.relevantMemories).toEqual([])
    expect(assembled.contextPacket.knowledge).toEqual([])
    expect(assembled.contextPacket.patterns).toEqual([])
    expect(assembled.contextPacket.personality.traits).toEqual([])
    expect(assembled.contextPacket.excludedContext).toContain(
      "patterns: not assembled — no PatternPort implementation exists yet",
    )
    expect(assembled.contextPacket.excludedContext).toContain(
      "personality: not assembled — no PersonalityPort implementation exists yet",
    )
    expect(assembled.contextPacket.excludedContext).toContain("surface: not supplied by the caller")
  })

  it("2. retrieves a relevant memory whose content shares a keyword with the active task", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-a", "I prefer cinematic visuals in every video edit")

    const assembled = await buildContext(deps, {
      userId: "user-a",
      activeTask: "What visuals style should I use for this video?",
    })

    expect(assembled.contextPacket.relevantMemories).toHaveLength(1)
    expect(assembled.contextPacket.relevantMemories[0].summary).toContain("cinematic visuals")
  })

  it("3. excludes an approved memory that shares no keyword with the active task", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-b", "I prefer cinematic visuals in every video edit")

    const assembled = await buildContext(deps, {
      userId: "user-b",
      activeTask: "What time is my dentist appointment tomorrow?",
    })

    expect(assembled.contextPacket.relevantMemories).toHaveLength(0)
    expect(
      assembled.contextPacket.excludedContext.some((e) => e.includes("excluded as not relevant")),
    ).toBe(true)
  })

  it("4. carries surface and route context through, reflected in the packet's purpose", async () => {
    const deps = freshDeps()
    const assembled = await buildContext(deps, {
      userId: "user-c",
      activeTask: "what's new",
      surface: "music",
      route: "/music",
    })

    expect(assembled.surface).toBe("music")
    expect(assembled.route).toBe("/music")
    expect(assembled.contextPacket.purpose).toContain("Music")
    expect(assembled.contextPacket.purpose).toContain("/music")
    expect(assembled.contextPacket.excludedContext).not.toContain("surface: not supplied by the caller")
  })

  it("5. enforces context-size limits — both item-count and total-character budgets", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-d", "I love ambient soundscapes for background focus music")
    await approveMemory(deps, "user-d", "I love long-form ambient documentary music playlists")
    await approveMemory(deps, "user-d", "I love ambient music mixed at low volume overnight")

    const assembled = await buildContext(deps, {
      userId: "user-d",
      activeTask: "recommend me some ambient music",
      limits: { maxMemories: 1 },
    })

    expect(assembled.contextPacket.relevantMemories).toHaveLength(1)
    expect(
      assembled.contextPacket.excludedContext.some((e) => e.includes("maxMemories limit")),
    ).toBe(true)

    // A tiny character budget forces trimming even below the maxMemories cap.
    const tinyBudget = await buildContext(deps, {
      userId: "user-d",
      activeTask: "recommend me some ambient music",
      limits: { maxMemories: 5, maxTotalChars: 10 },
    })
    expect(tinyBudget.contextPacket.relevantMemories.length).toBeLessThan(3)
    expect(tinyBudget.contextPacket.excludedContext.some((e) => e.includes("character budget"))).toBe(true)
  })

  it("6. redacts secret-like content out of assembled memory text", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-e", "my stripe key is sk_test_abcdefghijklmnop for testing checkouts")

    const assembled = await buildContext(deps, {
      userId: "user-e",
      activeTask: "what do you know about my stripe testing setup",
    })

    expect(assembled.contextPacket.relevantMemories).toHaveLength(1)
    expect(assembled.contextPacket.relevantMemories[0].summary).not.toContain("sk_test_abcdefghijklmnop")
    expect(assembled.contextPacket.relevantMemories[0].summary).toContain("[REDACTED]")
    expect(assembled.contextPacket.excludedContext.some((e) => e.includes("redacted from assembled text"))).toBe(true)
  })

  it("7. assembles deterministically — identical inputs and state produce identical content and ordering", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-f", "I prefer warm color grading in video edits")
    await approveMemory(deps, "user-f", "I prefer minimal background music in video edits")

    const first = await buildContext(deps, { userId: "user-f", activeTask: "how should I edit this video" })
    const second = await buildContext(deps, { userId: "user-f", activeTask: "how should I edit this video" })

    // id/assembledAt are per-call nonces by design — everything else must match exactly.
    expect(first.contextPacket.relevantMemories).toEqual(second.contextPacket.relevantMemories)
    expect(first.contextPacket.knowledge).toEqual(second.contextPacket.knowledge)
    expect(first.contextPacket.constraints).toEqual(second.contextPacket.constraints)
    expect(first.contextPacket.excludedContext).toEqual(second.contextPacket.excludedContext)
    expect(first.contextPacket.purpose).toEqual(second.contextPacket.purpose)
  })

  it("8. never throws and honestly documents every missing input for a user with real activity but no surface/route/project", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-g", "I like short-form edits")

    const assembled = await buildContext(deps, { userId: "user-g", activeTask: "anything to report?" })

    expect(assembled.activeProject).toBeUndefined()
    expect(assembled.surface).toBeUndefined()
    expect(assembled.route).toBeUndefined()
    expect(assembled.contextPacket.excludedContext).toContain(
      "activeProject: not supplied — no Project/Workspace entity exists in this repository yet",
    )
    expect(assembled.contextPacket.excludedContext).toContain("route: not supplied by the caller")
  })

  it("9. produces a ContextPacket the real IntelligenceRouter accepts and reasons over directly — no adapter needed", async () => {
    const deps = freshDeps()
    await approveMemory(deps, "user-h", "I prefer cinematic visuals")

    const assembled = await buildContext(deps, {
      userId: "user-h",
      activeTask: "what should today's edit look like",
      surface: "studio",
    })

    const provider: ModelProvider = {
      name: "fake-provider",
      propose: async (context): Promise<DecisionProposal> => ({
        id: "proposal-integration-1",
        contextId: context.id,
        disposition: "ASK",
        recommendation: `Given: ${context.purpose}`,
        rationale: "integration test",
        evidence: context.relevantMemories,
        uncertainty: [],
        alternatives: [],
      }),
    }
    const router = new IntelligenceRouter({ primary: provider, fallback: provider })

    const proposal = await router.decide(assembled.contextPacket)

    expect(proposal.contextId).toBe(assembled.contextPacket.id)
    expect(proposal.evidence).toEqual(assembled.contextPacket.relevantMemories)
    expect(proposal.recommendation).toContain("Studio")
  })

  it("reflects the current base Security Core policy as human-readable constraints, without duplicating or modifying it", async () => {
    const deps = freshDeps()
    const assembled = await buildContext(deps, { userId: "user-i", activeTask: "what can you do" })

    expect(assembled.contextPacket.constraints).toContain("allowed: memory.propose")
    expect(
      assembled.contextPacket.constraints.some((c) => c === "allowed: growth.draft.approve (requires explicit approval)"),
    ).toBe(true)
  })
})
