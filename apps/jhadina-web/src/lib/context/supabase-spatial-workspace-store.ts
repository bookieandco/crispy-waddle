import type {
  SpatialWorkspace,
  SpatialWorkspaceRevision,
  SpatialWorkspaceStore,
} from '@jhadina/spatial-intelligence-core'
import { assertSpatialWorkspaceRevision } from '@jhadina/spatial-intelligence-core'
import { createServiceRoleClient } from '../supabase/service-role'

type WorkspaceRow = {
  revision_id: string
  workspace_id: string
  owner_id: string
  captured_at: string
  reason: string
  snapshot: SpatialWorkspace
}

const fromRow = (row: WorkspaceRow): SpatialWorkspaceRevision => ({
  revisionId: row.revision_id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  capturedAt: row.captured_at,
  reason: row.reason,
  snapshot: row.snapshot,
})

export function createSupabaseSpatialWorkspaceStore(): SpatialWorkspaceStore | undefined {
  const client = createServiceRoleClient()
  if (!client) return undefined

  return {
    async append(revision) {
      assertSpatialWorkspaceRevision(revision)
      const { error } = await client.from('jhadina_spatial_workspace_revisions').insert({
        revision_id: revision.revisionId,
        workspace_id: revision.workspaceId,
        owner_id: revision.ownerId,
        captured_at: revision.capturedAt,
        reason: revision.reason,
        snapshot: revision.snapshot,
      })
      if (!error) return 'APPENDED'
      if (error.code === '23505') {
        const { data, error: readError } = await client
          .from('jhadina_spatial_workspace_revisions')
          .select('revision_id,workspace_id,owner_id,captured_at,reason,snapshot')
          .eq('revision_id', revision.revisionId)
          .maybeSingle()
        if (readError) throw new Error(`SPATIAL_WORKSPACE_DUPLICATE_READ_FAILED:${readError.message}`)
        if (data && JSON.stringify(fromRow(data as WorkspaceRow)) === JSON.stringify(revision)) return 'DUPLICATE'
        throw new Error('SPATIAL_WORKSPACE_REVISION_ID_CONFLICT')
      }
      throw new Error(`SPATIAL_WORKSPACE_APPEND_FAILED:${error.message}`)
    },

    async latest(workspaceId, ownerId) {
      const { data, error } = await client
        .from('jhadina_spatial_workspace_revisions')
        .select('revision_id,workspace_id,owner_id,captured_at,reason,snapshot')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', ownerId)
        .order('captured_at', { ascending: false })
        .order('revision_id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`SPATIAL_WORKSPACE_READ_FAILED:${error.message}`)
      return data ? fromRow(data as WorkspaceRow) : undefined
    },

    async history(workspaceId, ownerId, limit = 100) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error('SPATIAL_WORKSPACE_HISTORY_QUERY_INVALID')
      const { data, error } = await client
        .from('jhadina_spatial_workspace_revisions')
        .select('revision_id,workspace_id,owner_id,captured_at,reason,snapshot')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', ownerId)
        .order('captured_at', { ascending: false })
        .order('revision_id', { ascending: false })
        .limit(limit)
      if (error) throw new Error(`SPATIAL_WORKSPACE_HISTORY_FAILED:${error.message}`)
      return (data ?? []).map((row) => fromRow(row as WorkspaceRow))
    },

    async atOrBefore(workspaceId, ownerId, timestamp) {
      if (Number.isNaN(Date.parse(timestamp))) throw new Error('SPATIAL_WORKSPACE_REPLAY_TIMESTAMP_INVALID')
      const { data, error } = await client
        .from('jhadina_spatial_workspace_revisions')
        .select('revision_id,workspace_id,owner_id,captured_at,reason,snapshot')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', ownerId)
        .lte('captured_at', timestamp)
        .order('captured_at', { ascending: false })
        .order('revision_id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`SPATIAL_WORKSPACE_REPLAY_FAILED:${error.message}`)
      return data ? fromRow(data as WorkspaceRow) : undefined
    },
  }
}
