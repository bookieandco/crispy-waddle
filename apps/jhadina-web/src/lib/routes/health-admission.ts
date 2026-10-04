export type DurableMemoryFailureCode =
  | "DATABASE_STORAGE_EXHAUSTED"
  | "DATABASE_RECOVERY"
  | "DURABLE_MEMORY_UNAVAILABLE"

export function classifyDurableMemoryFailure(error: unknown): DurableMemoryFailureCode {
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (/\b53100\b|no space left on device|disk(?: space)? (?:is )?full|storage exhausted/i.test(message)) {
    return "DATABASE_STORAGE_EXHAUSTED"
  }
  if (/\b57P03\b|database system is not accepting connections|hot standby mode is disabled|automatic recovery|redo in progress/i.test(message)) {
    return "DATABASE_RECOVERY"
  }
  return "DURABLE_MEMORY_UNAVAILABLE"
}
