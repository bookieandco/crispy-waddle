import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PUBLIC_PRIME_REQUIRED_LEVELS,
  assessPublicPrimeCoverage,
  type PublicJurisdictionLevel,
  type PublicPrimeCoverageLevelMetrics,
} from '@jhadina/opportunity-core'

type JurisdictionRow={id:string;level:PublicJurisdictionLevel}
type SourceRow={
  id:string
  jurisdiction_id:string
  source_kinds:string[]
  verification_status:string
  adapter_status:string
}
type InboxAwardRow={source_id:string}
type AwardRow={source_id:string;awarded_prime_ref:string|null;awarded_prime_name:string}

const uniq=<T>(values:T[])=>[...new Set(values)]

function emptyLevel(level:PublicJurisdictionLevel):PublicPrimeCoverageLevelMetrics{
  return {
    level,
    jurisdictionCount:0,
    jurisdictionsWithVerifiedAwardSource:0,
    jurisdictionsWithActiveAwardAdapter:0,
    jurisdictionsWithAwardObservation:0,
    jurisdictionsWithPrimeObservation:0,
    distinctPrimeCount:0,
  }
}

export async function buildPublicPrimeCoverageSnapshot(
  client:SupabaseClient,
  input:{now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const [jurisdictionsResult,sourcesResult,inboxAwardsResult,awardsResult]=await Promise.all([
    client.from('jhadina_public_jurisdictions').select('id,level').returns<JurisdictionRow[]>(),
    client
      .from('jhadina_public_procurement_sources')
      .select('id,jurisdiction_id,source_kinds,verification_status,adapter_status')
      .returns<SourceRow[]>(),
    client
      .from('jhadina_public_opportunity_inbox')
      .select('source_id')
      .eq('active',true)
      .eq('stage','award')
      .returns<InboxAwardRow[]>(),
    client
      .from('jhadina_public_awards')
      .select('source_id,awarded_prime_ref,awarded_prime_name')
      .returns<AwardRow[]>(),
  ])
  if(jurisdictionsResult.error)throw new Error(`public_prime_coverage_jurisdiction_read_failed:${jurisdictionsResult.error.message}`)
  if(sourcesResult.error)throw new Error(`public_prime_coverage_source_read_failed:${sourcesResult.error.message}`)
  if(inboxAwardsResult.error)throw new Error(`public_prime_coverage_inbox_award_read_failed:${inboxAwardsResult.error.message}`)
  if(awardsResult.error)throw new Error(`public_prime_coverage_award_read_failed:${awardsResult.error.message}`)

  const jurisdictions=jurisdictionsResult.data??[]
  const sources=sourcesResult.data??[]
  const sourceToJurisdiction=new Map(sources.map(source=>[source.id,source.jurisdiction_id]))
  const jurisdictionLevel=new Map(jurisdictions.map(row=>[row.id,row.level]))

  const verifiedAwardJurisdictions=new Set(
    sources
      .filter(source=>
        ['official_owner_verified','official_portal_verified'].includes(source.verification_status)&&
        source.source_kinds.includes('award'),
      )
      .map(source=>source.jurisdiction_id),
  )
  const activeAwardJurisdictions=new Set(
    sources
      .filter(source=>
        source.adapter_status==='active'&&
        ['official_owner_verified','official_portal_verified'].includes(source.verification_status)&&
        source.source_kinds.includes('award'),
      )
      .map(source=>source.jurisdiction_id),
  )
  const awardObservationJurisdictions=new Set(
    (inboxAwardsResult.data??[])
      .map(row=>sourceToJurisdiction.get(row.source_id))
      .filter((value):value is string=>Boolean(value)),
  )
  const primeObservationJurisdictions=new Set(
    (awardsResult.data??[])
      .map(row=>sourceToJurisdiction.get(row.source_id))
      .filter((value):value is string=>Boolean(value)),
  )

  const primesByLevel=new Map<PublicJurisdictionLevel,Set<string>>(
    PUBLIC_PRIME_REQUIRED_LEVELS.map(level=>[level,new Set<string>()]),
  )
  for(const award of awardsResult.data??[]){
    const jurisdictionId=sourceToJurisdiction.get(award.source_id)
    const level=jurisdictionId?jurisdictionLevel.get(jurisdictionId):undefined
    if(!level)continue
    const prime=(award.awarded_prime_ref??award.awarded_prime_name).trim().toLowerCase()
    if(prime)primesByLevel.get(level)?.add(prime)
  }

  const levels=PUBLIC_PRIME_REQUIRED_LEVELS.map(level=>{
    const ids=jurisdictions.filter(row=>row.level===level).map(row=>row.id)
    return {
      ...emptyLevel(level),
      jurisdictionCount:ids.length,
      jurisdictionsWithVerifiedAwardSource:ids.filter(id=>verifiedAwardJurisdictions.has(id)).length,
      jurisdictionsWithActiveAwardAdapter:ids.filter(id=>activeAwardJurisdictions.has(id)).length,
      jurisdictionsWithAwardObservation:ids.filter(id=>awardObservationJurisdictions.has(id)).length,
      jurisdictionsWithPrimeObservation:ids.filter(id=>primeObservationJurisdictions.has(id)).length,
      distinctPrimeCount:primesByLevel.get(level)?.size??0,
    }
  })

  const distinctPrimes=uniq((awardsResult.data??[]).map(row=>(row.awarded_prime_ref??row.awarded_prime_name).trim().toLowerCase()).filter(Boolean))
  const metrics={
    levels,
    totalJurisdictions:jurisdictions.length,
    totalWithVerifiedAwardSource:verifiedAwardJurisdictions.size,
    totalWithActiveAwardAdapter:activeAwardJurisdictions.size,
    totalWithAwardObservation:awardObservationJurisdictions.size,
    totalWithPrimeObservation:primeObservationJurisdictions.size,
    totalDistinctPrimes:distinctPrimes.length,
    unhydratedLevels:levels.filter(row=>row.jurisdictionCount===0).map(row=>row.level),
  }
  const assessment=assessPublicPrimeCoverage(metrics)

  const {error:persistError}=await client.from('jhadina_public_prime_coverage_snapshots').upsert({
    id:`prime-coverage:${now}`,
    observed_at:now,
    status:assessment.status,
    source_coverage_pct:assessment.sourceCoveragePct,
    active_adapter_coverage_pct:assessment.activeAdapterCoveragePct,
    prime_observation_coverage_pct:assessment.primeObservationCoveragePct,
    metrics:assessment.metrics,
    coverage_debt:assessment.coverageDebt,
    missing_jurisdiction_levels:assessment.missingJurisdictionLevels,
    external_contact_authorized:false,
    bid_submission_authorized:false,
  },{onConflict:'id'})
  if(persistError)throw new Error(`public_prime_coverage_snapshot_persist_failed:${persistError.message}`)

  return assessment
}
