/**
 * DB-RECOVER.06: deterministic disposable-only SQL restore COMMAND PLAN.
 * This does NOT execute SQL or open a socket. Restore requires an independent
 * operator to inspect the source and deliberately invoke the CLI on a throwaway DB.
 */
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseDisposablePostgresUrl} from './biz-purse-14-local-owner-test.mjs'
import {verifyLocalBackupBundle} from './db-recover-05-backup-bundle.mjs'
import {readFileSync} from 'node:fs'
export function buildDisposableRestorePlan(input){
 if(input?.confirmation!=='YES_DISPOSABLE_DB_ONLY')
  throw Error('DB_RECOVER_06_EXPLICIT_DISPOSABLE_CONFIRMATION_REQUIRED')
 if(!input.bundle||input.bundle.status!=='BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE'||
   input.bundle.files?.length!==3||input.bundle.sourceProjectId!=='kqbkaozfjubkjevdfvic')
  throw Error('DB_RECOVER_06_BACKUP_BUNDLE_BYTES_UNVERIFIED')
 const db=parseDisposablePostgresUrl(input.databaseUrl)
 const localFolder=resolve(input.bundleDir)
 const args=Object.freeze([
  '-X','--no-psqlrc','--single-transaction','--set','ON_ERROR_STOP=1',
  '--host',db.host,'--port',db.port,'--username',db.username,'--dbname',db.database,
  '--file',join(localFolder,'roles.sql'),
  '--file',join(localFolder,'schema.sql'),
  '--command','SET session_replication_role = replica',
  '--file',join(localFolder,'data.sql'),
 ])
 return Object.freeze({status:'LOCAL_RESTORE_PLAN_ONLY',command:'psql',args,
  environmentKeysRequired:Object.freeze(['PGPASSWORD']),
  verificationNext:Object.freeze([
   'Check local database name and independent creation receipt',
   'Operator inspect all three SQL dumps before execution',
   'Operator execute in isolated local Postgres with appropriate Supabase bootstrap',
   'Independent operator verify SQL exit status and catalog/row-count readback',
   'Run local owner-RLS isolation tests and audit roles/extensions/Storage gaps',
  ]),
  permissions:'NO_PRODUCTION_DDL_OR_MIGRATION_HISTORY_CHANGES',
  canExecuteProduction:false,backupRestored:false,independentRestoreVerified:false})
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv[2]!=='--plan-local-only')throw Error('DB_RECOVER_06_PLAN_ONLY')
  const manifestPath=process.env.DB_RECOVER_BACKUP_MANIFEST
  if(!manifestPath)throw Error('DB_RECOVER_06_MANIFEST_PATH_REQUIRED')
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'))
  const bundleDir=process.env.DB_RECOVER_BACKUP_BUNDLE_DIRECTORY
  const bundle=await verifyLocalBackupBundle(manifest,bundleDir)
  const p=buildDisposableRestorePlan({databaseUrl:process.env.BIZ_PURSE_DISPOSABLE_DATABASE_URL,
   confirmation:process.env.BIZ_PURSE_LOCAL_CONFIRMATION,bundleDir,bundle})
  console.log(JSON.stringify(p,null,2))
  // Planning is not restoration. Force the operator to supply a separate executor.
 }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
}
