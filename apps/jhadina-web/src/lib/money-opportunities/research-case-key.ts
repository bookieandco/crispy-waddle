/**
 * SAM opportunity identifiers are the idempotency key for research cases.
 * Normalize only transport noise; never hash mutable opportunity fields such as
 * title or description because those can change between SAM pulls.
 */
export function researchCaseKey(opportunityId: string): string {
  const key = opportunityId.trim()
  if (!key) throw new Error("SAM opportunityId is required")
  return key
}
