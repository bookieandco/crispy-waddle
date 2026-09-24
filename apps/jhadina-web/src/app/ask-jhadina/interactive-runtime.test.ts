import { describe, expect, it } from "vitest"
import {
  beginInteractiveTurn,
  chunkSpeechText,
  completeInteractiveTurn,
  createInteractiveSnapshot,
  interruptInteractiveTurn,
  setInteractivePhase,
} from "./interactive-runtime"

describe("JHADINA-INTERACTIVE runtime", () => {
  it("moves a turn through understanding -> thinking -> speaking -> listening", () => {
    let state = createInteractiveSnapshot()
    state = beginInteractiveTurn(state, {
      id: "turn-1",
      source: "voice",
      text: "Jhadina, look at this",
      startedAt: "2026-09-23T00:00:00.000Z",
    })
    expect(state.phase).toBe("understanding")
    expect(state.activeTurn?.sequence).toBe(1)

    state = setInteractivePhase(state, "thinking")
    expect(state.phase).toBe("thinking")

    state = setInteractivePhase(state, "speaking")
    expect(state.phase).toBe("speaking")

    state = completeInteractiveTurn(state, "turn-1")
    expect(state.phase).toBe("listening")
    expect(state.activeTurn).toBeUndefined()
    expect(state.lastCompletedSequence).toBe(1)
  })

  it("records interrupted turn IDs without completing them", () => {
    let state = beginInteractiveTurn(createInteractiveSnapshot(), {
      id: "turn-2",
      source: "voice",
      text: "Stop, I meant something else",
      startedAt: "2026-09-23T00:00:00.000Z",
    })
    state = interruptInteractiveTurn(state)
    expect(state.phase).toBe("interrupted")
    expect(state.interruptedTurnIds).toEqual(["turn-2"])
    expect(state.lastCompletedSequence).toBe(0)
  })

  it("keeps stale turn completion from overwriting a newer turn", () => {
    let state = beginInteractiveTurn(createInteractiveSnapshot(), {
      id: "turn-old",
      source: "voice",
      text: "old",
      startedAt: "2026-09-23T00:00:00.000Z",
    })
    state = beginInteractiveTurn(state, {
      id: "turn-new",
      source: "voice",
      text: "new",
      startedAt: "2026-09-23T00:00:01.000Z",
    })
    const next = completeInteractiveTurn(state, "turn-old")
    expect(next.activeTurn?.id).toBe("turn-new")
  })

  it("chunks long speech into bounded semantic pieces", () => {
    const text = "First sentence. Second sentence is still concise. " +
      "Third sentence is intentionally longer, because progressive playback should not wait for a giant audio file before the first useful speech can begin."
    const chunks = chunkSpeechText(text, 80)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true)
    expect(chunks.join(" ")).toContain("First sentence.")
  })

  it("does not emit empty speech chunks", () => {
    expect(chunkSpeechText("   ")).toEqual([])
  })
})
