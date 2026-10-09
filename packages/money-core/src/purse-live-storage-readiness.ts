import type {SqlClient} from './postgres-idempotency-store.js'

/**
 * P-LIVE.01 -- operational PostgreSQL probe, separate from any synthetic CI canary.
 * The caller supplies its authenticated, owner-approved *persistent* SQL connection.
 * This module never creates tables, migrates, funds, or writes to any account.
 */
export type PurseLiveStorageProbe=Readonly<{
 state:'READABLE_BUT_UNCERTIFIED'|'BLOCKED'
 databaseName:string|null
 observedAt:string|null
 inRecovery:boolean|null
 transactionReadOnly:boolean|null
 tablePresent:Readonly<Record<string,boolean>>
 blockers:readonly string[]
 authority:'READ_ONLY_STORAGE_DIAGNOSTIC'
 independentlyRestored:false
 persistentRestartProven:false
 liveTradingEnabled:false
}>
const required=[
 'money_coffers','money_profit_sweep_policies','money_autonomous_trading_mandates',
 'money_funding_rail_admissions','money_movement_attempts','money_purse_charters',
 'money_purse_paper_cycles','money_purse_paper_leases',
] as const
type Row={observed_at:Date|string;database_name:string;in_recovery:boolean;read_only:boolean;tables:Record<string,boolean>}
export async function inspectPurseLiveStorage(db:SqlClient):Promise<PurseLiveStorageProbe>{
 try{
  // No user or server-supplied identifiers interpolated in SQL.
  const names=required.map(n=>`'${n}',(to_regclass('public.${n}') IS NOT NULL)`).join(',')
  const sql=`SELECT clock_timestamp() AS observed_at,current_database() AS database_name,
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only')::boolean AS read_only,
    jsonb_build_object(${names}) AS tables`
  const {rows}=await db.query<Row>(sql)
  if(rows.length!==1)throw new Error('STORAGE_PROBE_RESULT_INVALID')
  const x=rows[0]!
  const blocks:string[]=[]
  if(x.in_recovery||x.read_only)blocks.push('DATABASE_NOT_WRITABLE')
  for(const name of required)if(x.tables?.[name]!==true)blocks.push('SCHEMA_MISSING_'+name.toUpperCase())
  const observed=x.observed_at instanceof Date?x.observed_at.toISOString():new Date(x.observed_at).toISOString()
  if(!Number.isFinite(Date.parse(observed)))blocks.push('DATABASE_CLOCK_INVALID')
  // Even a healthy DB probe does NOT prove disk durability, independent encrypted restore,
  // owner authorization, runtime worker health, or live funding.
  return Object.freeze({state:blocks.length?'BLOCKED':'READABLE_BUT_UNCERTIFIED',
   databaseName:x.database_name,observedAt:observed,inRecovery:x.in_recovery,
   transactionReadOnly:x.read_only,tablePresent:Object.freeze({...x.tables}),
   blockers:Object.freeze(blocks),authority:'READ_ONLY_STORAGE_DIAGNOSTIC',
   independentlyRestored:false,persistentRestartProven:false,liveTradingEnabled:false})
 }catch{
  return Object.freeze({state:'BLOCKED',databaseName:null,observedAt:null,
   inRecovery:null,transactionReadOnly:null,tablePresent:Object.freeze({}),
   blockers:Object.freeze(['DATABASE_UNAVAILABLE_OR_QUERY_REJECTED']),
   authority:'READ_ONLY_STORAGE_DIAGNOSTIC',independentlyRestored:false,
   persistentRestartProven:false,liveTradingEnabled:false})
 }
}
