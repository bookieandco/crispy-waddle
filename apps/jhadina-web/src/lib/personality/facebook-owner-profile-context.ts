/**
 * Read-only relevance of approved OWNER style notes. No PersonalityState,
 * PatternPort or permissions mutation; this only selects a governed memory
 * when an owner explicitly requests a personalized communication style.
 */
export const OWNER_FACEBOOK_NOTE_PREFIX = "Owner-reviewed Facebook writing profile: "

export function ownerWritingNoteRelevant(content: string, activeTask: string): boolean {
  if (!content.startsWith(OWNER_FACEBOOK_NOTE_PREFIX)) return false
  return /\b(style|tone|voice|personality|personaliz\w*|humor|humour|jok\w*|banter|vibe|rapport|communicat\w*|how (?:you|we) (?:talk|speak)|speak to me|talk to me)\b/i.test(activeTask)
}
