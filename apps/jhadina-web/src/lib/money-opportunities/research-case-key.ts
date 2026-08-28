/** SAM opportunity identifier is the stable idempotency key for its research case. */
export function researchCaseKey(opportunityId: string): string {
  const key = opportunityId.trim()
  if (!key) throw new Error("SAM opportunityId is required")
  return key
}
