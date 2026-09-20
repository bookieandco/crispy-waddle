import type {
  SpatialTelemetryEvent,
  SpatialTelemetrySink,
} from '@jhadina/spatial-intelligence-core'

const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown'
const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null

/**
 * Structured production Spatial telemetry. Events intentionally contain only
 * low-cardinality operational metadata; raw observations, source payloads,
 * user IDs, secrets, and model inputs are never logged here.
 */
export const spatialProductionTelemetry: SpatialTelemetrySink = {
  record(event: SpatialTelemetryEvent) {
    console.info('[spatial-telemetry]', JSON.stringify({
      ...event,
      environment,
      deploymentSha,
    }))
  },
}
