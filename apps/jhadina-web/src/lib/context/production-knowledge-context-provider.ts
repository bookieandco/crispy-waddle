import type { EvidenceRef } from "@jhadina/core-spine"
import type { KnowledgeContextProvider } from "./context-builder"
import { redactSecrets } from "./redact"
import { createServiceRoleClient } from "../supabase/service-role"

type KnowledgeEvidence = {
  id?: string
  sourceId?: string
  authorityScore?: number | string
  verificationState?: string
  freshnessState?: string
}

type KnowledgeRow = {
  id: string
  owner_id: string | null
  scope: string
  knowledge_type: string
  subject: string
  predicate: string
  claim: string
  object_json: unknown
  confidence: number | string
  verification_state: string
  authority_score: number | string
  freshness_score: number | string
  freshness_state: string
  observed_at: string
  valid_from: string | null
  valid_until: string | null
  superseded_by: string | null
  lexical_score: number | string
  evidence: KnowledgeEvidence[] | null
}

type TemporalState = "true_now" | "superseded" | "expired" | "disputed" | "unknown"

const LIMIT = 8
const CANDIDATE_LIMIT = 24
const MINIMUM_SCORE = 0.45

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2))
}

function overlap(left: string, right: string): number {
  const a = words(left)
  const b = words(right)
  if (!a.size || !b.size) return 0
  let matches = 0
  for (const term of a) if (b.has(term)) matches += 1
  return matches / Math.max(a.size, b.size)
}

function number(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function temporalState(row: KnowledgeRow, asOf: string): TemporalState {
  if (row.superseded_by) return "superseded"
  if (row.verification_state === "disputed") return "disputed"
  const now = Date.parse(asOf)
  if (row.valid_from && now < Date.parse(row.valid_from)) return "unknown"
  if (row.valid_until && now > Date.parse(row.valid_until)) return "expired"
  if (row.freshness_state === "expired") return "expired"
  if (row.freshness_state === "stale" || row.freshness_state === "changed") return "unknown"
  if (row.verification_state === "verified") return "true_now"
  return "unknown"
}

function rank(activeTask: string, row: KnowledgeRow, asOf: string) {
  const temporal = temporalState(row, asOf)
  const relevance = Math.max(overlap(activeTask, row.subject), overlap(activeTask, row.claim))
  const evidence = Array.isArray(row.evidence) ? row.evidence : []
  const corroboration = Math.min(
    1,
    evidence.filter((item) => item.verificationState === "verified").length / 2,
  )
  const verified = row.verification_state === "verified" ? 1 : 0
  const temporalWeight = temporal === "true_now" ? 1 : temporal === "unknown" ? 0.35 : 0
  const score =
    0.30 * relevance
    + 0.18 * number(row.confidence)
    + 0.16 * number(row.authority_score)
    + 0.12 * number(row.freshness_score)
    + 0.10 * verified
    + 0.08 * corroboration
    + 0.06 * temporalWeight

  return { row, temporal, score: Number(score.toFixed(6)) }
}

function contradictionLimitations(rows: KnowledgeRow[]): string[] {
  const groups = new Map<string, KnowledgeRow[]>()
  for (const row of rows) {
    const key = `${row.scope}|${row.subject.toLowerCase()}|${row.predicate}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  return [...groups.values()]
    .filter((group) => new Set(group.map((row) => JSON.stringify(row.object_json))).size > 1)
    .map((group) => `contradictory admissible knowledge for ${group[0]!.subject}; preserve uncertainty`)
}

function toEvidenceRef(row: KnowledgeRow, score: number, temporal: TemporalState): EvidenceRef {
  const { redacted } = redactSecrets(row.claim)
  return {
    id: row.id,
    source: "knowledge-core",
    observedAt: row.observed_at,
    summary: `${row.subject}: ${redacted} [score=${score.toFixed(3)}; ${temporal}; ${row.verification_state}; ${row.freshness_state}]`,
    immutable: false,
  }
}

/**
 * Production Ask Jhadina Knowledge adapter.
 *
 * This uses the canonical K-1.5 service-role RPC over jhadina_knowledge_records,
 * not the lower-level spatial graph. The RPC enforces ACTIVE/non-superseded
 * records, owner-or-global scope, temporal validity, and freshness before the
 * result can become model context. This adapter then applies the same
 * evidence-aware K-1.5 ranking shape and preserves weak/stale/contradictory
 * states as limitations instead of silently promoting them to truth.
 */
export function createProductionKnowledgeContextProvider(): KnowledgeContextProvider {
  return {
    async getContext(input) {
      const client = createServiceRoleClient()
      if (!client) {
        return {
          knowledge: [],
          limitations: ["canonical Knowledge runtime is not configured"],
        }
      }

      const asOf = new Date().toISOString()
      const { data, error } = await client.rpc("jhadina_query_knowledge", {
        p_query: input.activeTask,
        p_owner_id: input.userId,
        p_scope: null,
        p_as_of: asOf,
        p_limit: CANDIDATE_LIMIT,
        p_require_verified: false,
      })

      if (error) throw new Error(`KNOWLEDGE_CONTEXT_QUERY_FAILED:${error.message}`)

      const ranked = ((data ?? []) as KnowledgeRow[])
        .map((row) => rank(input.activeTask, row, asOf))
        .filter(({ temporal }) => temporal !== "superseded" && temporal !== "expired")
        .sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id))
        .slice(0, LIMIT)

      const limitations = contradictionLimitations(ranked.map(({ row }) => row))
      if (ranked.length === 0) {
        limitations.push("no admissible canonical Knowledge records matched the current request")
      } else {
        if (ranked[0]!.score < MINIMUM_SCORE) {
          limitations.push("top canonical Knowledge score is below the K-1.5 relevance threshold")
        }
        for (const item of ranked) {
          if (item.temporal === "unknown") {
            limitations.push(`knowledge ${item.row.id} is stale, changed, unverified, or temporally uncertain`)
          }
        }
      }

      return {
        knowledge: ranked.map(({ row, score, temporal }) => toEvidenceRef(row, score, temporal)),
        limitations: [...new Set(limitations)],
      }
    },
  }
}
