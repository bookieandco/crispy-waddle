const CONTEXTUAL_READ_PATTERNS: readonly RegExp[] = [
  /\b(use|using|consider|based on|given)\b.{0,60}\b(what you know|my history|my preferences?|my goals?|my style|my personality|my past|my memories?|what you remember)\b/i,
  /\b(what you know|what you remember)\b.{0,60}\b(about me|about my)\b/i,
  /\b(my history|my preferences?|my goals?|my style|my personality|my memories?)\b.{0,60}\b(which|what|recommend|should|priority|prioritize)\b/i,
  /\b(which|what)\b.{0,50}\b(best for me|fits me|matches me)\b/i,
  /\bwhat do i usually\b/i,
  /\brecommend\b.{0,80}\b(for me|based on|using my|given my)\b/i,
]

/**
 * True only when the user explicitly asks a read/analysis answer to incorporate
 * personal/history context rather than returning a narrow deterministic state read.
 *
 * Callers must still decide whether the matched subsystem operation is read-only.
 * This function alone never routes mutating or consequential work through a model.
 */
export function requiresFullJllmContextForRead(activeTask: string): boolean {
  const normalized = activeTask.trim()
  if (!normalized) return false
  return CONTEXTUAL_READ_PATTERNS.some((pattern) => pattern.test(normalized))
}
