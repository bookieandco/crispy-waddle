import type {
  PresenceCampaign,
  PresenceObservation,
  SellableOffer,
} from "@jhadina/growth-core"
import { createClient } from "../supabase/server"

export interface StoredPresenceCampaign {
  campaign: PresenceCampaign
  offers: readonly SellableOffer[]
  contentProjectId?: string
  status: "draft" | "active" | "completed" | "archived"
  updatedAt: string
}

type CampaignRow = {
  id: string
  user_id: string
  brand_id: string
  payload: {
    campaign: PresenceCampaign
    offers: SellableOffer[]
  }
  content_project_id: string | null
  status: StoredPresenceCampaign["status"]
  created_at: string
  updated_at: string
}

type ObservationRow = {
  id: string
  user_id: string
  campaign_id: string
  surface: string
  query_or_context: string
  observed_at: string
  outcome: PresenceObservation["outcome"]
  source_locator: string | null
  value: number | null
  evidence_refs: string[]
  created_at: string
}

function fromCampaignRow(row: CampaignRow): StoredPresenceCampaign {
  if (row.payload.campaign.id !== row.id) throw new Error("GROWTH_PRESENCE_CAMPAIGN_PAYLOAD_ID_MISMATCH")
  if (row.payload.campaign.brandId !== row.brand_id) throw new Error("GROWTH_PRESENCE_CAMPAIGN_PAYLOAD_BRAND_MISMATCH")
  return {
    campaign: row.payload.campaign,
    offers: Object.freeze([...(row.payload.offers ?? [])]),
    contentProjectId: row.content_project_id ?? undefined,
    status: row.status,
    updatedAt: row.updated_at,
  }
}

function fromObservationRow(row: ObservationRow): PresenceObservation {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    surface: row.surface,
    queryOrContext: row.query_or_context,
    observedAt: row.observed_at,
    outcome: row.outcome,
    sourceLocator: row.source_locator ?? undefined,
    value: row.value ?? undefined,
    evidenceRefs: Object.freeze([...(row.evidence_refs ?? [])]),
  }
}

export interface GrowthPresenceRepository {
  saveCampaign(input: {
    userId: string
    campaign: PresenceCampaign
    offers: readonly SellableOffer[]
    status?: StoredPresenceCampaign["status"]
    contentProjectId?: string
  }): Promise<StoredPresenceCampaign>
  getCampaign(userId: string, campaignId: string): Promise<StoredPresenceCampaign>
  listCampaigns(userId: string): Promise<StoredPresenceCampaign[]>
  linkContentProject(userId: string, campaignId: string, contentProjectId: string): Promise<StoredPresenceCampaign>
  recordObservation(userId: string, observation: PresenceObservation): Promise<PresenceObservation>
  listObservations(userId: string, campaignId?: string): Promise<PresenceObservation[]>
}

export function createGrowthPresenceRepository(): GrowthPresenceRepository {
  return {
    async saveCampaign(input) {
      if (!input.offers.length) throw new Error("GROWTH_PRESENCE_PERSISTENCE_OFFERS_REQUIRED")
      const knownOfferIds = new Set(input.offers.map((offer) => offer.id))
      if (input.campaign.offerIds.some((offerId) => !knownOfferIds.has(offerId))) {
        throw new Error("GROWTH_PRESENCE_PERSISTENCE_OFFER_SNAPSHOT_INCOMPLETE")
      }
      if (input.offers.some((offer) => offer.brandId !== input.campaign.brandId)) {
        throw new Error("GROWTH_PRESENCE_PERSISTENCE_BRAND_MISMATCH")
      }

      const supabase = await createClient()
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from("jhadina_growth_presence_campaigns")
        .upsert({
          id: input.campaign.id,
          user_id: input.userId,
          brand_id: input.campaign.brandId,
          payload: {
            campaign: input.campaign,
            offers: [...input.offers],
          },
          content_project_id: input.contentProjectId ?? null,
          status: input.status ?? "draft",
          updated_at: now,
        }, { onConflict: "user_id,id" })
        .select("*")
        .single<CampaignRow>()

      if (error || !data) {
        throw new Error(`GROWTH_PRESENCE_CAMPAIGN_SAVE_FAILED:${error?.message ?? "no row returned"}`)
      }
      if (data.user_id !== input.userId) throw new Error("GROWTH_PRESENCE_CAMPAIGN_OWNER_MISMATCH")
      return fromCampaignRow(data)
    },

    async getCampaign(userId, campaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_presence_campaigns")
        .select("*")
        .eq("user_id", userId)
        .eq("id", campaignId)
        .single<CampaignRow>()
      if (error || !data) throw new Error("GROWTH_PRESENCE_CAMPAIGN_NOT_FOUND")
      return fromCampaignRow(data)
    },

    async listCampaigns(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_presence_campaigns")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .returns<CampaignRow[]>()
      if (error) throw new Error(`GROWTH_PRESENCE_CAMPAIGNS_LIST_FAILED:${error.message}`)
      return (data ?? []).map(fromCampaignRow)
    },

    async linkContentProject(userId, campaignId, contentProjectId) {
      if (!contentProjectId.trim()) throw new Error("GROWTH_PRESENCE_CONTENT_PROJECT_REQUIRED")
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_presence_campaigns")
        .update({
          content_project_id: contentProjectId,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", campaignId)
        .select("*")
        .single<CampaignRow>()
      if (error || !data) {
        throw new Error(`GROWTH_PRESENCE_CONTENT_PROJECT_LINK_FAILED:${error?.message ?? "campaign unavailable"}`)
      }
      return fromCampaignRow(data)
    },

    async recordObservation(userId, observation) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_presence_observations")
        .upsert({
          id: observation.id,
          user_id: userId,
          campaign_id: observation.campaignId,
          surface: observation.surface,
          query_or_context: observation.queryOrContext,
          observed_at: observation.observedAt,
          outcome: observation.outcome,
          source_locator: observation.sourceLocator ?? null,
          value: observation.value ?? null,
          evidence_refs: [...observation.evidenceRefs],
        }, { onConflict: "user_id,id" })
        .select("*")
        .single<ObservationRow>()
      if (error || !data) {
        throw new Error(`GROWTH_PRESENCE_OBSERVATION_SAVE_FAILED:${error?.message ?? "no row returned"}`)
      }
      if (data.user_id !== userId) throw new Error("GROWTH_PRESENCE_OBSERVATION_OWNER_MISMATCH")
      return fromObservationRow(data)
    },

    async listObservations(userId, campaignId) {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_growth_presence_observations")
        .select("*")
        .eq("user_id", userId)
      if (campaignId) query = query.eq("campaign_id", campaignId)
      const { data, error } = await query
        .order("observed_at", { ascending: false })
        .returns<ObservationRow[]>()
      if (error) throw new Error(`GROWTH_PRESENCE_OBSERVATIONS_LIST_FAILED:${error.message}`)
      return (data ?? []).map(fromObservationRow)
    },
  }
}
