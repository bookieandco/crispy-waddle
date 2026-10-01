import type { PublicJurisdictionLevel } from './public-opportunity-grid.js'

export const PUBLIC_PRIME_REQUIRED_LEVELS:PublicJurisdictionLevel[]=[
  'state',
  'county',
  'city',
  'school_district',
  'special_district',
  'authority',
  'public_university',
  'public_hospital',
]

export type PublicPrimeCoverageLevelMetrics={
  level:PublicJurisdictionLevel
  jurisdictionCount:number
  jurisdictionsWithVerifiedAwardSource:number
  jurisdictionsWithActiveAwardAdapter:number
  jurisdictionsWithAwardObservation:number
  jurisdictionsWithPrimeObservation:number
  distinctPrimeCount:number
}

export type PublicPrimeCoverageMetrics={
  levels:PublicPrimeCoverageLevelMetrics[]
  totalJurisdictions:number
  totalWithVerifiedAwardSource:number
  totalWithActiveAwardAdapter:number
  totalWithAwardObservation:number
  totalWithPrimeObservation:number
  totalDistinctPrimes:number
  unhydratedLevels:PublicJurisdictionLevel[]
}

export type PublicPrimeCoverageAssessment={
  status:'FULL'|'PARTIAL'|'BLOCKED'
  sourceCoveragePct:number
  activeAdapterCoveragePct:number
  primeObservationCoveragePct:number
  missingJurisdictionLevels:PublicJurisdictionLevel[]
  coverageDebt:string[]
  metrics:PublicPrimeCoverageMetrics
  externalContactAuthorized:false
  bidSubmissionAuthorized:false
}

const ratio=(numerator:number,denominator:number)=>denominator>0?Math.round((numerator/denominator)*10_000)/100:0

export function assessPublicPrimeCoverage(metrics:PublicPrimeCoverageMetrics):PublicPrimeCoverageAssessment{
  const byLevel=new Map(metrics.levels.map(row=>[row.level,row]))
  const coverageDebt:string[]=[]
  const missingJurisdictionLevels:PublicJurisdictionLevel[]=[]

  for(const level of PUBLIC_PRIME_REQUIRED_LEVELS){
    const row=byLevel.get(level)
    if(!row||row.jurisdictionCount===0){
      missingJurisdictionLevels.push(level)
      coverageDebt.push(`${level}: no hydrated public-buyer jurisdictions.`)
      continue
    }
    const sourceMissing=Math.max(0,row.jurisdictionCount-row.jurisdictionsWithVerifiedAwardSource)
    const adapterMissing=Math.max(0,row.jurisdictionCount-row.jurisdictionsWithActiveAwardAdapter)
    if(sourceMissing>0)coverageDebt.push(`${level}: ${sourceMissing}/${row.jurisdictionCount} jurisdiction(s) lack a verified award-capable source.`)
    if(adapterMissing>0)coverageDebt.push(`${level}: ${adapterMissing}/${row.jurisdictionCount} jurisdiction(s) lack an active read-only award adapter.`)
  }

  const sourceCoveragePct=ratio(metrics.totalWithVerifiedAwardSource,metrics.totalJurisdictions)
  const activeAdapterCoveragePct=ratio(metrics.totalWithActiveAwardAdapter,metrics.totalJurisdictions)
  const primeObservationCoveragePct=ratio(metrics.totalWithPrimeObservation,metrics.totalJurisdictions)

  let status:PublicPrimeCoverageAssessment['status']='PARTIAL'
  if(metrics.totalJurisdictions===0||missingJurisdictionLevels.length===PUBLIC_PRIME_REQUIRED_LEVELS.length)status='BLOCKED'
  else if(
    missingJurisdictionLevels.length===0&&
    metrics.totalWithVerifiedAwardSource===metrics.totalJurisdictions&&
    metrics.totalWithActiveAwardAdapter===metrics.totalJurisdictions
  )status='FULL'

  return {
    status,
    sourceCoveragePct,
    activeAdapterCoveragePct,
    primeObservationCoveragePct,
    missingJurisdictionLevels,
    coverageDebt,
    metrics,
    externalContactAuthorized:false,
    bidSubmissionAuthorized:false,
  }
}
