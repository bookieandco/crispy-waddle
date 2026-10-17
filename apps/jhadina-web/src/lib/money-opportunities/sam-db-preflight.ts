import type {SupabaseClient} from '@supabase/supabase-js'

/**
 * Read-only PRE-WRITE SWLC admission probe.
 * The control plane / Edge "healthy" label does not establish that Postgres
 * accepts SQL. Never initiate stale-run reconciliation, bootstrap, upstream
 * requests or provider enrichment after a failed/ambiguous probe.
 *
 * This is a minimal transport gate, NOT full SUPABASE-DB.2 certification:
 * pg_is_in_recovery(), disk headroom, RLS and migration integrity still need
 * independently captured operator evidence after recovery.
 */
export async function assertSamPrewriteDbReady(client:SupabaseClient):Promise<void>{
  try{
    const result=await client.from('jhadina_sam_scan_runs')
      .select('id',{head:true}).limit(1)
    if(!result||result.error||typeof result.status!=='number'||
      result.status<200||result.status>=300){
      throw new Error('read_failed')
    }
  }catch{
    // Never include Supabase error payloads in public job output.
    throw new Error('SAM_PREWRITE_DB_NOT_READY')
  }
}
