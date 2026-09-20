import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { createProductionSpatialContextProvider } from '@/lib/context/production-spatial-context-provider'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const claimedUserId = req.headers.get('x-jhadina-user-id') || ''
  if (!claimedUserId) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId })
    const provider = createProductionSpatialContextProvider(identity.userId)
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
      userId: identity.userId,
      activeTask,
      geographicScope: body?.geographicScope ?? undefined,
      temporalScope,
    })
    return NextResponse.json({ success: true, data: { context: context ?? null } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spatial query failed'
    const status = /identity|session|Authenticated/.test(message) ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
