import { describe, expect, it } from "vitest"
import {
  beginInteractiveTurn,
  chunkSpeechText,
  classifyWakeSpeech,
  completeInteractiveTurn,
  createInteractiveSnapshot,
  interruptInteractiveTurn,
  planGovernedSpeech,
  projectNativeSpeechDelivery,
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

  it("activates once and accepts natural follow-up turns", () => {
    expect(classifyWakeSpeech("Jhadina", false)).toEqual({action:"activate"})
    expect(classifyWakeSpeech("Jhadina look at this", false)).toEqual({
      action:"command",
      command:"look at this",
      activates:true,
    })
    expect(classifyWakeSpeech("and compare it to yesterday", true)).toEqual({
      action:"command",
      command:"and compare it to yesterday",
      activates:false,
    })
  })

  it("requires an explicit wake before ordinary background speech becomes a command", () => {
    expect(classifyWakeSpeech("turn the music down", false)).toEqual({action:"ignore"})
  })

  it("honors an explicit sleep phrase inside an active conversation", () => {
    expect(classifyWakeSpeech("Jhadina go to sleep", true)).toEqual({action:"deactivate"})
  })

  it("puts one governed quip on the fast lane before the semantic answer", () => {
    const plan=planGovernedSpeech([
      {kind:"semantic",text:"The migration is fixed and the rollback path is intact."},
      {kind:"quip",text:"That bug came in wearing a fake mustache.",truthReconnect:"Found it."},
    ],{allowQuip:true})
    expect(plan.segments.map(segment=>[segment.kind,segment.lane,segment.maxChars])).toEqual([
      ["quip","fast",120],
      ["semantic","main",220],
    ])
    expect(plan.conversationText).toBe(
      "That bug came in wearing a fake mustache. Found it. The migration is fixed and the rollback path is intact."
    )
  })

  it("uses a verified callback as the fast prelude only when no quip exists", () => {
    const plan=planGovernedSpeech([
      {kind:"semantic",text:"Back to the deployment: the health gate is green."},
      {kind:"callback",text:"Same fake-mustache nonsense as last time."},
    ])
    expect(plan.segments.map(segment=>segment.kind)).toEqual(["callback","semantic"])
    expect(plan.segments[0]?.lane).toBe("fast")
  })

  it("does not stack quip and callback before the useful answer", () => {
    const plan=planGovernedSpeech([
      {kind:"semantic",text:"The useful answer goes here."},
      {kind:"quip",text:"Tiny joke."},
      {kind:"callback",text:"Verified shared callback."},
      {kind:"cultural_reference",text:"Verified cultural reference."},
    ])
    expect(plan.segments.map(segment=>[segment.kind,segment.lane])).toEqual([
      ["quip","fast"],
      ["semantic","main"],
      ["callback","tail"],
      ["cultural_reference","tail"],
    ])
  })

  it("suppresses the quip lane when the presentation forbids quips", () => {
    const plan=planGovernedSpeech([
      {kind:"semantic",text:"Serious answer."},
      {kind:"quip",text:"This must not be spoken."},
      {kind:"callback",text:"Verified callback."},
    ],{allowQuip:false})
    expect(plan.segments.map(segment=>segment.kind)).toEqual(["callback","semantic"])
    expect(plan.conversationText).not.toContain("must not be spoken")
  })

  it("deduplicates identical governed speech without rewriting it", () => {
    const plan=planGovernedSpeech([
      {kind:"semantic",text:"Same line."},
      {kind:"callback",text:"Same line."},
    ])
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0]?.text).toBe("Same line.")
  })


  it("projects the full prosody genome and shortens thought-pauses on the fast lane", () => {
    const genome={
      cadence:0.6,
      microPauseDensity:0.7,
      thoughtPauseDurationMs:640,
      pitchRange:0.65,
      pitchContour:"dynamic" as const,
      energy:0.72,
      warmth:0.81,
      groundedConfidence:0.9,
      conversationality:0.88,
      intimacy:0.44,
      breathiness:0.22,
      emphasis:0.76,
      sentenceFinality:0.67,
      spontaneity:0.8,
      reactionIntensity:0.74,
      playfulness:0.84,
      operationalSass:0.58,
      absurdEscalation:0.46,
      poeticCompression:0.35,
      storytellingIntensity:0.6,
    }
    const fast=projectNativeSpeechDelivery({
      register:"playful",
      speakingRate:"fast",
      pauseDensity:"high",
      prosodyGenome:genome,
    },"fast")
    expect(fast.rate).toBe(1.08)
    expect(fast.style).toBe("playful")
    expect(fast.thoughtPauseDurationMs).toBe(180)
    expect(fast.microPauseDensity).toBe(0.35)
    expect(fast.warmth).toBe(0.81)
    expect(fast.operationalSass).toBe(0.58)
    expect(fast.emphasisStrength).toBe(0.76)

    const main=projectNativeSpeechDelivery({prosodyGenome:genome},"main")
    expect(main.thoughtPauseDurationMs).toBe(640)
    expect(main.microPauseDensity).toBe(0.7)
  })

})
