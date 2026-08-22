const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi,
  /\b(?:api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi,
]

/**
 * Context is an egress boundary in reverse: text is sanitized before it can
 * become model-visible context. This is intentionally conservative; callers
 * should still avoid placing credentials in observations in the first place.
 */
export function redactContextText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[REDACTED]"),
    value,
  )
}

export function redactContextValue(value: unknown): unknown {
  if (typeof value === "string") return redactContextText(value)
  if (Array.isArray(value)) return value.map(redactContextValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, redactContextValue(child)]),
    )
  }
  return value
}
