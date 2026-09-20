export type SpatialTelemetryEventKind =
  | 'provider_health'
  | 'source_failure'
  | 'evidence_write'
  | 'reality_admission'
  | 'policy_denial'
  | 'workspace_replay'

export type SpatialTelemetryStatus =
  | 'ok'
  | 'degraded'
  | 'failed'
  | 'denied'
  | 'accepted'
  | 'deferred'
  | 'rejected'
  | 'superseded'
  | 'replayed'
  | 'miss'

export type SpatialTelemetryDetails = Record<string, string | number | boolean | null>

export type SpatialTelemetryEvent = {
  kind: SpatialTelemetryEventKind
  component: string
  status: SpatialTelemetryStatus
  at: string
  details: SpatialTelemetryDetails
}

export interface SpatialTelemetrySink {
  record(event: SpatialTelemetryEvent): void
}

/** Telemetry is observational only: sink failures can never change Spatial behavior. */
export function emitSpatialTelemetry(
  sink: SpatialTelemetrySink | undefined,
  event: SpatialTelemetryEvent,
): void {
  if (!sink) return
  try {
    sink.record({
      ...event,
      details: { ...event.details },
    })
  } catch {
    // Intentionally ignored. Runtime truth/policy paths must not depend on logging.
  }
}

/** Stable low-cardinality error code that avoids leaking provider/database details into logs. */
export function spatialTelemetryErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN'
  const [code] = error.message.split(':', 1)
  return (code || error.name || 'ERROR').slice(0, 96)
}
