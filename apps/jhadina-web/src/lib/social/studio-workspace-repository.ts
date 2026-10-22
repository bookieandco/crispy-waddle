import type { JhadinaBrand, SocialStudioWorkspace } from "@jhadina/social-core"
import { validateSocialStudioWorkspace } from "@jhadina/social-core"
import { createClient } from "../supabase/server"
import { createSocialRepository } from "./repository"

type WorkspaceRow = {
  owner_user_id: string
  brand: JhadinaBrand
  payload: SocialStudioWorkspace
  revision: number
  updated_at: string
}

const STUDIO_FLAG = "JHADINA_SOCIAL_STUDIO_STORAGE_ENABLED"

/** No DDL, writes, or background sync until the owner-scoped SQL is commissioned. */
export function assertSocialStudioStorageReady() {
  if (process.env[STUDIO_FLAG] !== "true") {
    throw new Error("SOCIAL_STUDIO_STORAGE_NOT_COMMISSIONED")
  }
}

function verifyRow(row: WorkspaceRow, userId: string, brand: JhadinaBrand) {
  if (row.owner_user_id !== userId || row.brand !== brand ||
      !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error("SOCIAL_STUDIO_STORED_OWNER_OR_VERSION_MISMATCH")
  }
}

export async function loadSocialStudioWorkspace(userId: string, brand: JhadinaBrand) {
  assertSocialStudioStorageReady()
  const db = await createClient()
  const { data, error } = await db.from("jhadina_social_studio_workspaces")
    .select("owner_user_id,brand,payload,revision,updated_at")
    .eq("owner_user_id", userId).eq("brand", brand)
    .maybeSingle<WorkspaceRow>()
  if (error) throw new Error("SOCIAL_STUDIO_STORAGE_READ_FAILED")
  if (!data) return null
  verifyRow(data, userId, brand)
  // A stored working copy does NOT certify provider permission or a future slot.
  return { workspace: data.payload, revision: data.revision, updatedAt: data.updated_at }
}

export async function saveSocialStudioWorkspace(input: {
  userId: string
  brand: JhadinaBrand
  workspace: SocialStudioWorkspace
  expectedRevision: number | null
}) {
  assertSocialStudioStorageReady()
  const { userId, brand, expectedRevision, workspace } = input
  if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
    throw new Error("SOCIAL_STUDIO_REVISION_INVALID")
  }
  const accounts = await createSocialRepository().listAccounts(userId)
  validateSocialStudioWorkspace(workspace, userId, brand, accounts)

  const db = await createClient()
  let result: { data: WorkspaceRow | null; error: { code?: string; message: string } | null }
  if (expectedRevision === null) {
    const { data, error } = await db.from("jhadina_social_studio_workspaces")
      .insert({ owner_user_id: userId, brand, payload: workspace, revision: 1 })
      .select("owner_user_id,brand,payload,revision,updated_at")
      .maybeSingle<WorkspaceRow>()
    result = { data, error }
  } else {
    const { data, error } = await db.from("jhadina_social_studio_workspaces")
      .update({ payload: workspace, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
      .eq("owner_user_id", userId).eq("brand", brand).eq("revision", expectedRevision)
      .select("owner_user_id,brand,payload,revision,updated_at")
      .maybeSingle<WorkspaceRow>()
    result = { data, error }
  }

  if (result.error?.code === "23505" || (!result.data && !result.error)) {
    throw new Error("SOCIAL_STUDIO_REVISION_CONFLICT")
  }
  if (result.error || !result.data) throw new Error("SOCIAL_STUDIO_STORAGE_WRITE_FAILED")
  verifyRow(result.data, userId, brand)
  if (result.data.revision !== (expectedRevision ?? 0) + 1) {
    throw new Error("SOCIAL_STUDIO_REVISION_CONFLICT")
  }
  return { workspace: result.data.payload, revision: result.data.revision, updatedAt: result.data.updated_at }
}
