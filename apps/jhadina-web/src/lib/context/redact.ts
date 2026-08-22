/**
 * Secret redaction — the Context Builder's "free of secrets" boundary.
 *
 * Memory/timeline content is user-authored text that was never meant to
 * carry credentials, but nothing upstream guarantees that. Every piece
 * of free text this module assembles into a ContextPacket passes through
 * here first, on the same "never trust upstream, verify at this
 * boundary" principle the rest of Phase 1 already applies to model
 * output. This is defense in depth, not a claim that Memory/Timeline
 * storage is otherwise unsafe.
 *
 * Deliberately pattern-based and conservative (over-redact rather than
 * miss something) — this is not a general secret-scanning product, just
 * the one boundary standing between stored text and a model payload.
 */

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk_(?:test|live)_[A-Za-z0-9]{8,}/gi, // Stripe-style secret keys
  /AIza[0-9A-Za-z_-]{10,}/g, // Google API key shape
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi, // Bearer auth headers
  /\b(?:api[_-]?key|secret|token|password|access[_-]?key)\s*[:=]\s*\S+/gi, // generic "key: value"
]

export function redactSecrets(text: string): { redacted: string; redactionCount: number } {
  let redacted = text
  let redactionCount = 0

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, () => {
      redactionCount += 1
      return "[REDACTED]"
    })
  }

  return { redacted, redactionCount }
}
