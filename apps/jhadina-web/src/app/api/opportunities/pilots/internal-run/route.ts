import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/** Deprecated: arbitrary owner assertions are not independent source evidence.
 * Use the canonical opportunity route that fetches and hashes the real public pages.
 */
export async function POST() {
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401,headers:{'cache-control':'no-store'}})
  return NextResponse.json({
    ok:false,error:'Unverified internal run is disabled. Use the source-refetching canonical opportunity pilot.',
    next:'/api/opportunities/pilots/internal-run/from-opportunity',
    externalActionAuthorized:false,
  },{status:409,headers:{'cache-control':'no-store'}})
}
