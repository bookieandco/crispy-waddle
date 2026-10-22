import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prepareInternalServicePilot, assessAutonomyCapability, type ServicePilotInput } from '@jhadina/opportunity-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Owner-only nonpersistent draft preview.
 * Existing commercial work-order runtime remains authoritative for any real client delivery.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  try {
    const payload = await request.json() as Partial<ServicePilotInput>
    if (!payload || !['research_report','qualified_leads','seo_audit'].includes(payload.kind ?? '') ||
        typeof payload.subject !== 'string' || !Array.isArray(payload.evidence) || payload.evidence.length > 50) {
      return NextResponse.json({ok:false,error:'Valid kind, subject and bounded evidence list required'},{status:400})
    }
    const pilot = prepareInternalServicePilot({
      kind:payload.kind!,
      subject:payload.subject,
      evidence:payload.evidence,
      createdAt:new Date().toISOString(),
    })
    const capability = assessAutonomyCapability({
      capability:pilot.kind === 'research_report' ? 'research' : pilot.kind === 'qualified_leads' ? 'qualified_leads' : 'seo_audit',
      executor:'unverified',
      providerPermission:'unknown',
      evidenceRefs:pilot.evidence.map(e=>e.sourceUrl),
    })
    return NextResponse.json({
      ok:true,pilot,capability,
      saved:false,delivered:false,paid:false,
      next:'Owner reviews evidence; real customer work uses the existing governed commercial-work-order runtime.',
    },{ headers:{ 'cache-control':'no-store' } })
  } catch (cause) {
    return NextResponse.json({ok:false,error:cause instanceof Error ? cause.message : 'Invalid pilot evidence'},{status:400})
  }
}
