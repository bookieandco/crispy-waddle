import type { GrowthId } from "@jhadina/growth-core"
import type {
  SocialPatternPromotionRecord,
  SocialPatternPromotionStore,
} from "@jhadina/growth-core"

type SupabaseLike = {
  from(table: string): {
    upsert(values: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: { message: string } | null }>
    select(columns?: string): {
      eq(column: string, value: string): {
        order(column: string, options?: { ascending?: boolean }): PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
  }
}

const TABLE = "growth_social_pattern_promotions"

function toRow(record: SocialPatternPromotionRecord): Record<string, unknown> {
  return {
    id: record.id,
    hypothesis_id: record.hypothesisId,
    source_pattern_id: record.sourcePatternId,
    source_account_id: record.sourceAccountId,
    target_account_id: record.targetAccountId,
    target_audience_id: record.targetAudienceId,
    target_voice_id: record.targetVoiceId,
    strategy: record.strategy,
    confidence: record.confidence,
    status: record.status,
    source: record.source,
    experiment_id: record.experimentId,
    promoted_at: record.promotedAt,
  }
}

function fromRow(row: Record<string, unknown>): SocialPatternPromotionRecord {
  return {
    id: row.id as GrowthId,
    hypothesisId: row.hypothesis_id as GrowthId,
    sourcePatternId: row.source_pattern_id as GrowthId,
    sourceAccountId: row.source_account_id as GrowthId,
    targetAccountId: row.target_account_id as GrowthId,
    targetAudienceId: row.target_audience_id as GrowthId,
    targetVoiceId: row.target_voice_id as GrowthId,
    strategy: row.strategy as string,
    confidence: Number(row.confidence),
    status: "promoted",
    source: "validated_experiment",
    experimentId: row.experiment_id as GrowthId,
    promotedAt: row.promoted_at as string,
  }
}

export class SupabaseSocialPatternPromotionStore implements SocialPatternPromotionStore {
  constructor(private readonly client: SupabaseLike) {}

  async getById(id: GrowthId): Promise<SocialPatternPromotionRecord | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) throw new Error(`social pattern promotion lookup failed: ${error.message}`)
    return data ? fromRow(data) : null
  }

  async listForAccount(accountId: GrowthId): Promise<readonly SocialPatternPromotionRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("target_account_id", accountId)
      .order("promoted_at", { ascending: false })

    if (error) throw new Error(`social pattern promotion list failed: ${error.message}`)
    return (data ?? []).map(fromRow)
  }

  async upsert(record: SocialPatternPromotionRecord): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert(toRow(record), { onConflict: "id" })

    if (error) throw new Error(`social pattern promotion upsert failed: ${error.message}`)
  }
}
