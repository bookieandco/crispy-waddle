import {createHash} from 'node:crypto'
import {readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
const match=/^(\d{14})_([a-z0-9_]+)\.sql$/
export function inspectRecoveryPreflight({files,applied,requiredVersions,observedAt}){
 if(!Array.isArray(files)||!Array.isArray(applied)||!Array.isArray(requiredVersions)||
 !Number.isFinite(Date.parse(observedAt)))throw Error('DB_RECOVER_PREFLIGHT_INVALID')
 const local=new Map(),rem=new Map()
 for(const file of files){
  const parsed=match.exec(file.name||'')
  if(!parsed||typeof file.body!=='string')throw Error('DB_RECOVER_LOCAL_FILE_INVALID')
  const arr=local.get(parsed[1])||[]
  arr.push({name:parsed[2],sha256:createHash('sha256').update(file.body).digest('hex'),file:file.name})
  local.set(parsed[1],arr)
 }
 for(const item of applied){
  if(!item||!/^\d{14}$/.test(item.version)||typeof item.name!=='string'||rem.has(item.version))
  throw Error('DB_RECOVER_APPLIED_HISTORY_UNTRUSTED')
  rem.set(item.version,item.name)
 }
 const collisions=[...local].filter(([,v])=>v.length>1).map(([version,items])=>({version,items}))
 const required=requiredVersions.map(version=>{
  if(!/^\d{14}$/.test(version))throw Error('DB_RECOVER_BAD_REQUIRED_VERSION')
  const records=local.get(version)||[]
  return {version,files:records,applied:rem.has(version),appliedName:rem.get(version)||null}
 })
 const missingRemote=[...rem].filter(([version])=>!local.has(version)).map(([version,name])=>({version,name}))
 const pendingLocal=[...local].filter(([version])=>!rem.has(version)).map(([version,items])=>({version,items}))
 const versionNameDrift=[...rem].filter(([version,name])=>{
  const entries=local.get(version);return entries?.length===1&&entries[0].name!==name
 }).map(([version,name])=>({version,remoteName:name,localName:local.get(version)[0].name}))
 const reasons=[]
 if(collisions.length)reasons.push('MIGRATION_VERSION_COLLISIONS')
 if(missingRemote.length)reasons.push('APPLIED_HISTORY_UNMATCHED')
 if(versionNameDrift.length)reasons.push('APPLIED_MIGRATION_NAME_DRIFT')
 if(required.some(x=>!x.applied))reasons.push('REQUIRED_MIGRATIONS_NOT_APPLIED')
 if(required.some(x=>x.files.length!==1))reasons.push('REQUIRED_VERSION_NOT_UNIQUE')
 return {status:reasons.length?'BLOCKED':'INDEPENDENT_REVIEW_REQUIRED',
  observedAt,localFileCount:files.length,uniqueLocalVersions:local.size,
  remoteRecordedCount:rem.size,collisionVersions:collisions,required,
  unmatchedRemoteCount:missingRemote.length,unmatchedRemoteSample:missingRemote.slice(0,25),
  pendingLocalCount:pendingLocal.length,pendingLocalSample:pendingLocal.slice(0,25),
  versionNameDrift,reasons,authority:'READ_ONLY_RECONCILIATION',
  canApplyProductionMigration:false,canMarkMigrationsApplied:false,backupRestored:false}
}
export function readMigrationDirectory(directory){
 return readdirSync(directory).filter(name=>match.test(name)).map(name=>({
  name,body:readFileSync(join(directory,name),'utf8')
 }))
}
