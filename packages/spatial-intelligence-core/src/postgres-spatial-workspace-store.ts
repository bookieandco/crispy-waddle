import type { SpatialWorkspace } from './spatial-pipeline.js'
import { assertSpatialWorkspaceRevision, type SpatialWorkspaceRevision, type SpatialWorkspaceStore } from './spatial-workspace-store.js'

export type SpatialWorkspaceSqlClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>
}

export type PostgresSpatialWorkspaceStoreOptions = {
  client: SpatialWorkspaceSqlClient
  tableName?: string
}

type WorkspaceRevisionRow = {
  revision_id: string
  workspace_id: string
  owner_id: string
  captured_at: string
  reason: string
  snapshot: SpatialWorkspace
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('SPATIAL_WORKSPACE_TABLE_INVALID')
  return value
}

const fromRow = (row: WorkspaceRevisionRow): SpatialWorkspaceRevision => ({
  revisionId: row.revision_id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  capturedAt: row.captured_at,
  reason: row.reason,
  snapshot: row.snapshot,
})

/** PostgreSQL append-only workspace history. Replay reads historical snapshots; it never mutates them. */
export class PostgresSpatialWorkspaceStore implements SpatialWorkspaceStore {
  private readonly client: SpatialWorkspaceSqlClient
  private readonly table: string

  constructor(options: PostgresSpatialWorkspaceStoreOptions) {
    this.client = options.client
    this.table = identifier(options.tableName ?? 'jhadina_spatial_workspace_revisions')
  }

  async append(revision: SpatialWorkspaceRevision): Promise<'APPENDED' | 'DUPLICATE'> {
    assertSpatialWorkspaceRevision(revision)
    const result = await this.client.query<{ revision_id: string }>(
      `INSERT INTO ${this.table} (revision_id,workspace_id,owner_id,captured_at,reason,snapshot)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (revision_id) DO NOTHING
       RETURNING revision_id`,
      [revision.revisionId, revision.workspaceId, revision.ownerId, revision.capturedAt, revision.reason, JSON.stringify(revision.snapshot)],
    )
    if (result.rows[0]) return 'APPENDED'
    const existing = await this.client.query<WorkspaceRevisionRow>(
      `SELECT revision_id,workspace_id,owner_id,captured_at,reason,snapshot FROM ${this.table} WHERE revision_id=$1 LIMIT 1`,
      [revision.revisionId],
    )
    if (!existing.rows[0]) throw new Error('SPATIAL_WORKSPACE_APPEND_UNCONFIRMED')
    const current = fromRow(existing.rows[0])
    if (JSON.stringify(current) !== JSON.stringify(revision)) throw new Error('SPATIAL_WORKSPACE_REVISION_ID_CONFLICT')
    return 'DUPLICATE'
  }

  async latest(workspaceId: string, ownerId: string): Promise<SpatialWorkspaceRevision | undefined> {
    const result = await this.client.query<WorkspaceRevisionRow>(
      `SELECT revision_id,workspace_id,owner_id,captured_at,reason,snapshot FROM ${this.table}
       WHERE workspace_id=$1 AND owner_id=$2 ORDER BY captured_at DESC, revision_id DESC LIMIT 1`,
      [workspaceId, ownerId],
    )
    return result.rows[0] ? fromRow(result.rows[0]) : undefined
  }

  async history(workspaceId: string, ownerId: string, limit = 100): Promise<SpatialWorkspaceRevision[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error('SPATIAL_WORKSPACE_HISTORY_QUERY_INVALID')
    const result = await this.client.query<WorkspaceRevisionRow>(
      `SELECT revision_id,workspace_id,owner_id,captured_at,reason,snapshot FROM ${this.table}
       WHERE workspace_id=$1 AND owner_id=$2 ORDER BY captured_at DESC, revision_id DESC LIMIT $3`,
      [workspaceId, ownerId, limit],
    )
    return result.rows.map(fromRow)
  }

  async atOrBefore(workspaceId: string, ownerId: string, timestamp: string): Promise<SpatialWorkspaceRevision | undefined> {
    if (Number.isNaN(Date.parse(timestamp))) throw new Error('SPATIAL_WORKSPACE_REPLAY_TIMESTAMP_INVALID')
    const result = await this.client.query<WorkspaceRevisionRow>(
      `SELECT revision_id,workspace_id,owner_id,captured_at,reason,snapshot FROM ${this.table}
       WHERE workspace_id=$1 AND owner_id=$2 AND captured_at <= $3 ORDER BY captured_at DESC, revision_id DESC LIMIT 1`,
      [workspaceId, ownerId, timestamp],
    )
    return result.rows[0] ? fromRow(result.rows[0]) : undefined
  }
}
