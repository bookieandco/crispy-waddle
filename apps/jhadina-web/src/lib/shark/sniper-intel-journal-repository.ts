import type {SupabaseClient} from '@supabase/supabase-js'
import type {SniperArchiveStore,SniperIntelArchiveRow} from './sniper-intel-journal'

/** Dedicated service-only storage boundary. NOT safe to instantiate with a
 * browser client or a caller-supplied JWT. The table is staged and must be
 * independently schema/RLS-certified before enabling this in any worker.
 *
 * No wallet keys, funding, swaps, order sends, model updates or external
 * provider access exist in this adapter.
 */
export function createSniperIntelArchiveStore(client:SupabaseClient):SniperArchiveStore{
 const table='money_shark_sniper_intel_archive' as const
 return Object.freeze({
  async insert(row:SniperIntelArchiveRow):Promise<void>{
   const {error}=await client.from(table).insert(row)
   if(error)throw new Error('SHARK_INTEL_ARCHIVE_INSERT_FAILED:'+error.code)
  },
  async read(receiptId:string):Promise<SniperIntelArchiveRow|null>{
   const {data,error}=await client.from(table)
    .select('receipt_id,owner_id,trade_id,token_address,information_cutoff,payload_hash,payload_json')
    .eq('receipt_id',receiptId).maybeSingle()
   if(error)throw new Error('SHARK_INTEL_ARCHIVE_READ_FAILED:'+error.code)
   if(!data)return null
   if(typeof data.receipt_id!=='string'||typeof data.owner_id!=='string'||typeof data.trade_id!=='string'||
     typeof data.token_address!=='string'||typeof data.information_cutoff!=='string'||
     typeof data.payload_hash!=='string'||!data.payload_json||typeof data.payload_json!=='object'){
    throw new Error('SHARK_INTEL_ARCHIVE_ROW_INVALID')
   }
   return Object.freeze({
    receipt_id:data.receipt_id,owner_id:data.owner_id,trade_id:data.trade_id,token_address:data.token_address,
    information_cutoff:new Date(data.information_cutoff).toISOString(),
    payload_hash:data.payload_hash,
    payload_json:data.payload_json as SniperIntelArchiveRow['payload_json'],
   })
  },
 })
}