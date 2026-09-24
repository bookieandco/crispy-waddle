import { NextResponse } from 'next/server'
import { createPublicSatelliteSpatialProvider } from '@jhadina/spatial-intelligence-core'
import { createSpatialOidcGatewayClient } from '@/lib/context/spatial-oidc-gateway'

export const dynamic = 'force-dynamic'

export async function GET() {
  const provider = createPublicSatelliteSpatialProvider({ timeoutMs: 8_000 })
  const sources = await provider.health('private-analysis')
  const gateway = createSpatialOidcGatewayClient()

  let durable = {
    configured: Boolean(gateway),
    reachable: false,
    evidence: false,
    realityCandidates: false,
    realityAdmissions: false,
    knowledgeNodes: false,
    knowledgeRelations: false,
  }

  if (gateway) {
    try {
      const probe = await gateway.probe()
      durable = {
        configured: true,
        reachable: Object.values(probe).every(Boolean),
        ...probe,
      }
    } catch {
      durable = { ...durable, configured: true, reachable: false }
    }
  }

  const status = sources.status === 'READY' && durable.reachable ? 'READY' : 'DEGRADED'
  return NextResponse.json({
    status,
    sources,
    durable,
    deployment: {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
  }, {
    status: status === 'READY' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
