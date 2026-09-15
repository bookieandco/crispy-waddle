export type SpatialFusionRelation = 'COMPATIBLE' | 'CORROBORATING' | 'CONFLICTING' | 'UNRESOLVED' | 'DUPLICATE_SOURCE';
export type SpatialSourceIndependence = 'INDEPENDENT' | 'SHARED_UPSTREAM' | 'UNKNOWN';

export type SpatialFusionObservation = {
  observationId: string;
  entityId: string;
  sourceId: string;
  observedAt: string | null;
  position: { lat: number; lon: number } | null;
  evidenceRefs: string[];
  sourceIndependence?: SpatialSourceIndependence;
};

export type SpatialFusionPolicy = {
  temporalOverlapMs: number;
  spatialAgreementMeters: number;
};

export type SpatialFusionResult = {
  fusionId: string;
  entityId: string | null;
  observationRefs: string[];
  evidenceRefs: string[];
  relation: SpatialFusionRelation;
  temporalOverlap: boolean | 'UNKNOWN';
  spatialAgreement: 'AGREES' | 'DISAGREES' | 'UNKNOWN';
  sourceIndependence: SpatialSourceIndependence;
  candidateState: Record<string, unknown>;
  determination: 'CORROBORATED' | 'DERIVED' | 'UNRESOLVED' | 'CONFLICTED';
  limitations: string[];
  createdAt: string;
};

const validTimestamp = (v: string | null): boolean => v === null || !Number.isNaN(Date.parse(v));
const distanceMeters = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const r = 6371008.8;
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
};

export function fuseSpatialObservations(inputs: SpatialFusionObservation[], policy: SpatialFusionPolicy, createdAt: string, fusionId = `fusion:${createdAt}`): SpatialFusionResult {
  if (inputs.length < 2) throw new Error('SPATIAL_FUSION_REQUIRES_MULTIPLE_OBSERVATIONS');
  if (!validTimestamp(createdAt) || policy.temporalOverlapMs < 0 || policy.spatialAgreementMeters < 0) throw new Error('SPATIAL_FUSION_POLICY_INVALID');
  for (const input of inputs) {
    if (!input.observationId || !input.entityId || !input.sourceId || !validTimestamp(input.observedAt)) throw new Error('SPATIAL_FUSION_INPUT_INVALID');
    if (input.position && (!Number.isFinite(input.position.lat) || !Number.isFinite(input.position.lon) || input.position.lat < -90 || input.position.lat > 90 || input.position.lon < -180 || input.position.lon > 180)) throw new Error('SPATIAL_FUSION_POSITION_INVALID');
  }
  const ordered = [...inputs].sort((a, b) => a.observationId.localeCompare(b.observationId));
  const observationRefs = [...new Set(ordered.map(x => x.observationId))];
  const evidenceRefs = [...new Set(ordered.flatMap(x => x.evidenceRefs))].sort();
  const sourceIds = new Set(ordered.map(x => x.sourceId));
  const independence = ordered.some(x => x.sourceIndependence === 'SHARED_UPSTREAM') ? 'SHARED_UPSTREAM' : sourceIds.size < ordered.length ? 'UNKNOWN' : ordered.every(x => x.sourceIndependence === 'INDEPENDENT') ? 'INDEPENDENT' : 'UNKNOWN';
  if (sourceIds.size < ordered.length) return { fusionId, entityId: ordered[0].entityId, observationRefs, evidenceRefs, relation: 'DUPLICATE_SOURCE', temporalOverlap: 'UNKNOWN', spatialAgreement: 'UNKNOWN', sourceIndependence: independence, candidateState: { observations: ordered.map(x => ({ observationId: x.observationId, position: x.position })) }, determination: 'UNRESOLVED', limitations: ['Observations share a source; they are not independent corroboration.'], createdAt };
  if (new Set(ordered.map(x => x.entityId)).size !== 1) return { fusionId, entityId: null, observationRefs, evidenceRefs, relation: 'UNRESOLVED', temporalOverlap: 'UNKNOWN', spatialAgreement: 'UNKNOWN', sourceIndependence: independence, candidateState: { entityIds: [...new Set(ordered.map(x => x.entityId))] }, determination: 'UNRESOLVED', limitations: ['Identity reconciliation is outside the fusion engine.'], createdAt };
  const times = ordered.map(x => x.observedAt).filter((x): x is string => x !== null).map(Date.parse);
  const temporalOverlap: boolean | 'UNKNOWN' = times.length < 2 ? 'UNKNOWN' : Math.max(...times) - Math.min(...times) <= policy.temporalOverlapMs;
  const positions = ordered.map(x => x.position).filter((x): x is { lat: number; lon: number } => x !== null);
  const spatialAgreement: 'AGREES' | 'DISAGREES' | 'UNKNOWN' = positions.length < 2 ? 'UNKNOWN' : Math.max(...positions.flatMap((p, i) => positions.slice(i + 1).map(q => distanceMeters(p, q)))) <= policy.spatialAgreementMeters ? 'AGREES' : 'DISAGREES';
  const corroborating = independence === 'INDEPENDENT' && temporalOverlap === true && spatialAgreement === 'AGREES';
  const conflicting = temporalOverlap === true && spatialAgreement === 'DISAGREES';
  return { fusionId, entityId: ordered[0].entityId, observationRefs, evidenceRefs, relation: corroborating ? 'CORROBORATING' : conflicting ? 'CONFLICTING' : 'UNRESOLVED', temporalOverlap, spatialAgreement, sourceIndependence: independence, candidateState: { observations: ordered.map(x => ({ observationId: x.observationId, position: x.position })) }, determination: corroborating ? 'CORROBORATED' : conflicting ? 'CONFLICTED' : 'UNRESOLVED', limitations: conflicting ? ['Spatial observations disagree within the evaluated temporal window.'] : independence !== 'INDEPENDENT' ? ['Source independence is not established.'] : [], createdAt };
}

export type SpatialAttentionCandidate = {
  ref: string;
  category: 'CHANGE' | 'CONFLICT' | 'INVESTIGATION' | 'ENTITY' | 'REGION' | 'SOURCE_HEALTH' | 'OTHER';
  reasons: string[];
  evidenceRefs: string[];
  limitations: string[];
  scopeMatch: boolean | 'UNKNOWN';
  temporalMatch: boolean | 'UNKNOWN';
  changed: boolean;
  conflict: boolean;
  investigationTarget: boolean;
  preferenceMatch: boolean;
};

export type SpatialAttentionResult = { items: SpatialAttentionCandidate[]; policyVersion: string };
export function rankSpatialAttention(candidates: SpatialAttentionCandidate[], policyVersion: string): SpatialAttentionResult {
  if (!policyVersion) throw new Error('SPATIAL_ATTENTION_POLICY_VERSION_REQUIRED');
  const rank = (x: SpatialAttentionCandidate) => [x.investigationTarget, x.conflict, x.changed, x.scopeMatch === true, x.temporalMatch === true, x.preferenceMatch].map(Boolean).map(Number).reduce((a, b) => a + b, 0);
  return { policyVersion, items: [...candidates].map(x => ({ ...x, reasons: [...x.reasons], evidenceRefs: [...new Set(x.evidenceRefs)].sort(), limitations: [...x.limitations] })).sort((a, b) => rank(b) - rank(a) || a.ref.localeCompare(b.ref)) };
}

export type SpatialWorkspace = { workspaceId: string; ownerId: string; geographicScope: unknown; selectedRefs: string[]; activeLayers: string[]; filters: Record<string, unknown>; routes: unknown[]; annotations: unknown[]; measurements: unknown[]; timeCursor: string | null; replayState: 'LIVE' | 'PAUSED' | 'REPLAY'; investigationRefs: string[]; activeClaimRefs: string[]; evidenceRefs: string[]; realityRefs: string[]; janetPreferences: Record<string, unknown>; deliaContext: Record<string, unknown>; marisaContext: Record<string, unknown>; createdAt: string; updatedAt: string };
export function assertSpatialWorkspace(workspace: SpatialWorkspace): void {
  if (!workspace.workspaceId || !workspace.ownerId) throw new Error('SPATIAL_WORKSPACE_IDENTITY_REQUIRED');
  if (!['LIVE', 'PAUSED', 'REPLAY'].includes(workspace.replayState)) throw new Error('SPATIAL_WORKSPACE_REPLAY_STATE_INVALID');
  if (workspace.timeCursor !== null && !validTimestamp(workspace.timeCursor)) throw new Error('SPATIAL_WORKSPACE_TIME_CURSOR_INVALID');
}

export type SpatialQueryKind = 'LOCATE' | 'OBSERVE' | 'COMPARE' | 'TRACE' | 'CORRELATE' | 'INVESTIGATE' | 'EXPLAIN' | 'HISTORICAL' | 'FORECAST_CONTEXT';
export type SpatialQuery = { queryId: string; kind: SpatialQueryKind; subject: string | null; geographicScope: unknown | null; temporalScope: { from: string | null; to: string | null; asOf: string | null }; requestedDomains: string[]; requiresEvidence: boolean };
export type SpatialQueryPlan = { queryId: string; capability: 'READ_SPATIAL_CONTEXT'; scope: unknown; temporalScope: SpatialQuery['temporalScope']; domains: string[]; evidenceRequired: boolean };
export function planSpatialQuery(query: SpatialQuery): SpatialQueryPlan {
  for (const t of [query.temporalScope.from, query.temporalScope.to, query.temporalScope.asOf]) if (!validTimestamp(t)) throw new Error('SPATIAL_QUERY_TIMESTAMP_INVALID');
  return { queryId: query.queryId, capability: 'READ_SPATIAL_CONTEXT', scope: query.geographicScope, temporalScope: query.temporalScope, domains: [...new Set(query.requestedDomains)].sort(), evidenceRequired: query.requiresEvidence };
}

export type SpatialReasoningOutput = { reasoningId: string; observations: string[]; scenarios: string[]; risks: string[]; alternatives: string[]; evidenceGaps: string[]; evidenceRefs: string[]; limitations: string[] };
export type SpatialOperationContext = { workspaceRef: string; approved: boolean; purpose: string; evidenceRefs: string[]; realityRefs: string[]; limitations: string[] };
export type DirectorSpatialContext = { location: unknown; timeWindow: { from: string | null; to: string | null }; activeCameras: string[]; sceneState: Record<string, unknown>; spatialEvents: string[]; relevantEntities: string[]; evidenceRefs: string[]; limitations: string[]; sourceHealth: Record<string, string> };
export type SpatialCapability = 'observe_scene' | 'inspect_spatial_context' | 'compare_scene' | 'inspect_camera' | 'request_video_window' | 'analyze_change' | 'correlate_sensors';
export const DIRECTOR_SPATIAL_CAPABILITIES: readonly SpatialCapability[] = ['observe_scene', 'inspect_spatial_context', 'compare_scene', 'inspect_camera', 'request_video_window', 'analyze_change', 'correlate_sensors'];

export type SpatialStream = { streamId: string; sourceId: string; capability: 'CONTINUOUS_STREAM' | 'LIVE_STREAM' | 'NEAR_REAL_TIME_STILL' | 'PERIODIC_STILL' | 'DELAYED' | 'HISTORICAL' | 'OFFLINE' | 'UNKNOWN'; endpoint: string; attribution: string; adapterVersion: string; allowlisted: boolean; licensedForReplay: boolean };
export function assertSpatialStream(stream: SpatialStream): void { if (!stream.streamId || !stream.sourceId || !stream.endpoint || !stream.adapterVersion) throw new Error('SPATIAL_STREAM_CONTRACT_INVALID'); if (!stream.allowlisted) throw new Error('SPATIAL_STREAM_ENDPOINT_NOT_ALLOWLISTED'); }

export type SpatialReadinessCheck = { id: string; result: 'PASS' | 'FAIL' | 'UNKNOWN'; rationale: string };
export type SpatialReadinessReport = { checks: SpatialReadinessCheck[]; architectureComplete: boolean; implementationComplete: boolean; productionReady: boolean };
export function evaluateSpatialReadiness(checks: SpatialReadinessCheck[]): SpatialReadinessReport {
  const failed = checks.some(c => c.result === 'FAIL');
  const unknown = checks.some(c => c.result === 'UNKNOWN');
  return { checks: [...checks], architectureComplete: !failed && !unknown, implementationComplete: !failed && !unknown, productionReady: false };
}
