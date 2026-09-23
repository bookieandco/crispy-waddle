import { NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await authorizedSchedulerRequest(request))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    environment: process.env.VERCEL_ENV ?? 'unknown',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
    admissionContract: "GLOBAL-PROD.FINAL.v1",
    configuration: {
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServerSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSupabasePublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
  })
}
