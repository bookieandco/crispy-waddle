/**
 * DB-RECOVER.05: verify SHA-256 of local Supabase CLI roles/schema/data bundle.
 * This does NOT claim source authenticity, independent restore or production readiness.
 * See https://supabase.com/docs/guides/self-hosting/restore-from-platform
 */
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {lstat,realpath} from 'node:fs/promises'
import {resolve,join,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
const REQUIRED=Object.freeze({roles:'roles.sql',schema:'schema.sql',data:'data.sql'})
const SHA256=/^[a-f0-9]{64}$/
export function inspectBackupBundleManifest(manifest){
 if(!manifest||manifest.version!==1||
  manifest.sourceProjectId!=='kqbkaozfjubkjevdfvic'||
  manifest.method!=='SUPABASE_CLI_TRIPLE_SQL'||
  !Number.isFinite(Date.parse(manifest.capturedAt))||
  !manifest.files||typeof manifest.files!=='object'||
  Object.keys(manifest.files).sort().join(',')!=='data,roles,schema')throw Error('DB_RECOVER_05_MANIFEST_INVALID')
 for(const [kind,name] of Object.entries(REQUIRED)){
  const file=manifest.files[kind]
  if(!file||file.name!==name||!SHA256.test(file.sha256)||
    !Number.isSafeInteger(file.bytes)||file.bytes<1)throw Error('DB_RECOVER_05_FILE_MANIFEST_INVALID')
 }
 return Object.freeze({sourceProjectId:manifest.sourceProjectId,method:manifest.method,
  claimedCaptureTime:manifest.capturedAt,
  authority:'UNTRUSTED_LOCAL_BACKUP_MANIFEST_ONLY',backupRestored:false,
  sourceIndependentlyVerified:false,canApplyProductionSql:false})
}
async function hashFile(path){
 const h=createHash('sha256')
 for await (const data of createReadStream(path))h.update(data)
 return h.digest('hex')
}
/**
 * Draft manifest from local files; explicitly not source authentication.
 * Write the manifest to an encrypted private location, never a Git commit.
 */
export async function createDraftLocalBackupManifest(folder,capturedAt){
 if(!Number.isFinite(Date.parse(capturedAt)))throw Error('DB_RECOVER_05_CAPTURE_TIME_INVALID')
 const base=await realpath(resolve(folder))
 const files={}
 for(const [kind,name] of Object.entries(REQUIRED)){
  const path=resolve(join(base,name)),st=await lstat(path)
  if(!st.isFile()||st.isSymbolicLink()||await realpath(path)!==path)
   throw Error('DB_RECOVER_05_UNSAFE_LOCAL_ARTIFACT')
  files[kind]={name,sha256:await hashFile(path),bytes:st.size}
 }
 return Object.freeze({version:1,sourceProjectId:'kqbkaozfjubkjevdfvic',
  method:'SUPABASE_CLI_TRIPLE_SQL',capturedAt,files,
  note:'LOCALLY_DRAFTED_HASHES_NOT_AUTHENTICATED_SOURCE_OR_RESTORE'})
}
export async function verifyLocalBackupBundle(manifest,folder){
 const reviewed=inspectBackupBundleManifest(manifest)
 if(!folder||typeof folder!=='string')throw Error('DB_RECOVER_05_FOLDER_INVALID')
 const base=await realpath(resolve(folder))
 const root=await lstat(base)
 if(!root.isDirectory())throw Error('DB_RECOVER_05_NOT_A_DIRECTORY')
 const observations=[]
 for(const [kind,name] of Object.entries(REQUIRED)){
  const path=resolve(join(base,name))
  if(!path.startsWith(base+sep)||path===base)throw Error('DB_RECOVER_05_PATH_INVALID')
  const f=await lstat(path)
  if(!f.isFile()||f.isSymbolicLink())throw Error('DB_RECOVER_05_SYMLINK_OR_SPECIAL_FILE_REJECTED')
  const actualPath=await realpath(path)
  if(actualPath!==path)throw Error('DB_RECOVER_05_EXTERNAL_PATH_REJECTED')
  const observedHash=await hashFile(path)
  const declared=manifest.files[kind]
  if(f.size!==declared.bytes||observedHash!==declared.sha256)
   throw Error('DB_RECOVER_05_HASH_OR_LENGTH_MISMATCH:'+kind)
  observations.push(Object.freeze({kind,sha256:observedHash,bytes:f.size}))
 }
 return Object.freeze({...reviewed,status:'BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE',
  files:Object.freeze(observations),sourceIndependentlyVerified:false,
  isolatedRestoreVerified:false,productionCertified:false,
  canApplyProductionSql:false})
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 if(process.argv[2]!=='--draft-local-manifest'){
  console.error('DB_RECOVER_05_DRAFT_MANIFEST_ONLY');process.exitCode=2
 }else{
  try{
   const out=await createDraftLocalBackupManifest(process.env.DB_RECOVER_BACKUP_BUNDLE_DIRECTORY,
    process.env.DB_RECOVER_BACKUP_CAPTURED_AT)
   console.log(JSON.stringify(out,null,2))
  }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
 }
}
