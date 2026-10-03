import type {ExpressionProsodyGenome} from "@jhadina/core-spine"

export type JhadinaInteractivePhase =
  | "idle"
  | "listening"
  | "understanding"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error"

export type JhadinaTurnSource = "typed" | "voice"

export interface JhadinaInteractiveTurn {
  id: string
  sequence: number
  source: JhadinaTurnSource
  text: string
  startedAt: string
}

export interface JhadinaConversationLine {
  id: string
  speaker: "user" | "jhadina"
  text: string
  createdAt: string
  turnId: string
}

export interface JhadinaInteractiveSnapshot {
  phase: JhadinaInteractivePhase
  activeTurn?: JhadinaInteractiveTurn
  lastCompletedSequence: number
  interruptedTurnIds: readonly string[]
}

export function createInteractiveSnapshot(): JhadinaInteractiveSnapshot {
  return Object.freeze({
    phase: "idle",
    lastCompletedSequence: 0,
    interruptedTurnIds: Object.freeze([]),
  })
}

export function beginInteractiveTurn(
  state: JhadinaInteractiveSnapshot,
  input: Omit<JhadinaInteractiveTurn, "sequence">,
): JhadinaInteractiveSnapshot {
  const turn = Object.freeze({
    ...input,
    text: input.text.trim(),
    sequence: state.lastCompletedSequence + 1,
  })
  if (!turn.text) return state
  return Object.freeze({
    ...state,
    phase: "understanding",
    activeTurn: turn,
  })
}

export function setInteractivePhase(
  state: JhadinaInteractiveSnapshot,
  phase: JhadinaInteractivePhase,
): JhadinaInteractiveSnapshot {
  return Object.freeze({ ...state, phase })
}

export function interruptInteractiveTurn(
  state: JhadinaInteractiveSnapshot,
): JhadinaInteractiveSnapshot {
  const id = state.activeTurn?.id
  return Object.freeze({
    ...state,
    phase: "interrupted",
    interruptedTurnIds: Object.freeze(
      id && !state.interruptedTurnIds.includes(id)
        ? [...state.interruptedTurnIds, id]
        : [...state.interruptedTurnIds],
    ),
  })
}

export function completeInteractiveTurn(
  state: JhadinaInteractiveSnapshot,
  turnId: string,
): JhadinaInteractiveSnapshot {
  if (state.activeTurn?.id !== turnId) return state
  return Object.freeze({
    ...state,
    phase: "listening",
    lastCompletedSequence: Math.max(state.lastCompletedSequence, state.activeTurn.sequence),
    activeTurn: undefined,
  })
}

/**
 * Stable chunks for progressive TTS. This is deliberately semantic-text only:
 * callbacks/cultural references remain separate governed render segments.
 */
export function chunkSpeechText(text: string, maxChars = 240): string[] {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []
  const bounded = Math.max(80, Math.min(500, Math.floor(maxChars)))
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized]
  const chunks: string[] = []
  let current = ""

  const flush = () => {
    const value = current.trim()
    if (value) chunks.push(value)
    current = ""
  }

  for (const rawSentence of sentences) {
    let sentence = rawSentence.trim()
    if (!sentence) continue

    if (sentence.length > bounded) {
      flush()
      const clauses = sentence.split(/(?<=[,;:])\s+/)
      let clauseChunk = ""
      for (const clause of clauses) {
        if ((clauseChunk + " " + clause).trim().length <= bounded) {
          clauseChunk = (clauseChunk + " " + clause).trim()
          continue
        }
        if (clauseChunk) chunks.push(clauseChunk)
        if (clause.length <= bounded) {
          clauseChunk = clause
          continue
        }
        for (let offset = 0; offset < clause.length; offset += bounded) {
          const piece = clause.slice(offset, offset + bounded).trim()
          if (piece) chunks.push(piece)
        }
        clauseChunk = ""
      }
      if (clauseChunk) chunks.push(clauseChunk)
      continue
    }

    const candidate = (current + " " + sentence).trim()
    if (candidate.length <= bounded) {
      current = candidate
    } else {
      flush()
      current = sentence
    }
  }

  flush()
  return chunks.slice(0, 64)
}

export function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && /abort/i.test(error.name + ":" + error.message)
}


export type WakeSpeechDecision =
  | { action: "ignore" }
  | { action: "activate" }
  | { action: "deactivate" }
  | { action: "command"; command: string; activates: boolean }

export function classifyWakeSpeech(
  transcript: string,
  conversationActive: boolean,
): WakeSpeechDecision {
  const value=transcript.trim()
  if(!value)return {action:"ignore"}

  if(
    conversationActive &&
    /^(?:(?:hey\s+)?jhadina[,.!]?\s*)?(?:stop listening|go to sleep|goodbye|that's all)[.!]?$/i.test(value)
  ){
    return {action:"deactivate"}
  }

  const wake=value.match(/(?:^|\s)(?:hey\s+)?jhadina[,.!]?\s*(.*)$/i)
  if(wake){
    const command=(wake[1]??"").trim()
    return command
      ? {action:"command",command,activates:true}
      : {action:"activate"}
  }

  return conversationActive
    ? {action:"command",command:value,activates:false}
    : {action:"ignore"}
}


export type GovernedSpeechSegmentKind = "semantic" | "quip" | "callback" | "cultural_reference"

export interface GovernedSpeechInputSegment {
  kind: GovernedSpeechSegmentKind
  text: string
  truthReconnect?: string
}

export interface PlannedSpeechSegment {
  kind: GovernedSpeechSegmentKind
  lane: "fast" | "main" | "tail"
  text: string
  maxChars: number
}

export interface GovernedSpeechPlan {
  segments: readonly PlannedSpeechSegment[]
  conversationText: string
}

function normalizedSpeechKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Reorders already-governed expression assets for spoken timing only.
 *
 * This function never invents a quip/callback/reference and never changes
 * semantic content. It only decides which already-admitted segment should be
 * heard first and how aggressively that segment should be chunked.
 */
export function planGovernedSpeech(
  input: readonly GovernedSpeechInputSegment[],
  options: { allowQuip?: boolean } = {},
): GovernedSpeechPlan {
  const semantic = input.filter((segment) => segment.kind === "semantic")
  const quips = options.allowQuip === false
    ? []
    : input.filter((segment) => segment.kind === "quip")
  const callbacks = input.filter((segment) => segment.kind === "callback")
  const cultural = input.filter((segment) => segment.kind === "cultural_reference")

  const ordered: PlannedSpeechSegment[] = []
  const seen = new Set<string>()

  const push = (
    segment: GovernedSpeechInputSegment,
    lane: PlannedSpeechSegment["lane"],
    maxChars: number,
  ) => {
    const text = [
      segment.text.trim(),
      segment.kind === "quip" ? segment.truthReconnect?.trim() : undefined,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
    if (!text) return
    const key = normalizedSpeechKey(text)
    if (!key || seen.has(key)) return
    seen.add(key)
    ordered.push(Object.freeze({ kind: segment.kind, lane, text, maxChars }))
  }

  // A short quip is the true fast lane. If there is no quip, one verified
  // callback can act as the conversational prelude. Avoid stacking both before
  // the useful answer; when both exist, the callback becomes a tail beat.
  if (quips[0]) push(quips[0], "fast", 120)
  else if (callbacks[0]) push(callbacks[0], "fast", 140)

  for (const segment of semantic) push(segment, "main", 220)

  if (quips[0] && callbacks[0]) push(callbacks[0], "tail", 160)
  for (const segment of cultural) push(segment, "tail", 180)

  const conversationText = ordered.map((segment) => segment.text).join(" ").trim()
  return Object.freeze({
    segments: Object.freeze(ordered),
    conversationText,
  })
}


export interface SpeechPresentation {
  register?: string
  speakingRate?: "slow" | "normal" | "fast"
  pauseDensity?: "low" | "moderate" | "high"
  prosodyGenome?: ExpressionProsodyGenome
}

export interface NativeSpeechDelivery {
  rate: number
  pauseScale: number
  style: string
  microPauseDensity?: number
  thoughtPauseDurationMs?: number
  pitchRange?: number
  pitchContour?: "level" | "gentle" | "dynamic"
  energy?: number
  warmth?: number
  groundedConfidence?: number
  conversationality?: number
  intimacy?: number
  breathiness?: number
  emphasisStrength?: number
  sentenceFinality?: number
  spontaneity?: number
  reactionIntensity?: number
  playfulness?: number
  operationalSass?: number
  absurdEscalation?: number
  poeticCompression?: number
  storytellingIntensity?: number
}

export function projectNativeSpeechDelivery(
  presentation?: SpeechPresentation,
  lane: PlannedSpeechSegment["lane"] = "main",
): NativeSpeechDelivery {
  const genome=presentation?.prosodyGenome
  const rate=presentation?.speakingRate==="slow"
    ? 0.9
    : presentation?.speakingRate==="fast"
      ? 1.08
      : 1
  const pauseScale=presentation?.pauseDensity==="high"
    ? 1.3
    : presentation?.pauseDensity==="moderate"
      ? 1.12
      : 0.95

  return Object.freeze({
    rate,
    pauseScale,
    style:presentation?.register??"default",
    ...(genome?{
      microPauseDensity:lane==="fast"?Math.min(genome.microPauseDensity,0.35):genome.microPauseDensity,
      thoughtPauseDurationMs:lane==="fast"?Math.min(genome.thoughtPauseDurationMs,180):genome.thoughtPauseDurationMs,
      pitchRange:genome.pitchRange,
      pitchContour:genome.pitchContour,
      energy:genome.energy,
      warmth:genome.warmth,
      groundedConfidence:genome.groundedConfidence,
      conversationality:genome.conversationality,
      intimacy:genome.intimacy,
      breathiness:genome.breathiness,
      emphasisStrength:genome.emphasis,
      sentenceFinality:genome.sentenceFinality,
      spontaneity:genome.spontaneity,
      reactionIntensity:genome.reactionIntensity,
      playfulness:genome.playfulness,
      operationalSass:genome.operationalSass,
      absurdEscalation:genome.absurdEscalation,
      poeticCompression:genome.poeticCompression,
      storytellingIntensity:genome.storytellingIntensity,
    }:{}),
  })
}
