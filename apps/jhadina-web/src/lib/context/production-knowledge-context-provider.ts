import type { EvidenceRef } from "@jhadina/core-spine"
import type { KnowledgeContextProvider } from "./context-builder"
import { createServiceRoleClient } from "../supabase/service-role"
import { redactSecrets } from "./redact"

type KnowledgeNodeRow = {
  node_id: string
  node_type: string
  label: string
  attributes: Record<string, unknown> | null
  provenance_refs: unknown
  valid_from: string | null
  valid_to: string | null
  created_at: string | null
}

const MAX_SCAN = 100
const MAX_RESULTS = 8
const MAX_ATTRIBUTE_CHARS = 700

function keywords(text: string): string[] {
  return Array.from(new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3),
  ))
}

function canonicalText(row: KnowledgeNodeRow): string {
  return `${row.node_type} ${row.label} ${JSON.stringify(row.attributes ?? {})}`.toLowerCase()
}

function score(row: KnowledgeNodeRow, terms: string[]): number {
  const haystack = canonicalText(row)
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
}

function isCurrent(row: KnowledgeNodeRow, nowMs: number): boolean {
  if (!row.valid_to) return true
  const validTo = Date.parse(row.valid_to)
  return Number.isNaN(validTo) || validTo > nowMs
}

function summarize(row: KnowledgeNodeRow): string {
  const rawAttributes = JSON.stringify(row.attributes ?? {})
  const boundedAttributes = rawAttributes.length > MAX_ATTRIBUTE_CHARS
    ? `${rawAttributes.slice(0, MAX_ATTRIBUTE_CHARS)}…`
    : rawAttributes
  const provenance = Array.isArray(row.provenance_refs)
    ? row.provenance_refs.filter((value): value is string => typeof value === "string").slice(0, 6)
    : []
  const { redacted } = redactSecrets(
    `${row.label} [${row.node_type}] attributes=${boundedAttributes}${provenance.length ? ` provenance=${provenance.join(",")}` : ""}`,
  )
  return redacted
}

/**
 * Read-only production adapter from the canonical append-only Knowledge Graph
 * into Ask Jhadina's ContextPacket. It never admits, updates, deletes, or
 * executes anything; the model receives bounded evidence refs only.
 */
export function createProductionKnowledgeContextProvider(): KnowledgeContextProvider {
  return {
    async getContext(input) {
      const client = createServiceRoleClient()
      if (!client) {
        return {
          knowledge: [],
          limitations: ["service-role Knowledge Graph reader is not configured"],
        }
      }

      const { data, error } = await client
        .from("jhadina_knowledge_nodes")
        .select("node_id,node_type,label,attributes,provenance_refs,valid_from,valid_to,created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_SCAN)

      if (error) throw new Error(`KNOWLEDGE_CONTEXT_READ_FAILED:${error.message}`)

      const terms = keywords(input.activeTask)
      const nowMs = Date.now()
      const ranked = ((data ?? []) as KnowledgeNodeRow[])
        .filter((row) => isCurrent(row, nowMs))
        .map((row) => ({ row, score: score(row, terms) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || (b.row.created_at ?? "").localeCompare(a.row.created_at ?? ""))
        .slice(0, MAX_RESULTS)

      const knowledge: EvidenceRef[] = ranked.map(({ row }) => ({
        id: `knowledge-node:${row.node_id}`,
        source: "knowledge-graph",
        observedAt: row.valid_from ?? row.created_at ?? new Date(0).toISOString(),
        summary: summarize(row),
        immutable: true,
      }))

      return {
        knowledge,
        limitations: ranked.length === 0
          ? ["no relevant canonical Knowledge Graph nodes matched the current request"]
          : [],
      }
    },
  }
}
