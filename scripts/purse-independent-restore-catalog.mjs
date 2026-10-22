import {readFileSync} from 'node:fs'

export const REQUIRED_EXTENSIONS = Object.freeze(['pg_cron','pg_net','supabase_vault'])
export const REQUIRED_SCHEMAS = Object.freeze(['public','auth','storage','realtime','vault','supabase_migrations'])
const SHA=/^[a-f0-9]{32}$/
const allowedKind=new Set(['pg17-source-catalog-v1'])
const key=(obj,names)=>names.map(k=>String(obj[k])).join('\0')
const has= (x)=>typeof x==='string'&&x.trim().length>0
function indexRows(rows,keys,label) {
 if(!Array.isArray(rows))throw Error('BAD_'+label+'_COLLECTION')
 const map=new Map()
 for(const row of rows) {
  if(!row||typeof row!=='object'||keys.some(k=>!has(row[k])))
   throw Error('BAD_'+label+'_ROW')
  const id=key(row,keys)
  if(map.has(id))throw Error('DUPLICATE_'+label)
  map.set(id,row)
 }
 return map
}
export function parseCatalog(input) {
 if(!input||typeof input!=='object'||!allowedKind.has(input.kind)||
    input.major!==17||!has(input.capturedAt)||
    Number.isNaN(Date.parse(input.capturedAt))||
    input.database!=='postgres'||
    !Array.isArray(input.extensions)||!Array.isArray(input.tables)||
    !Array.isArray(input.roles)||!Array.isArray(input.migrations))
  throw Error('CATALOG_INCOMPLETE_OR_NOT_POSTGRES_17')
 const extensions=indexRows(input.extensions,['name'],'EXTENSION')
 const tables=indexRows(input.tables,['schema','name'],'TABLE')
 const roles=indexRows(input.roles,['name'],'ROLE')
 const migrations=indexRows(input.migrations,['version'],'MIGRATION')
 for(const e of extensions.values()){
  if(!has(e.version)||!has(e.schema))throw Error('EXTENSION_VERSION_MISSING')
 }
 for(const t of tables.values()){
  if(typeof t.rls!=='boolean'||!Number.isInteger(t.policyCount)||
    t.policyCount<0||!has(t.policyHash)||!SHA.test(t.policyHash))
   throw Error('TABLE_RLS_OR_POLICY_NOT_GROUNDED')
 }
 for(const r of roles.values()){
  if(typeof r.canLogin!=='boolean'||typeof r.superuser!=='boolean'||
    typeof r.bypassRls!=='boolean')throw Error('ROLE_PRIVILEGES_NOT_GROUNDED')
 }
 for(const m of migrations.values()){
  if(typeof m.name!=='string')throw Error('MIGRATION_NAME_NOT_GROUNDED')
 }
 return {input,extensions,tables,roles,migrations}
}
const sortedUnique=a=>Object.freeze([...new Set(a)].sort())
/** Metadata parity, NOT production data restore certification. */
export function reviewIndependentRestoreCatalogs(sourceInput,restoredInput) {
 const source=parseCatalog(sourceInput),target=parseCatalog(restoredInput)
 const errors=[]
 const issues=[]
 for(const n of REQUIRED_EXTENSIONS) if(!source.extensions.has(n))
  errors.push('SOURCE_REQUIRED_EXTENSION_NOT_INVENTORIED:'+n)
 for(const s of REQUIRED_SCHEMAS) {
  if(![...source.tables.values()].some(t=>t.schema===s))errors.push('SOURCE_SCHEMA_NOT_EVIDENCED:'+s)
 }
 const compare=(label,left,right,fields)=>{
  for(const [id,v] of left){
   const targetRow=right.get(id)
   if(!targetRow) errors.push(label+'_ABSENT_ON_RESTORE:'+id.replaceAll('\0','.'))
   else for(const prop of fields){
    if(targetRow[prop]!==v[prop])
     errors.push(label+'_MISMATCH:'+id.replaceAll('\0','.')+':'+prop)
   }
  }
  for(const id of right.keys())if(!left.has(id))
   issues.push('RESTORE_HAS_ADDITIONAL_'+label+':'+id.replaceAll('\0','.'))
 }
 compare('EXTENSION',source.extensions,target.extensions,['version','schema'])
 compare('TABLE',source.tables,target.tables,['rls','policyCount','policyHash'])
 compare('ROLE',source.roles,target.roles,['canLogin','superuser','bypassRls'])
 compare('MIGRATION',source.migrations,target.migrations,['name'])
 if(target.tables.size!==source.tables.size)errors.push('TABLE_INVENTORY_CARDINALITY_MISMATCH')
 if(target.extensions.size!==source.extensions.size)errors.push('EXTENSION_CARDINALITY_MISMATCH')
 if(target.roles.size!==source.roles.size)errors.push('ROLE_INVENTORY_CARDINALITY_MISMATCH')
 if(target.migrations.size!==source.migrations.size)errors.push('MIGRATION_INVENTORY_CARDINALITY_MISMATCH')
 // Catalog equality alone never proves row contents or independent witness.
 const blockers=[
   'REAL_ENCRYPTED_BACKUP_AND_INDEPENDENT_RESTORE_RECEIPTS_REQUIRED',
   'SOURCE_TO_RESTORED_ROW_COUNTS_AND_DATA_HASHES_REQUIRED',
   'REAL_TENANT_JWT_AND_SECURITY_DEFINER_NEGATIVE_TESTS_REQUIRED',
   'INDEPENDENT_OPERATOR_AND_OWNER_MIGRATION_APPROVAL_REQUIRED'
 ]
 if(source.extensions.has('pg_cron')||source.extensions.has('pg_net'))
  blockers.push('DISABLE_OR_ISOLATE_RESTORED_CRON_NETWORK_SIDE_EFFECTS')
 if(source.extensions.has('supabase_vault'))
  blockers.push('VAULT_SECRET_ACCESS_AND_EXTERNAL_STORAGE_NOT_CERTIFIED')
 if(errors.length)blockers.push('RESTORED_CATALOG_NOT_EQUIVALENT')
 return Object.freeze({
  status:errors.length?'BLOCKED_CATALOG_MISMATCH':'CATALOG_MATCH_RESTORE_STILL_UNVERIFIED',
  sourceObservedAt:sourceInput.capturedAt,restoredObservedAt:restoredInput.capturedAt,
  sourceTableCount:source.tables.size,restoredTableCount:target.tables.size,
  sourceExtensionCount:source.extensions.size,restoredExtensionCount:target.extensions.size,
  metadataParity:errors.length===0,
  failures:sortedUnique(errors),warnings:sortedUnique(issues),
  blockers:sortedUnique(blockers),
  independentRealBackupVerified:false,independentRestoreVerified:false,
  realTenantIsolationVerified:false,
  productionMigrationApproved:false,canApplyProductionDDL:false,
  canDeploy:false,canMoveMoney:false,canExecute:false
 })
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [sourcePath,restorePath]=process.argv.slice(2)
 if(!sourcePath||!restorePath) {
  console.error('Usage: node scripts/purse-independent-restore-catalog.mjs source.json restored.json')
  process.exit(2)
 }
 try {
  const result=reviewIndependentRestoreCatalogs(
    JSON.parse(readFileSync(sourcePath,'utf8')),
    JSON.parse(readFileSync(restorePath,'utf8')))
  console.log(JSON.stringify(result,null,2))
  process.exitCode=result.metadataParity?0:2
 } catch(e) {
  console.error('BLOCKED: local catalog inputs malformed or incomplete')
  process.exitCode=2
 }
}
