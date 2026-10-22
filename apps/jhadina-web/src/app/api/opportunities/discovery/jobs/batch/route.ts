import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { discoverPublicBoard } from '@/lib/opportunities/public-job-board'
import { runBoundedBoardCycle } from '@/lib/opportunities/autonomy-board-cycle'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Strictly owner-triggered bounded fetch; never silently schedules a repeating background job. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ ok:false, error:'Authentication required' }, {status:401})
  const body = await request.json().catch(()=>null) as { sources?: unknown; mode?: string } | null
  if (!body || !Array.isArray(body.sources) || !['owner_import','preview'].includes(body.mode??'')) {
    return NextResponse.json({ ok:false,error:'Provide 1-5 company boards and a preview/owner_import mode' }, {status:400})
  }
  try {
    const repository = createSupabaseOpportunityRepository()
    const result = await runBoundedBoardCycle({
      sources:body.sources,
      mode:body.mode as 'preview'|'owner_import',
      ownerAuthenticated:true,
    }, {
      discover:discoverPublicBoard,
      ingest:async opportunity=>{
        const saved=await repository.upsert(user.id,opportunity)
        return {id:saved.opportunity.id}
      },
    })
    return NextResponse.json({ok:result.failed.length===0,...result}, {
      status:result.failed.length?207:200,
      headers:{'cache-control':'no-store'},
    })
  } catch(cause) {
    return NextResponse.json({ok:false,error:cause instanceof Error?cause.message:'Discovery failed closed'}, {
      status:400,headers:{'cache-control':'no-store'},
    })
  }
}
