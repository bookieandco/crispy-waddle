import { describe, expect, it } from "vitest"
import { emptyPersonalityState } from "@jhadina/core-spine"
import { buildContext } from "@/lib/context/context-builder"
import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { TimelineRepository } from "@/lib/repositories/TimelineRepository"
import { InMemoryStorage } from "@/lib/storage/InMemoryStorage"
import {
  parseReviewedOwnerNote,
  proposeReviewedFacebookOwnerNote,
} from "./facebook-owner-proposal"
import { suggestOwnerWritingSignals, formatOwnerWritingReview } from "./facebook-owner-signals"
import type { WritingSample } from "./facebook-owner-import"

const owner = "user-one"
const other = "user-two"
const note = {
  reviewed: true,
  content: "I often use contrast and brief storytelling turns when talking with people.",
  sourceCount: 16,
  signalIds: ["playful-contrast", "narrative-setup"],
}

describe("JH-FACEBOOK-OWNER-IMPORT.03–.05", () => {
  it("requires owner review and rejects passwords, forged signal IDs and raw payloads", () => {
    expect(() => parseReviewedOwnerNote({ ...note, reviewed: false })).toThrow()
    expect(() => parseReviewedOwnerNote({ ...note, signalIds: ["allow-payments"] })).toThrow()
    expect(() => parseReviewedOwnerNote({ ...note, signalIds: ["question-led", "question-led"] })).toThrow()
    expect(() => parseReviewedOwnerNote({ ...note, content: "My password: hardcoded-secret-value-123456" })).toThrow()
    expect(() => parseReviewedOwnerNote({ ...note, archive: "raw-data-here" })).toThrow()
    // Unknown fields are rejected rather than accidentally persisting raw archive content.
    expect(parseReviewedOwnerNote(note).signalIds).toEqual(["playful-contrast", "narrative-setup"])
  })

  it("requires repeated observable writing and permits selective, editable proposals", () => {
    const texts = [
      "I thought I knew the ending, but it flipped.",
      "When this happened, then we found another way.",
      "That seemed obvious, except the last part.",
      "One day this happened, then the room changed.",
      "Wait what did we just witness?!",
      "But what was the real reason?",
      "Actually no, that was the setup.",
      "When the plot twist lands, it lands.",
      "A short remark.",
      "Another short remark.",
    ]
    const samples: WritingSample[] = texts.map((text) => ({ kind: "post", text, source: "posts/your_posts.json" }))
    expect(suggestOwnerWritingSignals(samples.slice(0, 2))).toEqual([])
    const signals = suggestOwnerWritingSignals(samples)
    expect(signals.some((signal) => signal.id === "playful-contrast")).toBe(true)
    const text = formatOwnerWritingReview(samples, signals, ["playful-contrast"])
    expect(text).toContain("comic")
    expect(text).not.toContain("thought I knew")
    expect(text).not.toContain("politics")
    expect(text).toContain("not Jhadina")
  })

  it("keeps candidates pending, scoped by owner, and deduplicates retries", async () => {
    const storage = new InMemoryStorage()
    const input = parseReviewedOwnerNote(note)
    const one = await proposeReviewedFacebookOwnerNote(storage, owner, input)
    expect(one.status).toBe("PENDING")
    const again = await proposeReviewedFacebookOwnerNote(storage, owner, input)
    expect(again).toEqual({ status: "ALREADY_PENDING", candidateId: one.candidateId })
    const b = await proposeReviewedFacebookOwnerNote(storage, other, input)
    expect(b.status).toBe("PENDING")
    expect(b.candidateId).not.toBe(one.candidateId)
    const repo = new MemoryRepository(storage)
    expect(await repo.listApproved(owner)).toEqual([])
    await expect(repo.approve(one.candidateId!, other)).rejects.toThrow(/not authorized/)
    expect((await storage.listReasoningEvents(owner))[0].metadata).toMatchObject({
      ownerSelectedSignalIds: ["playful-contrast", "narrative-setup"],
      rawArchiveReceived: false,
      canModifyPersonalityState: false,
    })
  })

  it("only an approved note enters owner context; Jhadina's PersonalityState remains independent", async () => {
    const store = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(store)
    const timelineRepo = new TimelineRepository(store)
    const candidate = await proposeReviewedFacebookOwnerNote(store, owner, parseReviewedOwnerNote(note))
    const deps = { memoryRepo, timelineRepo }
    const input = { userId: owner, activeTask: "What communication style fits my Facebook writing profile?" }
    const before = await buildContext(deps, input)
    expect(before.contextPacket.relevantMemories).toEqual([])
    expect(before.contextPacket.personality.traits).toEqual([])

    const accepted = await memoryRepo.approve(candidate.candidateId!, owner)
    await timelineRepo.recordApproval({
      userId: owner, memoryId: accepted.id, memoryType: accepted.type, memoryContent: accepted.content,
    })
    const after = await buildContext(deps, input)
    expect(after.contextPacket.relevantMemories.map((m) => m.id)).toContain(accepted.id)
    expect(after.contextPacket.personality.traits).toEqual(emptyPersonalityState(new Date(0).toISOString()).traits)
    const unrelatedOwner = await buildContext(deps, { ...input, userId: other })
    expect(unrelatedOwner.contextPacket.relevantMemories).toEqual([])
    expect((await proposeReviewedFacebookOwnerNote(store, owner, parseReviewedOwnerNote(note))).status).toBe("ALREADY_APPROVED")

    await memoryRepo.forget(accepted.id, owner)
    const forgotten = await buildContext(deps, input)
    expect(forgotten.contextPacket.relevantMemories).toEqual([])
    expect((await proposeReviewedFacebookOwnerNote(store, owner, parseReviewedOwnerNote(note))).status).toBe("PENDING")
  })

  it("fails closed when durable memory probe fails", async () => {
    class UnavailableStorage extends InMemoryStorage {
      override async probe(): Promise<void> { throw new Error("storage unavailable") }
    }
    await expect(proposeReviewedFacebookOwnerNote(new UnavailableStorage(), owner, parseReviewedOwnerNote(note))).rejects.toThrow("storage unavailable")
  })
})
