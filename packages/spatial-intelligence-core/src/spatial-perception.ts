import { createGevSourcePolicyRegistry, type SpatialSourcePolicyRegistry } from './source-policy.js'

export type SpatialPerceptionDetection = {
  label: string
  confidence: number
  region?: { x: number; y: number; width: number; height: number }
  attributes?: Record<string, unknown>
}

export type SpatialPerceptionRequest = {
  sourceId: string
  frameEvidenceRef: string
  operation: string
  model: string
  modelVersion: string
  approvedForIncidentalPersonalData: boolean
  payloadRef: string
}

export type SpatialPerceptionAdapter = {
  analyze(request: SpatialPerceptionRequest): Promise<{ summary: string; detections: SpatialPerceptionDetection[]; limitations?: string[] }>
}

export type SpatialDerivedPerception = {
  perceptionId: string
  sourceId: string
  sourceEvidenceRefs: string[]
  determination: 'INFERRED'
  model: string
  modelVersion: string
  operation: string
  summary: string
  detections: SpatialPerceptionDetection[]
  limitations: string[]
  createdAt: string
  canonicalReality: false
}

function assertDetection(detection: SpatialPerceptionDetection): void {
  if (!detection.label || !Number.isFinite(detection.confidence) || detection.confidence < 0 || detection.confidence > 1) throw new Error('SPATIAL_PERCEPTION_DETECTION_INVALID')
  if (detection.region) {
    const { x, y, width, height } = detection.region
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0) throw new Error('SPATIAL_PERCEPTION_REGION_INVALID')
  }
}

/**
 * Explicit model-perception gate. Source policy must allow model input; public
 * imagery with incidental personal data additionally requires an explicit
 * approval bit. The result is derived/inferred and can never be returned as a
 * SpatialObservation or canonical reality.
 */
export async function runSpatialPerception(
  request: SpatialPerceptionRequest,
  adapter: SpatialPerceptionAdapter,
  registry: SpatialSourcePolicyRegistry = createGevSourcePolicyRegistry(),
  now = new Date().toISOString(),
): Promise<SpatialDerivedPerception> {
  if (!request.sourceId || !request.frameEvidenceRef || !request.operation || !request.model || !request.modelVersion || !request.payloadRef) throw new Error('SPATIAL_PERCEPTION_REQUEST_INVALID')
  if (Number.isNaN(Date.parse(now))) throw new Error('SPATIAL_PERCEPTION_TIMESTAMP_INVALID')
  const decision = registry.decide(request.sourceId, 'model-input')
  if (!decision.allowed) throw new Error(`SPATIAL_PERCEPTION_MODEL_INPUT_NOT_ALLOWED:${request.sourceId}:${decision.disposition}`)
  if (decision.policy.privacyClass === 'public-incidental-personal' && !request.approvedForIncidentalPersonalData) throw new Error('SPATIAL_PERCEPTION_PERSONAL_DATA_APPROVAL_REQUIRED')

  const result = await adapter.analyze({ ...request })
  if (!result.summary.trim()) throw new Error('SPATIAL_PERCEPTION_SUMMARY_REQUIRED')
  for (const detection of result.detections) assertDetection(detection)

  return {
    perceptionId: `spatial-perception:${crypto.randomUUID()}`,
    sourceId: request.sourceId,
    sourceEvidenceRefs: [request.frameEvidenceRef],
    determination: 'INFERRED',
    model: request.model,
    modelVersion: request.modelVersion,
    operation: request.operation,
    summary: result.summary.trim(),
    detections: result.detections.map((detection) => ({ ...detection, ...(detection.region ? { region: { ...detection.region } } : {}), ...(detection.attributes ? { attributes: { ...detection.attributes } } : {}) })),
    limitations: [...new Set([...(result.limitations ?? []), ...decision.policy.limitations, 'Model perception is derived intelligence and is not canonical reality.'])],
    createdAt: now,
    canonicalReality: false,
  }
}
