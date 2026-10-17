/**
 * Explicit owner instructions, not deductions from Facebook posts.
 * The canonical Memory approval flow remains the admission gate.
 * This convention is evidence text, never Jhadina PersonalityState.
 */
export const OWNER_INTERACTION_PREFIX = "Owner-approved Jhadina interaction preference: "

export function buildOwnerInteractionPreference(raw: string): string | null {
  const value = raw.replace(/[\\u0000-\\u001f\\u007f]/g, " ").replace(/\\s+/g, " ").trim()
  if (value.length < 15 || value.length > 350) return null
  return OWNER_INTERACTION_PREFIX + value
}

export function isOwnerInteractionPreference(content: string): boolean {
  return content.startsWith(OWNER_INTERACTION_PREFIX) &&
    content.length > OWNER_INTERACTION_PREFIX.length + 14 &&
    content.length <= OWNER_INTERACTION_PREFIX.length + 350
}
