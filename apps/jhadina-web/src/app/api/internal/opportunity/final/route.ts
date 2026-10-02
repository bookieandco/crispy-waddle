import { NextResponse } from 'next/server'
import { authorizedGitHubWorkflowRequest } from '@/lib/internal-scheduler-auth'
import { certifyAndPersistOpportunityFactoryProduction } from '@/lib/opportunities/opportunity-factory-final-runtime'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AUDIENCE = 'jhadina-opportunity-factory-final'
const WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/opportunity-factory-final.yml@refs/heads/main'

export async function POST(request: Request) {
  const authorized = await authorizedGitHubWorkflowRequest(request, {
    audience: AUDIENCE,
    workflowRef: WORKFLOW_REF,
  })
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sourceCommit = request.headers.get('x-source-commit')?.trim() ?? ''
  const assertedDeployedCommit = request.headers.get('x-deployed-commit')?.trim() ?? ''
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? ''
  const shaPattern = /^[0-9a-f]{40}$/i
  if (
    !shaPattern.test(sourceCommit) ||
    !shaPattern.test(assertedDeployedCommit) ||
    !shaPattern.test(deployedCommit) ||
    assertedDeployedCommit !== deployedCommit
  ) {
    return NextResponse.json({
      ok: false,
      error: 'OPPORTUNITY_FACTORY_DEPLOYMENT_SHA_MISMATCH',
      sourceCommit: sourceCommit || null,
      assertedDeployedCommit: assertedDeployedCommit || null,
      deployedCommit: deployedCommit || null,
    }, { status: 409 })
  }

  const service = createServiceRoleClient()
  if (!service) {
    return NextResponse.json({ ok: false, error: 'Opportunity Factory runtime unavailable' }, { status: 503 })
  }

  try {
    const certification = await certifyAndPersistOpportunityFactoryProduction(service, sourceCommit)
    return NextResponse.json({
      ok: true,
      sourceCommit,
      status: certification.report.status,
      report: certification.report,
      liveEvidence: certification.liveEvidence,
      ventureFactoryCertification: certification.ventureFactoryCertification,
      persistedFinalReceipt: certification.report.status === 'pass',
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      sourceCommit,
      error: error instanceof Error ? error.message : 'OPPORTUNITY_FACTORY_CERTIFICATION_FAILED',
    }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
