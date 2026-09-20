import { assertSpatialWorkspace, type SpatialWorkspace } from './spatial-pipeline.js'

export type SpatialWorkspaceRevision = {
  revisionId: string
  workspaceId: string
  ownerId: string
  capturedAt: string
  reason: string
  snapshot: SpatialWorkspace
}

export interface SpatialWorkspaceStore {
  append(revision: SpatialWorkspaceRevision): Promise<'APPENDED' | 'DUPLICATE'>
  latest(workspaceId: string, ownerId: string): Promise<SpatialWorkspaceRevision | undefined>
  history(workspaceId: string, ownerId: string, limit?: number): Promise<SpatialWorkspaceRevision[]>
  atOrBefore(workspaceId: string, ownerId: string, timestamp: string): Promise<SpatialWorkspaceRevision | undefined>
}

export function assertSpatialWorkspaceRevision(revision: SpatialWorkspaceRevision): void {
  if (!revision.revisionId || !revision.workspaceId || !revision.ownerId || !revision.reason) throw new Error('SPATIAL_WORKSPACE_REVISION_IDENTITY_REQUIRED')
  if (revision.workspaceId !== revision.snapshot.workspaceId || revision.ownerId !== revision.snapshot.ownerId) throw new Error('SPATIAL_WORKSPACE_REVISION_OWNER_MISMATCH')
  if (Number.isNaN(Date.parse(revision.capturedAt))) throw new Error('SPATIAL_WORKSPACE_REVISION_TIMESTAMP_INVALID')
  assertSpatialWorkspace(revision.snapshot)
}

const cloneRevision = (revision: SpatialWorkspaceRevision): SpatialWorkspaceRevision => ({
  ...revision,
  snapshot: {
    ...revision.snapshot,
    selectedRefs: [...revision.snapshot.selectedRefs],
    activeLayers: [...revision.snapshot.activeLayers],
    filters: { ...revision.snapshot.filters },
    routes: [...revision.snapshot.routes],
    annotations: [...revision.snapshot.annotations],
    measurements: [...revision.snapshot.measurements],
    investigationRefs: [...revision.snapshot.investigationRefs],
    activeClaimRefs: [...revision.snapshot.activeClaimRefs],
    evidenceRefs: [...revision.snapshot.evidenceRefs],
    realityRefs: [...revision.snapshot.realityRefs],
    janetPreferences: { ...revision.snapshot.janetPreferences },
    deliaContext: { ...revision.snapshot.deliaContext },
    marisaContext: { ...revision.snapshot.marisaContext },
  },
})

/** Test/development store with the same append-only semantics as the durable adapter. */
export class InMemorySpatialWorkspaceStore implements SpatialWorkspaceStore {
  private readonly revisions = new Map<string, SpatialWorkspaceRevision>()

  async append(revision: SpatialWorkspaceRevision): Promise<'APPENDED' | 'DUPLICATE'> {
    assertSpatialWorkspaceRevision(revision)
    const existing = this.revisions.get(revision.revisionId)
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(revision)) throw new Error('SPATIAL_WORKSPACE_REVISION_ID_CONFLICT')
      return 'DUPLICATE'
    }
    this.revisions.set(revision.revisionId, cloneRevision(revision))
    return 'APPENDED'
  }

  async latest(workspaceId: string, ownerId: string): Promise<SpatialWorkspaceRevision | undefined> {
    const rows = await this.history(workspaceId, ownerId, 1)
    return rows[0]
  }

  async history(workspaceId: string, ownerId: string, limit = 100): Promise<SpatialWorkspaceRevision[]> {
    if (!workspaceId || !ownerId || !Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error('SPATIAL_WORKSPACE_HISTORY_QUERY_INVALID')
    return [...this.revisions.values()]
      .filter((revision) => revision.workspaceId === workspaceId && revision.ownerId === ownerId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.revisionId.localeCompare(a.revisionId))
      .slice(0, limit)
      .map(cloneRevision)
  }

  async atOrBefore(workspaceId: string, ownerId: string, timestamp: string): Promise<SpatialWorkspaceRevision | undefined> {
    if (Number.isNaN(Date.parse(timestamp))) throw new Error('SPATIAL_WORKSPACE_REPLAY_TIMESTAMP_INVALID')
    const rows = await this.history(workspaceId, ownerId, 10_000)
    return rows.find((revision) => revision.capturedAt <= timestamp)
  }
}

export function createSpatialWorkspaceRevision(workspace: SpatialWorkspace, reason: string, capturedAt = new Date().toISOString()): SpatialWorkspaceRevision {
  assertSpatialWorkspace(workspace)
  if (!reason.trim() || Number.isNaN(Date.parse(capturedAt))) throw new Error('SPATIAL_WORKSPACE_REVISION_INVALID')
  return {
    revisionId: `${workspace.workspaceId}:${capturedAt}:${crypto.randomUUID()}`,
    workspaceId: workspace.workspaceId,
    ownerId: workspace.ownerId,
    capturedAt,
    reason: reason.trim(),
    snapshot: cloneRevision({ revisionId: 'clone', workspaceId: workspace.workspaceId, ownerId: workspace.ownerId, capturedAt, reason, snapshot: workspace }).snapshot,
  }
}
