import type { AnswerEngineObservation } from "@jhadina/growth-core"
import { createClient } from "../supabase/server"

type AnswerObservationRow = {
  id: string
  user_id: string
  campaign_id: string
  engine: string
  surface: string
  query: string
  query_hash: string
  query_family: string | null
  answer_text: string
  response_hash: string
  citations: Array<{ url: string; label?: string }>
  mentioned_entity_ids: string[]
  accuracy: AnswerEngineObservation["accuracy"]
  market: string | null
  locale: string | null
  observed_at: string
  evidence_refs: string[]
  created_at: string
}

export interface StoredAnswerObservation {
  observation: AnswerEngineObservation
  queryHash: string
}

export interface AnswerObservatoryRepository {
  save(userId: string, observation: AnswerEngineObservation, queryHash: string): Promise<StoredAnswerObservation>
  listByCampaign(userId: string, campaignId: string): Promise<StoredAnswerObservation[]>
  latestComparable(input: {
    userId: string
    campaignId: string
    engine: string
    queryHash: string
  }): Promise<StoredAnswerObservation | undefined>
}

export function createAnswerObservatoryRepository(): AnswerObservatoryRepository {
  return {
    async save(userId, observation, queryHash) {
      if (!queryHash.trim()) throw new Error("GROWTH_ANSWER_QUERY_HASH_REQUIRED")
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_answer_observations")
        .upsert({
          id: observation.id,
          user_id: userId,
          campaign_id: observation.campaignId,
          engine: observation.engine,
          surface: observation.surface,
          query: observation.query,
          query_hash: queryHash,
          query_family: observation.queryFamily ?? null,
          answer_text: observation.answerText,
          response_hash: observation.responseHash,
          citations: observation.citations,
          mentioned_entity_ids: observation.mentionedEntityIds,
          accuracy: observation.accuracy,
          market: observation.market ?? null,
          locale: observation.locale ?? null,
          observed_at: observation.observedAt,
          evidence_refs: observation.evidenceRefs,
        }, { onConflict: "user_id,id" })
        .select("*")
        .single<AnswerObservationRow>()
      if (error || !data) {
        throw new Error(`GROWTH_ANSWER_OBSERVATION_SAVE_FAILED:${error?.message ?? "no row returned"}`)
      }
      if (data.user_id !== userId) throw new Error("GROWTH_ANSWER_OBSERVATION_OWNER_MISMATCH")
      return fromRow(data)
    },

    async listByCampaign(userId, campaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_answer_observations")
        .select("*")
        .eq("user_id", userId)
        .eq("campaign_id", campaignId)
        .order("observed_at", { ascending: false })
        .returns<AnswerObservationRow[]>()
      if (error) throw new Error(`GROWTH_ANSWER_OBSERVATION_LIST_FAILED:${error.message}`)
      return (data ?? []).map(fromRow)
    },

    async latestComparable(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_answer_observations")
        .select("*")
        .eq("user_id", input.userId)
        .eq("campaign_id", input.campaignId)
        .eq("engine", input.engine)
        .eq("query_hash", input.queryHash)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle<AnswerObservationRow>()
      if (error) {
        throw new Error(`GROWTH_ANSWER_OBSERVATION_LATEST_FAILED:${error.message}`)
      }
      return data ? fromRow(data) : undefined
    },
  }
}

function fromRow(row: AnswerObservationRow): StoredAnswerObservation {
  return {
    observation: {
      id: row.id,
      campaignId: row.campaign_id,
      engine: row.engine,
      surface: row.surface,
      query: row.query,
      queryFamily: row.query_family ?? undefined,
      answerText: row.answer_text,
      responseHash: row.response_hash,
      citations: Object.freeze([...(row.citations ?? [])]),
      mentionedEntityIds: Object.freeze([...(row.mentioned_entity_ids ?? [])]),
      accuracy: row.accuracy,
      market: row.market ?? undefined,
      locale: row.locale ?? undefined,
      observedAt: row.observed_at,
      evidenceRefs: Object.freeze([...(row.evidence_refs ?? [])]),
      authority: "OBSERVATION_ONLY",
    },
    queryHash: row.query_hash,
  }
}
