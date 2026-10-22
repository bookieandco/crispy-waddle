/**
 * Private Round 1 interview import. No personal answers ship with application source.
 * This is a DATA contract, not PersonalityState, executable prompts, or approval.
 */
export const ROUND_ONE_SCHEMA = "jhadina.interview.round1.v1" as const
export const ROUND_ONE_MAX_QUESTION = 120
export const ROUND_ONE_FILE_LIMIT = 256 * 1024
export type RoundOneEntry = {
  questionId: string
  questionNumber: number
  topic: string
  answer: string
  provenance: "direct-user-reply-in-chat"
  status: "answered"
}
export type RoundOneLedger = {
  schemaVersion: typeof ROUND_ONE_SCHEMA
  round: 1
  status: "closed"
  closedAfterQuestion: 120
  source: "owner-chat-answers"
  entries: RoundOneEntry[]
}
function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}
export function parseRoundOneEntry(value: unknown): RoundOneEntry {
  const entry = objectValue(value)
  if (!entry) throw new Error("Invalid interview entry")
  const number = entry.questionNumber
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > ROUND_ONE_MAX_QUESTION) {
    throw new Error("Question number must be in the completed Round 1 range")
  }
  const expectedId = "R1-Q" + String(number).padStart(3, "0")
  if (entry.questionId !== expectedId || entry.status !== "answered" || entry.provenance !== "direct-user-reply-in-chat") {
    throw new Error("Question ID, status, or provenance is invalid")
  }
  const topic = entry.topic
  const answer = entry.answer
  if (typeof topic !== "string" || topic.trim().length < 3 || topic.length > 120 ||
      typeof answer !== "string" || answer.trim().length < 1 || answer.length > 750 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(topic + answer)) {
    throw new Error("Question " + number + ": invalid or oversized text")
  }
  return {
    questionId: expectedId, questionNumber: number,
    topic: topic.trim(), answer: answer.trim(),
    provenance: "direct-user-reply-in-chat", status: "answered",
  }
}
export function parseRoundOneLedger(value: unknown): RoundOneLedger {
  const ledger = objectValue(value)
  if (!ledger || ledger.schemaVersion !== ROUND_ONE_SCHEMA || ledger.round !== 1 ||
      ledger.status !== "closed" || ledger.closedAfterQuestion !== 120 ||
      ledger.source !== "owner-chat-answers" || !Array.isArray(ledger.entries) ||
      ledger.entries.length === 0 || ledger.entries.length > ROUND_ONE_MAX_QUESTION) {
    throw new Error("Expected a closed, owner-reviewed Jhadina Round 1 interview archive")
  }
  const entries = ledger.entries.map(parseRoundOneEntry)
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.questionId)) throw new Error("Duplicate interview answer: " + entry.questionId)
    seen.add(entry.questionId)
  }
  return {
    schemaVersion: ROUND_ONE_SCHEMA, round: 1, status: "closed",
    closedAfterQuestion: 120, source: "owner-chat-answers", entries,
  }
}
export function roundOneMemoryContent(entry: RoundOneEntry): string {
  const valid = parseRoundOneEntry(entry)
  const content = "Owner interview Round 1 " + valid.questionId + " (" + valid.topic + "): " + valid.answer
  if (content.length > 900) throw new Error("Interview memory candidate too large")
  return content
}
