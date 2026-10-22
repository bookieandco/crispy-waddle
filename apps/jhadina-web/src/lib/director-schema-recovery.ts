import type {SupabaseClient} from '@supabase/supabase-js'

/**
 * Director .04-.06: read-only, owner-authorized availability of the existing
 * durable stores. This is deliberately NOT a backup, restore, write, or media
 * certification, and makes no changes to schemas or data.
 */
export const DIRECTOR_DURABLE_STORES=Object.freeze([
  'director_workstation_timelines',
  'director_project_inputs',
  'director_screenplay_ingest_proposals',
  'director_screenplay_blueprints',
  'director_project_business_context',
  'director_watch_jobs',
  'director_watch_commissioning_receipts',
  'director_project_final_qc_evidence',
  'director_project_final_qc_receipts',
] as const)

export type DirectorStoreProbe=Readonly<{
  table:typeof DIRECTOR_DURABLE_STORES[number]
  readable:boolean
  blocker:'MISSING_SCHEMA'|'ACCESS_DENIED'|'UNAVAILABLE'|'UNKNOWN'|null
}>

function classify(error:{code?:string|null}):NonNullable<DirectorStoreProbe['blocker']>{
  switch(String(error.code??'').toUpperCase()){
    case '42P01':
    case 'PGRST205':
      return 'MISSING_SCHEMA'
    case '42501':
    case 'PGRST301':
    case '401':
    case '403':
      return 'ACCESS_DENIED'
    case '57P03':
    case '08006':
    case 'PGRST000':
    case 'PGRST002':
      return 'UNAVAILABLE'
    default:
      return 'UNKNOWN'
  }
}

export async function inspectDirectorDurableStoreReadiness(
  client: Pick<SupabaseClient,'from'>,
):Promise<Readonly<{
  schemaReadable:boolean
  durableRoundTripCertified:false
  independentRestoreCertified:false
  canApplyMigrations:false
  probes:readonly DirectorStoreProbe[]
  authority:'READ_ONLY_SCHEMA_PROBE'
}>>{
  const probes=await Promise.all(DIRECTOR_DURABLE_STORES.map(async table=>{
    try{
      const {error}=await client.from(table).select('*',{head:true,count:'estimated'}).limit(1)
      return Object.freeze({table,readable:!error,blocker:error?classify(error):null})
    }catch{
      return Object.freeze({table,readable:false,blocker:'UNAVAILABLE' as const})
    }
  }))
  return Object.freeze({
    schemaReadable:probes.every(probe=>probe.readable),
    durableRoundTripCertified:false,
    independentRestoreCertified:false,
    canApplyMigrations:false,
    probes:Object.freeze(probes),
    authority:'READ_ONLY_SCHEMA_PROBE',
  })
}
