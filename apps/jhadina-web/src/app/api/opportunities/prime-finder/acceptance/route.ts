import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {certifyPrimeFinderPilot,hasAmbiguousAwardRecipient} from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'

/** Authenticated, read-only evidence; no writes or contacting contractors. */
export async function GET(){
  const auth=await createClient()
  const {data:{user},error:authError}=await auth.auth.getUser()
  if(authError||!user)return NextResponse.json({ok:false,error:'authentication_required'},{status:401})
  const db=createServiceRoleClient()
  if(!db)return NextResponse.json({ok:false,error:'prime_finder_db_unavailable'},{status:503})
  try{
    const today=new Date().toISOString().slice(0,10)
    const [latestScan,subnetScans,openSubnet,localAdapters,primes,edges]=await Promise.all([
      db.from('jhadina_sam_scan_runs').select('status,started_at,completed_at')
        .order('started_at',{ascending:false}).limit(1).maybeSingle(),
      db.from('jhadina_subnet_scan_runs').select('*',{count:'exact',head:true}).eq('status','completed'),
      db.from('jhadina_subnet_catalog').select('*',{count:'exact',head:true}).gte('closing_date',today),
      db.from('jhadina_public_procurement_sources').select('*',{count:'exact',head:true})
        .eq('adapter_status','active').in('verification_status',['official_owner_verified','official_portal_verified']),
      db.from('jhadina_public_prime_profiles').select('provider_id,provider_name,evidence_refs').limit(500),
      db.from('jhadina_relationship_edges').select('context_ref,evidence_refs,relation').eq('user_id',user.id)
        .eq('relation','matched_subcontractor').limit(1000),
    ])
    const errors=[latestScan.error,subnetScans.error,openSubnet.error,localAdapters.error,primes.error,edges.error]
    if(errors.some(Boolean))throw new Error('prime_finder_evidence_read_failed')
    // Do not imply exhaustive coverage if an unpaginated safety ceiling is hit.
    const boundedPrimeCount=(primes.data??[]).length===500?0:(primes.data??[])
      .filter(row=>Array.isArray(row.evidence_refs)&&row.evidence_refs.length>0)
      .filter(row=>!hasAmbiguousAwardRecipient(String(row.provider_name??''))).length
    const qualifiedEdges=edges.data??[]
    const pairs=new Set(qualifiedEdges
      .filter(row=>Array.isArray(row.evidence_refs)&&row.evidence_refs.length>0)
      .map(row=>String(row.context_ref??'')).filter(Boolean))
    const evidence={
      federalLatestScanSucceeded:latestScan.data?.status==='completed',
      subnetScanReceipts:subnetScans.count??0,
      activeSubnetListings:openSubnet.count??0,
      certifiedLocalAdapters:localAdapters.count??0,
      verifiedUniquePrimes:boundedPrimeCount,
      qualifiedPackageProviderMatches:qualifiedEdges.length,
      primeSubRelationshipEdges:qualifiedEdges.length,
      realSourcePilotPairs:pairs.size,
      // Neither a realized commission nor an outreach-audit receipt has been
      // established by these source tables. Unknown MUST remain blocked.
      evidencedCommercialOutcomes:0,
      unauthorizedOutreachActions:null,
    }
    return NextResponse.json({
      ok:true,
      observedAt:new Date().toISOString(),
      latestFederalScan:latestScan.data??null,
      evidence,
      certification:certifyPrimeFinderPilot(evidence),
      readOnly:true,
    },{headers:{'cache-control':'no-store'}})
  }catch{
    return NextResponse.json({ok:false,error:'prime_finder_evidence_unavailable'},{
      status:502,headers:{'cache-control':'no-store'},
    })
  }
}
