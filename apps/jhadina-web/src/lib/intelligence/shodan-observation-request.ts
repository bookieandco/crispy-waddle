import { SHODAN_READ_CAPABILITIES, type ShodanReadCapability } from "@jhadina/intelligence-core"

const ALLOWED = new Set<string>(SHODAN_READ_CAPABILITIES)

export type ShodanObservationRequest = Readonly<{
  observationId: string
  subjectId: string
  capability: ShodanReadCapability
  observedAt?: string
}>

export function parseShodanObservationRequest(body: unknown): ShodanObservationRequest {
  if (!body || typeof body !== "object") throw new Error("OBSERVATION_REQUEST_BODY_REQUIRED")
  const value=body as Record<string,unknown>
  if (typeof value.observationId !== "string" || !value.observationId.trim()) throw new Error("OBSERVATION_ID_REQUIRED")
  if (typeof value.subjectId !== "string" || !value.subjectId.trim()) throw new Error("OBSERVATION_SUBJECT_REQUIRED")
  if (typeof value.capability !== "string" || !ALLOWED.has(value.capability)) throw new Error("OBSERVATION_CAPABILITY_NOT_READ_ONLY")
  if (value.observedAt !== undefined && (typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt)))) {
    throw new Error("OBSERVATION_TIMESTAMP_INVALID")
  }
  return Object.freeze({
    observationId:value.observationId.trim(),
    subjectId:value.subjectId.trim(),
    capability:value.capability as ShodanReadCapability,
    observedAt:value.observedAt as string|undefined,
  })
}
