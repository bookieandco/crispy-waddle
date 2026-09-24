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
