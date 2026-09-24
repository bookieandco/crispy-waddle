import { describe, it, expect } from "vitest"
import { IntelligenceRouter, type ModelProvider } from "@jhadina/intelligence-core"
import { emptyPersonalityState, type DecisionProposal } from "@jhadina/core-spine"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, deriveBehaviorContext, type ContextBuilderDeps } from "./context-builder"

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
  it("derives serious, precision, pushback, and ambiguity posture from explicit request language", () => {
    expect(deriveBehaviorContext("This is an urgent safety audit. Verify the exact values.")).toMatchObject({
      serious: true,
      requiresPrecision: true,
    })
    expect(deriveBehaviorContext("Push back and tell me if I'm wrong.")).toMatchObject({
      userAskedForPushback: true,
    })
    expect(deriveBehaviorContext("I'm unclear which one you mean.").ambiguity).toBeGreaterThanOrEqual(0.7)
    expect(deriveBehaviorContext("Activate the pre-launch sequence now.")).toMatchObject({
      operationalContext: true,
      register: "household-ops",
    })
    expect(deriveBehaviorContext("Review these clinical medication symptoms.")).toMatchObject({
      highStakes: true,
      register: "clinical",
    })
  })

  it("routes natural conversation into the intended governed expression register", () => {
    expect(deriveBehaviorContext("My partner and I need to talk about intimacy without judgment.").register).toBe("intimacy-agency")
    expect(deriveBehaviorContext("React to this viral TikTok clip and the comments.").register).toBe("social-reaction")
    expect(deriveBehaviorContext("Let's talk about this artist's legacy and cultural impact.").register).toBe("cultural-salon")
    expect(deriveBehaviorContext("We have a community roundtable with callers tonight.").register).toBe("community-room")
    expect(deriveBehaviorContext("Tell me a long-form story about how this happened.").register).toBe("storytelling")
    expect(deriveBehaviorContext("Sit with this and help me reflect on what it means to me.").register).toBe("reflective")
    expect(deriveBehaviorContext("I am grieving and I need help processing this.")).toMatchObject({
      distress: true,
      banterEligible: false,
    })
    expect(deriveBehaviorContext("Audit this production result exactly.")).toMatchObject({
      requiresPrecision: true,
    })
  })

  it("passes derived behavioral context into the governed Personality provider", async () => {
    const deps = freshDeps()
    let observed: unknown
    deps.personalityContextProvider = {
      getContext: async (input) => {
        observed = input.behaviorContext
        return {
          patterns: [],
          personality: emptyPersonalityState("2026-09-22T00:00:00.000Z"),
          expressionDirective: { mode: "serious", allowProfanity: false, allowQuip: false },
          limitations: [],
        }
      },
    }

    await buildContext(deps, {
      userId: "user-serious",
      activeTask: "This is a critical safety audit. Verify the exact result.",
    })

    expect(observed).toMatchObject({ serious: true, requiresPrecision: true })
  })

  it("1. produces a valid, empty-but-honest context for a brand-new user with nothing recorded", async () => {
    const deps = freshDeps()
    const assembled = await buildContext(deps, { userId: "user-empty", activeTask: "hello there" })

    expect(assembled.contextPacket.relevantMemories).toEqual([])
    expect(assembled.contextPacket.knowledge).toEqual([])
    expect(assembled.contextPacket.patterns).toEqual([])
    expect(assembled.contextPacket.personality.traits).toEqual([])
    expect(assembled.contextPacket.personality.independentAssessmentRequired).toBe(true)
    expect(assembled.contextPacket.personality.voice).toBeDefined()
    expect(assembled.contextPacket.personality.taste).toBeDefined()
    expect(assembled.contextPacket.personality.relationship).toBeDefined()
    expect(assembled.contextPacket.excludedContext).toContain(
      "patterns: not assembled — PatternPort is not composed into the direct context fallback",
    )
    expect(assembled.contextPacket.excludedContext).toContain(
      "personality: not assembled — direct context fallback uses canonical empty state until governed ports are composed",
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

  it("6b. carries bounded live continuity while redacting secrets and preserving its non-evidence status", async () => {
    const deps = freshDeps()
    const assembled = await buildContext(deps, {
      userId: "user-live",
      activeTask: "compare that to the earlier one",
      liveContext: {
        source: "ask-jhadina-live",
        observedAt: "2026-09-23T19:00:00.000Z",
        recentTurns: [
          {
            id: "turn-1",
            speaker: "user",
            text: "Earlier I showed you the dashboard. my stripe key is sk_test_abcdefghijklmnop",
            createdAt: "2026-09-23T18:59:00.000Z",
          },
          {
            id: "turn-2",
            speaker: "jhadina",
            text: "I can compare it when you show the next state.",
            createdAt: "2026-09-23T18:59:10.000Z",
          },
        ],
        workSession: {
          id: "session-live",
          goal: "Compare dashboard states without exposing sk_test_abcdefghijklmnop",
          activeSubsystems: ["growth"],
          admittedArtifactIds: ["artifact-1"],
        },
        limitations: ["client placeholder"],
      },
    })

    expect(assembled.contextPacket.liveContext?.recentTurns).toHaveLength(2)
    expect(assembled.contextPacket.liveContext?.recentTurns[0]?.text).toContain("[REDACTED]")
    expect(assembled.contextPacket.liveContext?.recentTurns[0]?.text).not.toContain("sk_test_abcdefghijklmnop")
    expect(assembled.contextPacket.liveContext?.workSession?.goal).toContain("[REDACTED]")
    expect(assembled.contextPacket.liveContext?.workSession?.activeSubsystems).toEqual(["growth"])
    expect(assembled.contextPacket.liveContext?.workSession?.admittedArtifactIds).toEqual(["artifact-1"])
    expect(assembled.contextPacket.knowledge).toEqual([])
    expect(assembled.contextPacket.relevantMemories).toEqual([])
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
    expect(proposal.recommendation).toContain("Director Workstation")
  })

  it("composes governed patterns, personality, and expression directive when a personality provider is present", async () => {
    const deps = freshDeps()
    deps.personalityContextProvider = {
      getContext: async () => ({
        patterns: [{
          id: "recurrence:direct",
          pattern: "recurring term: direct",
          evidence: [],
          confidence: 0.75,
          occurrences: 2,
          contradictions: [],
          lastObservedAt: "2026-09-20T12:00:00.000Z",
          personalityEligible: false,
        }],
        personality: {
          ...emptyPersonalityState("2026-09-20T12:00:00.000Z"),
          version: 3,
        },
        expressionDirective: {
          mode: "direct",
          allowProfanity: false,
          allowQuip: true,
        },
        limitations: ["personality persistence unavailable for this test"],
      }),
    }

    const assembled = await buildContext(deps, {
      userId: "user-personality",
      activeTask: "keep this direct",
    })

    expect(assembled.contextPacket.patterns).toHaveLength(1)
    expect(assembled.contextPacket.personality.version).toBe(3)
    expect(assembled.contextPacket.expressionDirective).toEqual({
      mode: "direct",
      allowProfanity: false,
      allowQuip: true,
    })
    expect(assembled.contextPacket.excludedContext).toContain(
      "personality persistence unavailable for this test",
    )
    expect(
      assembled.contextPacket.excludedContext.some((entry) =>
        entry.startsWith("patterns: not assembled"),
      ),
    ).toBe(false)
  })

  it("composes bounded canonical Knowledge Graph evidence into the model context", async () => {
    const deps = freshDeps()
    deps.knowledgeContextProvider = {
      getContext: async () => ({
        knowledge: [{
          id: "knowledge-node:brand:pupsonstuff",
          source: "knowledge-graph",
          observedAt: "2026-09-22T12:00:00.000Z",
          summary: "PupsonStuff [brand] attributes={\"channel\":\"social\"}",
          immutable: true,
        }],
        limitations: ["test provider is read-only"],
      }),
    }

    const assembled = await buildContext(deps, {
      userId: "user-knowledge",
      activeTask: "What do we know about PupsonStuff social?",
    })

    expect(assembled.contextPacket.knowledge).toContainEqual(expect.objectContaining({
      id: "knowledge-node:brand:pupsonstuff",
      source: "knowledge-graph",
    }))
    expect(assembled.contextPacket.excludedContext).toContain(
      "knowledge: test provider is read-only",
    )
  })

  it("composes owner context as read-only Knowledge evidence without promoting it to Memory or Personality", async () => {
    const deps = freshDeps()
    deps.ownerContextProvider = {
      getContext: async () => ({
        hub: "https://solo.to/bookieandco",
        references: [{
          evidence: {
            id: "owner-context:bookieandco:hub",
            source: "owner-context:user-supplied-hub",
            observedAt: "2026-09-23T00:00:00.000Z",
            summary: "Canonical public owner-context hub supplied by the owner: solo.to/bookieandco",
            immutable: true,
          },
          ownerAuthored: true,
          contentType: "hub",
          sourceUrl: "https://solo.to/bookieandco",
          reuseScope: "context-only",
        }],
        limitations: ["read-only owner context"],
      }),
    }

    const assembled = await buildContext(deps, {
      userId: "user-owner-context",
      activeTask: "What does my public creative context add here?",
    })

    expect(assembled.contextPacket.ownerContext?.hub).toBe("https://solo.to/bookieandco")
    expect(assembled.contextPacket.knowledge).toContainEqual(expect.objectContaining({
      id: "owner-context:bookieandco:hub",
    }))
    expect(assembled.contextPacket.relevantMemories).toEqual([])
    expect(assembled.contextPacket.personality.version).toBe(0)
    expect(assembled.contextPacket.excludedContext).toContain("owner-context: read-only owner context")
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
