import type { EvidenceRef, SpatialDomainContext } from "@jhadina/core-spine"
import { planSpatialQuery, type SpatialQuery, type SpatialQueryPlan, type SpatialWorkspace, assertSpatialWorkspace, type DirectorSpatialContext, DIRECTOR_SPATIAL_CAPABILITIES, type SpatialCapability, type SpatialStream, assertSpatialStream, type SpatialReadinessCheck, evaluateSpatialReadiness } from "./spatial-pipeline"

export type SpatialGraphNode = { ref: string; type: string; attributes: Record<string, unknown> }
export type SpatialGraphEdge = { edgeId: string; fromRef: string; toRef: string; relation: string; evidenceRefs: string[]; validFrom: string | null; validTo: string | null }

/** Provider-neutral graph contribution. It does not establish reality; evidence and admitted reality remain authoritative. */
export type SpatialGraphContribution = { nodes: SpatialGraphNode[]; edges: SpatialGraphEdge[]; evidenceRefs: string[]; limitations: string[] }

export function normalizeSpatialGraphContribution(input: SpatialGraphContribution): SpatialGraphContribution {
  const nodes = [...input.nodes].sort((a, b) => a.ref.localeCompare(b.ref)).map((n) => ({ ...n, attributes: { ...n.attributes } }))
  const edges = [...input.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId)).map((e) => ({ ...e, evidenceRefs: [...new Set(e.evidenceRefs)].sort() }))
  return { nodes, edges, evidenceRefs: [...new Set(input.evidenceRefs)].sort(), limitations: [...input.limitations] }
}

export type SpatialContextPackage = {
  subject: string | null
  geographicScope: unknown
  temporalScope: { from: string | null; to: string | null; asOf: string | null }
  observations: EvidenceRef[]
  evidence: EvidenceRef[]
  claims: EvidenceRef[]
  reality: EvidenceRef[]
  patterns: EvidenceRef[]
  predictions: EvidenceRef[]
  scenarios: EvidenceRef[]
  hypotheses: EvidenceRef[]
  sourceHealth: string[]
  conflicts: string[]
  uncertainty: string[]
  limitations: string[]
  workspaceRef: string | null
  investigationRef: string | null
  provenance: EvidenceRef[]
}

export function toSpatialDomainContext(pkg: SpatialContextPackage): SpatialDomainContext {
  return {
    observations: pkg.observations.map((x) => ({ ...x })),
    evidence: pkg.evidence.map((x) => ({ ...x })),
    claims: pkg.claims.map((x) => ({ ...x })),
    reality: pkg.reality.map((x) => ({ ...x })),
    attention: pkg.conflicts.map((ref, index) => ({ id: `attention:${index}:${ref}`, source: "spatial-attention", observedAt: null, summary: ref, immutable: true })),
    conflicts: [...pkg.conflicts],
    uncertainty: [...pkg.uncertainty],
    limitations: [...pkg.limitations],
    provenance: pkg.provenance.map((x) => ({ ...x })),
  }
}

export type SpatialQueryInterpreter = (text: string) => SpatialQuery | undefined
const spatialWords = /\b(near|around|at|inside|within|airport|camera|traffic|aircraft|flight|plane|vessel|ship|earthquake|fire|weather|satellite|spatial|map|location|where|changed|change|moved|route|track|investigate|why)\b/i
const spatialDomainRules: ReadonlyArray<{ domain: string; pattern: RegExp }> = [
  { domain: "camera", pattern: /\b(camera|cctv|view|frame)\b/i },
  { domain: "aircraft", pattern: /\b(aircraft|flight|plane|airport|aviation)\b/i },
  { domain: "vessel", pattern: /\b(vessel|ship|boat|ais|port|harbor)\b/i },
  { domain: "fire", pattern: /\b(fire|wildfire|firms|burn)\b/i },
  { domain: "earthquake", pattern: /\b(earthquake|quake|seismic)\b/i },
  { domain: "satellite", pattern: /\b(satellite|orbit|iss|tle)\b/i },
  { domain: "traffic", pattern: /\b(traffic|congestion|road)\b/i },
  { domain: "weather", pattern: /\b(weather|storm|wind|rain|snow)\b/i },
  { domain: "infrastructure", pattern: /\b(infrastructure|datacenter|dam|power|facility)\b/i },
]

export function inferSpatialDomains(text: string): string[] {
  const domains = spatialDomainRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.domain)
  return domains.length ? [...new Set(domains)].sort() : ["spatial"]
}

/** Conservative intent detection: false positives are preferable to silently issuing an action. */
export const defaultSpatialQueryInterpreter: SpatialQueryInterpreter = (text) => {
  if (!text.trim() || !spatialWords.test(text)) return undefined
  const lower = text.toLowerCase()
  const kind = lower.includes("why") ? "EXPLAIN" : lower.includes("changed") || lower.includes("change") ? "COMPARE" : lower.includes("where") || lower.includes("near") || lower.includes("around") ? "LOCATE" : lower.includes("investigate") ? "INVESTIGATE" : lower.includes("route") || lower.includes("track") ? "TRACE" : "OBSERVE"
  return {
    queryId: `spatial-query:${crypto.randomUUID()}`,
    kind,
    subject: text.trim(),
    geographicScope: null,
    temporalScope: { from: null, to: null, asOf: null },
    requestedDomains: inferSpatialDomains(text),
    requiresEvidence: true,
  }
}

export function interpretAndPlanSpatialQuery(text: string, interpreter: SpatialQueryInterpreter = defaultSpatialQueryInterpreter): SpatialQueryPlan | undefined {
  const query = interpreter(text)
  return query ? planSpatialQuery(query) : undefined
}

export interface SpatialContextReadProvider {
  read(plan: SpatialQueryPlan, userId: string): Promise<SpatialContextPackage | undefined>
}

export function createSpatialContextProvider(options: { userId: string; read: SpatialContextReadProvider; interpreter?: SpatialQueryInterpreter }) {
  return {
    async getContext(input: { userId: string; activeTask: string; geographicScope?: unknown; temporalScope?: SpatialQuery["temporalScope"] }) {
      const query = (options.interpreter ?? defaultSpatialQueryInterpreter)(input.activeTask)
      if (!query) return undefined
      const enriched: SpatialQuery = { ...query, geographicScope: input.geographicScope ?? query.geographicScope, temporalScope: input.temporalScope ?? query.temporalScope }
      const pkg = await options.read(planSpatialQuery(enriched), input.userId || options.userId)
      return pkg ? toSpatialDomainContext(pkg) : undefined
    },
  }
}

export type SpatialReasoningInput = SpatialContextPackage
export type SpatialReasoningResult = { scenarios: string[]; risks: string[]; alternatives: string[]; evidenceGaps: string[]; evidenceRefs: string[]; limitations: string[] }

/** DELIA boundary: reasoning can only consume the package; it cannot write claims or reality. */
export function reasonOverSpatialContext(input: SpatialReasoningInput): SpatialReasoningResult {
  const evidenceRefs = [...new Set(input.evidence.map((x) => x.id).concat(input.reality.map((x) => x.id)))].sort()
  const evidenceGaps = [...input.uncertainty, ...input.conflicts].filter(Boolean)
  return {
    scenarios: input.predictions.map((x) => x.summary),
    risks: input.conflicts,
    alternatives: input.hypotheses.map((x) => x.summary),
    evidenceGaps,
    evidenceRefs,
    limitations: [...new Set(input.limitations)],
  }
}

export function admitSpatialOperation(context: { workspaceRef: string; approved: boolean; purpose: string; evidenceRefs: string[]; realityRefs: string[]; limitations: string[] }) {
  if (!context.workspaceRef || !context.purpose) throw new Error("SPATIAL_OPERATION_CONTEXT_INVALID")
  if (!context.approved) return { allowed: false as const, reason: "explicit approval required" }
  return { allowed: true as const, context: { ...context, evidenceRefs: [...new Set(context.evidenceRefs)], realityRefs: [...new Set(context.realityRefs)] } }
}

export function directorSpatialCapabilities(): readonly SpatialCapability[] { return DIRECTOR_SPATIAL_CAPABILITIES }
export function assertDirectorSpatialContext(context: DirectorSpatialContext): void {
  if (!context.location && context.relevantEntities.length === 0) throw new Error("DIRECTOR_SPATIAL_CONTEXT_SCOPE_REQUIRED")
  if (context.evidenceRefs.length === 0) throw new Error("DIRECTOR_SPATIAL_CONTEXT_EVIDENCE_REQUIRED")
}

export type GevCameraRecord = { id: string; name: string; city: string; lat: number; lon: number; headingDeg?: number; fovDeg?: number; pitchDeg?: number; capability?: SpatialStream["capability"]; frameUrl?: string; mediaUrl?: string }

/** Normalizes GEV CCTV records without importing GEV's application state, renderer, or action layer. */
export function normalizeGevCamera(record: GevCameraRecord, sourceId: string, adapterVersion: string): SpatialGraphContribution {
  if (!record.id || !sourceId || !adapterVersion || !Number.isFinite(record.lat) || !Number.isFinite(record.lon)) throw new Error("GEV_CAMERA_RECORD_INVALID")
  if (record.lat < -90 || record.lat > 90 || record.lon < -180 || record.lon > 180) throw new Error("GEV_CAMERA_POSITION_INVALID")
  return normalizeSpatialGraphContribution({
    nodes: [{ ref: `camera:${record.id}`, type: "camera", attributes: { name: record.name, city: record.city, lat: record.lat, lon: record.lon, capability: record.capability ?? "UNKNOWN", sourceId, adapterVersion } }],
    edges: [],
    evidenceRefs: [],
    limitations: ["Camera location/pose is source data; coverage geometry is not proof of observation.", "GEV renderer state is not imported into Jhadina reality."] ,
  })
}

export function assertGevStreamForAdapter(stream: SpatialStream): void {
  assertSpatialStream(stream)
  if (!stream.attribution) throw new Error("SPATIAL_STREAM_ATTRIBUTION_REQUIRED")
  if (stream.capability === "UNKNOWN" || stream.capability === "OFFLINE") throw new Error("SPATIAL_STREAM_NOT_READABLE")
}

export type SpatialImplementationGate = { id: string; checks: SpatialReadinessCheck[] }
export function finalSpatialReadinessGate(gate: SpatialImplementationGate) {
  const report = evaluateSpatialReadiness(gate.checks)
  return { ...report, gateId: gate.id }
}

export function workspaceSnapshot(workspace: SpatialWorkspace): SpatialWorkspace {
  assertSpatialWorkspace(workspace)
  return {
    ...workspace,
    selectedRefs: [...workspace.selectedRefs], activeLayers: [...workspace.activeLayers], filters: { ...workspace.filters }, routes: [...workspace.routes], annotations: [...workspace.annotations], measurements: [...workspace.measurements], investigationRefs: [...workspace.investigationRefs], activeClaimRefs: [...workspace.activeClaimRefs], evidenceRefs: [...workspace.evidenceRefs], realityRefs: [...workspace.realityRefs], janetPreferences: { ...workspace.janetPreferences }, deliaContext: { ...workspace.deliaContext }, marisaContext: { ...workspace.marisaContext },
  }
}
