import { createClient } from "npm:@supabase/supabase-js@2.57.0"
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0"

const VERCEL_ISSUERS = new Set([
  "https://oidc.vercel.com/bookieandcos-projects",
  "https://oidc.vercel.com",
])
const VERCEL_AUDIENCE = "https://vercel.com/bookieandcos-projects"
const VERCEL_OWNER_ID = "team_NYQJ3NwijZZ6UJQdOdc5FjmX"
const VERCEL_PROJECT_ID = "prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco"
const VERCEL_PROJECT = "crispy-waddle-jhadina-web"
const VERCEL_OWNER = "bookieandcos-projects"

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com"
const GITHUB_AUDIENCE = "jhadina-spatial-gateway"
const GITHUB_REPOSITORY = "bookieandco/crispy-waddle"
const GITHUB_WORKFLOW = "GEV Satellite Live Certification"
const GITHUB_CERT_BRANCH = "feat/ask-jhadina-gev-bridge-20260923"

type JsonObject = Record<string, unknown>

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function mustObject(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value as JsonObject
}

function mustString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string`)
  return value
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${name} must be a string array`)
  }
  return [...value] as string[]
}

function stable(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (typeof value === "object") {
    const object = value as JsonObject
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`
  }
  throw new Error("non-json value")
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function authorize(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") ?? ""
  if (!authorization.startsWith("Bearer ")) return false
  const token = authorization.slice("Bearer ".length).trim()
  if (!token) return false

  let unverified: ReturnType<typeof decodeJwt>
  try {
    unverified = decodeJwt(token)
  } catch {
    return false
  }

  const issuer = typeof unverified.iss === "string" ? unverified.iss : ""
  try {
    if (issuer === GITHUB_ISSUER) {
      const jwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"))
      const { payload } = await jwtVerify(token, jwks, {
        issuer: GITHUB_ISSUER,
        audience: GITHUB_AUDIENCE,
      })
      const eventName = typeof payload.event_name === "string" ? payload.event_name : ""
      const headRef = typeof payload.head_ref === "string" ? payload.head_ref : ""
      const ref = typeof payload.ref === "string" ? payload.ref : ""
      return payload.repository === GITHUB_REPOSITORY
        && payload.workflow === GITHUB_WORKFLOW
        && (
          (eventName === "pull_request" && headRef === GITHUB_CERT_BRANCH)
          || (eventName === "workflow_dispatch" && ref === `refs/heads/${GITHUB_CERT_BRANCH}`)
        )
    }

    if (VERCEL_ISSUERS.has(issuer)) {
      const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`))
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: VERCEL_AUDIENCE })
      return payload.owner === VERCEL_OWNER
        && payload.owner_id === VERCEL_OWNER_ID
        && payload.project === VERCEL_PROJECT
        && payload.project_id === VERCEL_PROJECT_ID
        && (payload.environment === "production" || payload.environment === "preview")
    }
  } catch {
    return false
  }

  return false
}

function evidenceRow(evidenceValue: unknown): JsonObject {
  const evidence = mustObject(evidenceValue, "evidence")
  const source = mustObject(evidence.source, "evidence.source")
  const timing = mustObject(evidence.timing, "evidence.timing")
  const coverage = mustObject(evidence.coverage, "evidence.coverage")
  const payload = mustObject(evidence.payload, "evidence.payload")
  const transformation = mustObject(evidence.transformation, "evidence.transformation")
  const integrity = mustObject(evidence.integrity, "evidence.integrity")
  const hash = mustString(integrity.contentHash, "evidence.integrity.contentHash")
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("invalid evidence content hash")
  if (transformation.normalized !== true) throw new Error("evidence must be normalized")

  return {
    evidence_id: mustString(evidence.evidenceId, "evidence.evidenceId"),
    observation_id: mustString(evidence.observationId, "evidence.observationId"),
    provider: mustString(source.provider, "evidence.source.provider"),
    record_id: optionalString(source.recordId),
    attribution: optionalString(source.attribution),
    observed_at: optionalString(timing.observedAt),
    received_at: mustString(timing.receivedAt, "evidence.timing.receivedAt"),
    completeness: mustString(coverage.completeness, "evidence.coverage.completeness"),
    coverage: mustString(coverage.coverage, "evidence.coverage.coverage"),
    freshness: mustString(coverage.freshness, "evidence.coverage.freshness"),
    payload,
    adapter: mustString(transformation.adapter, "evidence.transformation.adapter"),
    adapter_version: mustString(transformation.adapterVersion, "evidence.transformation.adapterVersion"),
    content_hash: hash,
  }
}

function evidenceFromRow(row: JsonObject): JsonObject {
  return {
    evidenceId: row.evidence_id,
    observationId: row.observation_id,
    source: {
      provider: row.provider,
      recordId: row.record_id ?? null,
      attribution: row.attribution ?? null,
    },
    timing: {
      observedAt: row.observed_at ?? null,
      receivedAt: row.received_at,
    },
    coverage: {
      completeness: row.completeness,
      coverage: row.coverage,
      freshness: row.freshness,
    },
    payload: row.payload,
    transformation: {
      adapter: row.adapter,
      adapterVersion: row.adapter_version,
      normalized: true,
    },
    integrity: { contentHash: row.content_hash },
  }
}

function candidateRow(candidateValue: unknown): JsonObject {
  const candidate = mustObject(candidateValue, "candidate")
  return {
    candidate_id: mustString(candidate.candidateId, "candidate.candidateId"),
    entity_id: mustString(candidate.entityId, "candidate.entityId"),
    state: mustObject(candidate.state, "candidate.state"),
    determination: mustString(candidate.determination, "candidate.determination"),
    evidence_refs: stringArray(candidate.evidenceRefs, "candidate.evidenceRefs"),
    observation_refs: stringArray(candidate.observationRefs, "candidate.observationRefs"),
    fusion_refs: stringArray(candidate.fusionRefs, "candidate.fusionRefs"),
    created_at: mustString(candidate.createdAt, "candidate.createdAt"),
    valid_from: optionalString(candidate.validFrom),
    valid_to: optionalString(candidate.validTo),
    limitations: stringArray(candidate.limitations, "candidate.limitations"),
  }
}

function candidateFromRow(row: JsonObject): JsonObject {
  return {
    candidateId: row.candidate_id,
    entityId: row.entity_id,
    state: row.state,
    determination: row.determination,
    evidenceRefs: row.evidence_refs,
    observationRefs: row.observation_refs,
    fusionRefs: row.fusion_refs,
    createdAt: row.created_at,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    limitations: row.limitations,
  }
}

function admissionRow(admissionValue: unknown): JsonObject {
  const admission = mustObject(admissionValue, "admission")
  return {
    admission_id: mustString(admission.admissionId, "admission.admissionId"),
    candidate_id: mustString(admission.candidateId, "admission.candidateId"),
    decision: mustString(admission.decision, "admission.decision"),
    verifier: mustString(admission.verifier, "admission.verifier"),
    evidence_refs: stringArray(admission.evidenceRefs, "admission.evidenceRefs"),
    rationale: stringArray(admission.rationale, "admission.rationale"),
    created_at: mustString(admission.createdAt, "admission.createdAt"),
  }
}

function admissionFromRow(row: JsonObject): JsonObject {
  return {
    admissionId: row.admission_id,
    candidateId: row.candidate_id,
    decision: row.decision,
    verifier: row.verifier,
    evidenceRefs: row.evidence_refs,
    rationale: row.rationale,
    createdAt: row.created_at,
  }
}

function fail(error: { message: string; code?: string } | null, context: string): void {
  if (error) throw Object.assign(new Error(`${context}:${error.message}`), { code: error.code })
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" })
  if (!(await authorize(req))) return json(401, { error: "unauthorized" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: "supabase_admin_unavailable" })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const body = mustObject(await req.json(), "body")
    const action = mustString(body.action, "action")
    const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload as JsonObject
      : {}

    switch (action) {
      case "probe": {
        const checks = [
          ["evidence", "jhadina_spatial_evidence"],
          ["realityCandidates", "jhadina_spatial_reality_candidates"],
          ["realityAdmissions", "jhadina_spatial_reality_admissions"],
          ["knowledgeNodes", "jhadina_knowledge_nodes"],
          ["knowledgeRelations", "jhadina_knowledge_relations"],
        ] as const
        const result: JsonObject = {}
        for (const [key, table] of checks) {
          const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1)
          result[key] = !error
          fail(error, `probe:${table}`)
        }
        return json(200, { data: result })
      }

      case "appendEvidence": {
        const evidence = mustObject(payload.evidence, "evidence")
        const row = evidenceRow(evidence)
        const { integrity: _integrity, ...withoutIntegrity } = evidence
        const expectedHash = await sha256(`jhadina-spatial-evidence:v1:${stable(withoutIntegrity)}`)
        if (expectedHash !== row.content_hash) throw new Error("evidence content hash mismatch")

        const { error } = await supabase.from("jhadina_spatial_evidence").insert(row)
        if (!error) return json(200, { data: "APPENDED" })
        if (error.code !== "23505") fail(error, action)

        const { data, error: readError } = await supabase
          .from("jhadina_spatial_evidence")
          .select("evidence_id,content_hash")
          .eq("content_hash", row.content_hash)
          .maybeSingle()
        fail(readError, `${action}:duplicate-read`)
        if (data?.evidence_id) return json(200, { data: "DUPLICATE" })
        throw new Error("evidence id conflict")
      }

      case "getEvidence": {
        const evidenceId = mustString(payload.evidenceId, "evidenceId")
        const { data, error } = await supabase
          .from("jhadina_spatial_evidence")
          .select("evidence_id,observation_id,provider,record_id,attribution,observed_at,received_at,completeness,coverage,freshness,payload,adapter,adapter_version,content_hash")
          .eq("evidence_id", evidenceId)
          .maybeSingle()
        fail(error, action)
        return json(200, { data: data ? evidenceFromRow(data as JsonObject) : null })
      }

      case "persistKnowledge": {
        const contribution = mustObject(payload.contribution, "contribution")
        const nodes = Array.isArray(contribution.nodes) ? contribution.nodes : []
        const edges = Array.isArray(contribution.edges) ? contribution.edges : []
        const provenanceRefs = stringArray(contribution.evidenceRefs ?? [], "contribution.evidenceRefs")
        let nodeCount = 0
        let relationCount = 0

        for (const nodeValue of nodes) {
          const node = mustObject(nodeValue, "node")
          const attributes = mustObject(node.attributes, "node.attributes")
          const ref = mustString(node.ref, "node.ref")
          const row = {
            node_id: ref,
            node_type: mustString(node.type, "node.type"),
            label: typeof attributes.name === "string" && attributes.name.trim() ? attributes.name : ref,
            attributes: { ...attributes, spatial: true },
            provenance_refs: provenanceRefs,
            valid_from: null,
            valid_to: null,
          }
          const { error } = await supabase.from("jhadina_knowledge_nodes").insert(row)
          if (!error) {
            nodeCount += 1
          } else if (error.code === "23505") {
            const { data, error: readError } = await supabase
              .from("jhadina_knowledge_nodes")
              .select("node_id,node_type,label,attributes,provenance_refs,valid_from,valid_to")
              .eq("node_id", ref)
              .maybeSingle()
            fail(readError, `${action}:node-read`)
            if (!data || stable(data) !== stable(row)) throw new Error("knowledge node id conflict")
          } else fail(error, `${action}:node`)
        }

        for (const edgeValue of edges) {
          const edge = mustObject(edgeValue, "edge")
          const row = {
            relation_id: mustString(edge.edgeId, "edge.edgeId"),
            from_node_id: mustString(edge.fromRef, "edge.fromRef"),
            to_node_id: mustString(edge.toRef, "edge.toRef"),
            relation_type: mustString(edge.relation, "edge.relation"),
            attributes: { spatial: true },
            provenance_refs: stringArray(edge.evidenceRefs, "edge.evidenceRefs"),
            valid_from: optionalString(edge.validFrom),
            valid_to: optionalString(edge.validTo),
          }
          const { error } = await supabase.from("jhadina_knowledge_relations").insert(row)
          if (!error) {
            relationCount += 1
          } else if (error.code === "23505") {
            const { data, error: readError } = await supabase
              .from("jhadina_knowledge_relations")
              .select("relation_id,from_node_id,to_node_id,relation_type,attributes,provenance_refs,valid_from,valid_to")
              .eq("relation_id", row.relation_id)
              .maybeSingle()
            fail(readError, `${action}:relation-read`)
            if (!data || stable(data) !== stable(row)) throw new Error("knowledge relation id conflict")
          } else fail(error, `${action}:relation`)
        }

        return json(200, { data: { nodes: nodeCount, relations: relationCount } })
      }

      case "appendCandidate": {
        const row = candidateRow(payload.candidate)
        const { error } = await supabase.from("jhadina_spatial_reality_candidates").insert(row)
        if (!error) return json(200, { data: "APPENDED" })
        if (error.code !== "23505") fail(error, action)
        const { data, error: readError } = await supabase
          .from("jhadina_spatial_reality_candidates")
          .select("*").eq("candidate_id", row.candidate_id).maybeSingle()
        fail(readError, `${action}:read`)
        if (!data || stable(candidateFromRow(data as JsonObject)) !== stable(candidateFromRow(row))) {
          throw new Error("reality candidate id conflict")
        }
        return json(200, { data: "DUPLICATE" })
      }

      case "appendAdmission": {
        const row = admissionRow(payload.admission)
        const { error } = await supabase.from("jhadina_spatial_reality_admissions").insert(row)
        if (!error) return json(200, { data: "APPENDED" })
        if (error.code !== "23505") fail(error, action)
        const { data, error: readError } = await supabase
          .from("jhadina_spatial_reality_admissions")
          .select("*").eq("admission_id", row.admission_id).maybeSingle()
        fail(readError, `${action}:read`)
        if (!data || stable(admissionFromRow(data as JsonObject)) !== stable(admissionFromRow(row))) {
          throw new Error("reality admission id conflict")
        }
        return json(200, { data: "DUPLICATE" })
      }

      case "getCandidate": {
        const candidateId = mustString(payload.candidateId, "candidateId")
        const { data, error } = await supabase
          .from("jhadina_spatial_reality_candidates")
          .select("*").eq("candidate_id", candidateId).maybeSingle()
        fail(error, action)
        return json(200, { data: data ? candidateFromRow(data as JsonObject) : null })
      }

      case "getAdmissions": {
        const candidateId = mustString(payload.candidateId, "candidateId")
        const { data, error } = await supabase
          .from("jhadina_spatial_reality_admissions")
          .select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true })
        fail(error, action)
        return json(200, { data: (data ?? []).map((row) => admissionFromRow(row as JsonObject)) })
      }

      default:
        return json(400, { error: "unsupported_action" })
    }
  } catch (error) {
    console.error("jhadina-spatial-gateway", error instanceof Error ? error.message : String(error))
    return json(500, { error: "spatial_gateway_operation_failed" })
  }
})
