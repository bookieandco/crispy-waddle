import { NextRequest, NextResponse } from 'next/server'
import { createSpatialWorkspaceRevision, type SpatialWorkspace } from '@jhadina/spatial-intelligence-core'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { createProductionSpatialContextProvider } from '@/lib/context/production-spatial-context-provider'
import { createSupabaseSpatialWorkspaceStore } from '@/lib/context/supabase-spatial-workspace-store'

export const dynamic = 'force-dynamic'

const workspaceIdFrom = (value: unknown): string => {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'spatial-default'
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) throw new Error('SPATIAL_WORKSPACE_ID_INVALID')
  return candidate
}

const layersFrom = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))].slice(0, 32)
  : []

async function verifiedUser(req: NextRequest): Promise<string> {
  const claimedUserId = req.headers.get('x-jhadina-user-id') || ''
  if (!claimedUserId) throw new Error('Not signed in')
  const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId })
  return identity.userId
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const userId = await verifiedUser(req)
    const provider = createProductionSpatialContextProvider(userId)
    if (!provider) return NextResponse.json({ success: false, error: 'Spatial provider is not configured' }, { status: 503 })

    const activeTask = typeof body?.activeTask === 'string' && body.activeTask.trim() ? body.activeTask.trim() : 'inspect spatial context'
    const temporalScope = body?.temporalScope && typeof body.temporalScope === 'object'
      ? {
          from: typeof body.temporalScope.from === 'string' ? body.temporalScope.from : null,
          to: typeof body.temporalScope.to === 'string' ? body.temporalScope.to : null,
          asOf: typeof body.temporalScope.asOf === 'string' ? body.temporalScope.asOf : null,
        }
      : undefined

    const context = await provider.getContext({
      userId,
      activeTask,
      geographicScope: body?.geographicScope ?? undefined,
      temporalScope,
    })

    const workspaceId = workspaceIdFrom(body?.workspaceId)
    const store = createSupabaseSpatialWorkspaceStore()
    let workspaceRevision: { revisionId: string; capturedAt: string } | null = null

    if (store && context) {
      const previous = await store.latest(workspaceId, userId)
      const now = new Date().toISOString()
      const previousSnapshot = previous?.snapshot
      const workspace: SpatialWorkspace = {
        workspaceId,
        ownerId: userId,
        geographicScope: body?.geographicScope ?? previousSnapshot?.geographicScope ?? null,
        selectedRefs: [...(previousSnapshot?.selectedRefs ?? [])],
        activeLayers: layersFrom(body?.layers).length ? layersFrom(body?.layers) : [...(previousSnapshot?.activeLayers ?? [])],
        filters: { ...(previousSnapshot?.filters ?? {}) },
        routes: [...(previousSnapshot?.routes ?? [])],
        annotations: [...(previousSnapshot?.annotations ?? [])],
        measurements: [...(previousSnapshot?.measurements ?? [])],
        timeCursor: null,
        replayState: 'LIVE',
        investigationRefs: [...(previousSnapshot?.investigationRefs ?? [])],
        activeClaimRefs: context.claims.map((ref) => ref.id),
        evidenceRefs: context.evidence.map((ref) => ref.id),
        realityRefs: context.reality.map((ref) => ref.id),
        janetPreferences: { ...(previousSnapshot?.janetPreferences ?? {}) },
        deliaContext: { ...(previousSnapshot?.deliaContext ?? {}) },
        marisaContext: { ...(previousSnapshot?.marisaContext ?? {}) },
        createdAt: previousSnapshot?.createdAt ?? now,
        updatedAt: now,
      }
      const revision = createSpatialWorkspaceRevision(workspace, 'spatial context refresh', now)
      await store.append(revision)
      workspaceRevision = { revisionId: revision.revisionId, capturedAt: revision.capturedAt }
    }

    return NextResponse.json({ success: true, data: { context: context ?? null, workspaceRevision } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spatial query failed'
    const status = /identity|session|Authenticated|Not signed in/.test(message) ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await verifiedUser(req)
    const store = createSupabaseSpatialWorkspaceStore()
    if (!store) return NextResponse.json({ success: false, error: 'Spatial workspace store is not configured' }, { status: 503 })
    const workspaceId = workspaceIdFrom(req.nextUrl.searchParams.get('workspaceId'))
    const asOf = req.nextUrl.searchParams.get('asOf')
    const revision = asOf
      ? await store.atOrBefore(workspaceId, userId, asOf)
      : await store.latest(workspaceId, userId)
    return NextResponse.json({ success: true, data: { revision: revision ?? null } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spatial replay failed'
    const status = /identity|session|Authenticated|Not signed in/.test(message) ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
