import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {PURSE_MIGRATION_MANIFEST,REQUIRED_PARENTS} from './purse-commercial-manifest.mjs'

const normal=s=>s.toLowerCase().replace(/\s+/g,' ').trim()
const good=x=>typeof x==='string'&&x.trim().length>0
const unique=x=>Array.isArray(x)&&new Set(x).size===x.length
const gate=(blockers,details)=>Object.freeze({
 status:'BLOCKED_PENDING_INDEPENDENT_RESTORE',
 blockers:Object.freeze([...new Set(blockers)]),
 ...details,
 canApplyMigration:false,canAlterGrants:false,canConnectBank:false,
 canCharge:false,canRecordIncome:false,canPayOwner:false,
 canTrade:false,canExecute:false,independentlyCertified:false,
 authority:'READ_ONLY_NO_DDL_NO_FUNDS'
})
export function gitBlobSha(bytes){
 const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes)
 return createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex')
}
/** Source scan prevents sneaky version drift; only a real isolated DB replay proves semantics. */
export async function inspectPurseMigrationSources(repoRoot){
 if(!good(repoRoot))throw Error('PURSE_DB_REPO_ROOT_REQUIRED')
 const findings=[]
 const paths=new Set()
 for(const item of PURSE_MIGRATION_MANIFEST){
  if(paths.has(item.path)||!item.path.startsWith('supabase/migrations/')||
    !/^[a-f0-9]{40}$/.test(item.blob))throw Error('PURSE_DB_MANIFEST_INVALID')
  paths.add(item.path)
  const bytes=await readFile(resolve(repoRoot,item.path))
  const actualBlob=gitBlobSha(bytes)
  const sql=normal(bytes.toString('utf8'))
  const failures=[]
  if(actualBlob!==item.blob)failures.push('SOURCE_HASH_DRIFT')
  for(const table of item.tables){
   if(!sql.includes('create table if not exists public.'+table+' ('))
    failures.push('TABLE_DDL_MISSING:'+table)
   if(!sql.includes('alter table public.'+table+' enable row level security;'))
    failures.push('TABLE_RLS_MISSING:'+table)
   if(!sql.includes('grant select on public.'+table+' to authenticated;'))
    failures.push('TABLE_OWNER_READ_GRANT_MISSING:'+table)
   if(!sql.includes('to service_role;'))
    failures.push('SERVICE_ROLE_GRANT_MISSING:'+table)
   if(!sql.includes('on public.'+table))
    failures.push('TABLE_POLICY_MISSING:'+table)
   if(!sql.includes('revoke all on public.'+table+' from public'))
    failures.push('TABLE_ANON_REVOKE_MISSING:'+table)
  }
  if(!sql.includes('(select auth.uid())'))
   failures.push('OWNER_ROW_BINDING_MISSING')
  for(const fn of item.functions){
   if(!sql.includes('create or replace function public.'+fn+'('))
    failures.push('RPC_DEFINITION_MISSING:'+fn)
   if(!sql.includes('revoke all on function public.'+fn+'('))
    failures.push('RPC_PUBLIC_EXECUTE_REVOKE_MISSING:'+fn)
  }
  if((sql.match(/security definer/g)||[]).length<item.functions.length)
   failures.push('EXPECTED_RPC_AUTHORITY_BOUNDARY_UNVERIFIED')
  findings.push(Object.freeze({version:item.version,name:item.name,path:item.path,
   expectedBlob:item.blob,actualBlob,sourceMatches:failures.length===0,
   failures:Object.freeze(failures)}))
 }
 return gate(findings.flatMap(f=>f.failures.map(x=>f.version+':'+x)).concat(
   'INDEPENDENT_BACKUP_RESTORE_AND_MIGRATION_REPLAY_NOT_VERIFIED'),
  {sourceFiles:Object.freeze(findings)})
}
/** DB snapshot is an untrusted observation, NOT signed PostgreSQL proof. */
export function reviewPurseMigrationDatabaseSnapshot(snapshot){
 if(!snapshot||!good(snapshot.checkedAt)||!Number.isFinite(Date.parse(snapshot.checkedAt))||
    !Array.isArray(snapshot.migrations)||!Array.isArray(snapshot.tables)||
    !Array.isArray(snapshot.functions))throw Error('PURSE_DB_SNAPSHOT_INVALID')
 const versions=new Map(),tables=new Map(),fns=new Map()
 for(const row of snapshot.migrations){
  if(!row||!good(row.version)||!good(row.name)||versions.has(row.version))
   throw Error('PURSE_DB_DUPLICATE_MIGRATION_OR_BAD_VERSION')
  versions.set(row.version,row.name)
 }
 for(const row of snapshot.tables){
  if(!row||!good(row.name)||typeof row.exists!=='boolean'||tables.has(row.name))
   throw Error('PURSE_DB_DUPLICATE_OR_BAD_TABLE')
  tables.set(row.name,row)
 }
 for(const row of snapshot.functions){
  if(!row||!good(row.name)||typeof row.exists!=='boolean'||fns.has(row.name))
   throw Error('PURSE_DB_DUPLICATE_OR_BAD_RPC')
  fns.set(row.name,row)
 }
 const failures=[],missingVersions=[],missingTables=[],missingFunctions=[]
 for(const parent of REQUIRED_PARENTS){
  if(tables.get(parent)?.exists!==true)failures.push('MISSING_PARENT:'+parent)
 }
 for(const item of PURSE_MIGRATION_MANIFEST){
  if(!versions.has(item.version)){missingVersions.push(item.version);failures.push('MIGRATION_NOT_RECORDED:'+item.version)}
  else if(versions.get(item.version)!==item.name)failures.push('MIGRATION_VERSION_NAME_COLLISION:'+item.version)
  for(const tbl of item.tables){
   const s=tables.get(tbl)
   if(s?.exists!==true){missingTables.push(tbl);failures.push('TABLE_ABSENT:'+tbl)}
   else {
    if(s.rlsEnabled!==true)failures.push('RLS_DISABLED:'+tbl)
    if(s.anonSelect===true)failures.push('ANON_SELECT_GRANTED:'+tbl)
    if(s.authenticatedSelect!==true)failures.push('OWNER_SELECT_GRANT_MISSING:'+tbl)
    if(s.ownerPolicyPresent!==true)failures.push('OWNER_RLS_POLICY_NOT_EVIDENCED:'+tbl)
   }
  }
  for(const fn of item.functions){
   const f=fns.get(fn)
   if(f?.exists!==true){missingFunctions.push(fn);failures.push('RPC_ABSENT:'+fn)}
   else {
    if(f.anonExecute===true)failures.push('RPC_ANON_EXECUTE_GRANTED:'+fn)
    if(f.authenticatedExecute!==true)failures.push('RPC_OWNER_EXECUTE_GRANT_MISSING:'+fn)
   }
  }
 }
 // Never infer real cross-user RLS, backup success or production permission from SQL metadata.
 failures.push('INDEPENDENT_BACKUP_RESTORE_REQUIRED','ISOLATED_FULL_SQL_REPLAY_REQUIRED',
   'TWO_USER_RLS_CANARY_REQUIRED','OWNER_PRODUCTION_DDL_APPROVAL_REQUIRED')
 return gate(failures,{
   checkedAt:snapshot.checkedAt,
   missingMigrationVersions:Object.freeze(missingVersions),
   missingTables:Object.freeze(missingTables),
   missingFunctions:Object.freeze(missingFunctions),
   sourceOfTruth:'READ_ONLY_SQL_CATALOG_SNAPSHOT'
 })
}
