import { NextRequest, NextResponse } from 'next/server'
import { checkKalshiAuthentication } from '@/lib/kalshi/kalshi-health'
import { authorizedGitHubWorkflowRequest } from '@/lib/internal-scheduler-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KALSHI_HEALTH_AUDIENCE = 'jhadina-kalshi-commissioning'
const KALSHI_HEALTH_WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/kalshi-live-health.yml@refs/heads/main'

export async function GET(request: NextRequest) {
  const authorized = await authorizedGitHubWorkflowRequest(request, {
    audience: KALSHI_HEALTH_AUDIENCE,
    workflowRef: KALSHI_HEALTH_WORKFLOW_REF,
  })

  if (!authorized) {
    return NextResponse.json(
      {
        ok: false,
        status: 'UNAUTHORIZED',
      },
      { status: 401 },
    )
  }

  const receipt = await checkKalshiAuthentication()

  return NextResponse.json(
    {
      ...receipt,
      // This route is intentionally read-only. It never returns account
      // balance, positions, orders, credentials, signatures, or private-key
      // material.
      authority: 'READ_ONLY_HEALTH',
      canTrade: false,
    },
    { status: receipt.ok ? 200 : 503 },
  )
}
