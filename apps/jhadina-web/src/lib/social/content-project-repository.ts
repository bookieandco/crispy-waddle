import type { ContentProject } from "@jhadina/social-core"
import { createClient } from "../supabase/server"

type ContentProjectRow = {
  id: string
  user_id: string
  brand: ContentProject["brand"]
  authority_position_ref: string
  pillar_ref: string
  big_idea_ref: string
  primary_job: ContentProject["primaryJob"]
  origin: ContentProject["origin"]
  presence_campaign_id: string | null
  payload: ContentProject
  created_at: string
  updated_at: string
}

export interface StoredContentProject {
  project: ContentProject
  presenceCampaignId?: string
}

function fromRow(row: ContentProjectRow): StoredContentProject {
  if (row.payload.id !== row.id) throw new Error("SOCIAL_CONTENT_PROJECT_PAYLOAD_ID_MISMATCH")
  if (row.payload.brand !== row.brand) throw new Error("SOCIAL_CONTENT_PROJECT_PAYLOAD_BRAND_MISMATCH")
  return {
    project: row.payload,
    presenceCampaignId: row.presence_campaign_id ?? undefined,
  }
}

export interface ContentProjectRepository {
  save(userId: string, project: ContentProject, presenceCampaignId?: string): Promise<StoredContentProject>
  get(userId: string, projectId: string): Promise<StoredContentProject>
  list(userId: string): Promise<StoredContentProject[]>
}

export function createContentProjectRepository(): ContentProjectRepository {
  return {
    async save(userId, project, presenceCampaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_content_projects")
        .upsert({
          id: project.id,
          user_id: userId,
          brand: project.brand,
          authority_position_ref: project.authorityPositionRef,
          pillar_ref: project.pillarRef,
          big_idea_ref: project.bigIdeaRef,
          primary_job: project.primaryJob,
          origin: project.origin,
          presence_campaign_id: presenceCampaignId ?? null,
          payload: project,
          updated_at: project.updatedAt,
        }, { onConflict: "user_id,id" })
        .select("*")
        .single<ContentProjectRow>()
      if (error || !data) {
        throw new Error(`SOCIAL_CONTENT_PROJECT_SAVE_FAILED:${error?.message ?? "no row returned"}`)
      }
      if (data.user_id !== userId) throw new Error("SOCIAL_CONTENT_PROJECT_OWNER_MISMATCH")
      return fromRow(data)
    },

    async get(userId, projectId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_content_projects")
        .select("*")
        .eq("user_id", userId)
        .eq("id", projectId)
        .single<ContentProjectRow>()
      if (error || !data) throw new Error("SOCIAL_CONTENT_PROJECT_NOT_FOUND")
      return fromRow(data)
    },

    async list(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_content_projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .returns<ContentProjectRow[]>()
      if (error) throw new Error(`SOCIAL_CONTENT_PROJECT_LIST_FAILED:${error.message}`)
      return (data ?? []).map(fromRow)
    },
  }
}
