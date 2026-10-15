/**
 * BIZ-PURSE.14: offline canonical migration inventory. No database connection,
 * filesystem writes, SQL execution, migration-history repair or deployment.
 */
import {createHash} from 'node:crypto'
import {readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'

export const REQUIRED_BIZ_PURSE_VERSIONS=Object.freeze([
 '20261002190000','20261003143000','20261003181500','20261003221000'
])
const MIGRATION=/^([0-9]{14})_([a-z0-9][a-z0-9_]*)\.sql$/
const isTimestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))
const uniq=values=>[...new Set(values)].sort()
const sum=data=>createHash('sha256').update(data).digest('hex')

export function inventoryLocalMigrations(files){
 if(!Array.isArray(files))throw new Error('BIZ_PURSE_14_LOCAL_FILES_REQUIRED')
 const seen=new Set()
 return files.map(f=>{
  if(!f||typeof f.filename!=='string'||typeof f.content!=='string')throw new Error('BIZ_PURSE_14_LOCAL_FILE_INVALID')
  const name=f.filename.split('/').at(-1)
  const match=MIGRATION.exec(name)
  if(!match||seen.has(f.filename))throw new Error('BIZ_PURSE_14_BAD_OR_DUPLICATE_FILENAME')
  seen.add(f.filename)
  return Object.freeze({filename:f.filename,version:match[1],name:match[2],sha256:sum(f.content),bytes:Buffer.byteLength(f.content)})
 }).sort((a,b)=>a.version.localeCompare(b.version)||a.filename.localeCompare(b.filename))
}

/**
 * 'recorded' comes from independently read Supabase migration metadata, not
 * service claims. The tool does not trust this input to certify deployment.
 */
export function assessMigrationRecovery(input){
 if(!input||!Array.isArray(input.local)||!Array.isArray(input.recorded)||
    !Array.isArray(input.requiredVersions)||!isTimestamp(input.observedAt))
  throw new Error('BIZ_PURSE_14_INVENTORY_INVALID')
 const local=inventoryLocalMigrations(input.local)
 if(!input.requiredVersions.length||input.requiredVersions.some(x=>!/^[0-9]{14}$/.test(x)))
  throw new Error('BIZ_PURSE_14_REQUIRED_VERSIONS_INVALID')
 const byVersion=new Map()
 for(const m of local){const entries=byVersion.get(m.version)||[];entries.push(m);byVersion.set(m.version,entries)}
 const collisions=[...byVersion.entries()].filter(([,arr])=>arr.length>1)
  .map(([version,entries])=>Object.freeze({version,files:entries.map(e=>e.filename)}))
 const recorded=new Map(),recordedNames=[]
 for(const m of input.recorded){
  if(!m||!/^[0-9]{14}$/.test(m.version)||typeof m.name!=='string'||!m.name.trim()||recorded.has(m.version))
    throw new Error('BIZ_PURSE_14_RECORDED_MIGRATION_INVALID_OR_DUPLICATE')
  recorded.set(m.version,m);recordedNames.push(m.version)
 }
 const missingRequired=input.requiredVersions.filter(v=>!recorded.has(v))
 const localMissingRequired=input.requiredVersions.filter(v=>!byVersion.has(v))
 const divergentNames=input.requiredVersions.filter(v=>{
   const row=recorded.get(v),candidates=byVersion.get(v)||[]
   return row&&candidates.length===1&&row.name!==candidates[0].name
 }).map(v=>({version:v,remoteName:recorded.get(v).name,localName:byVersion.get(v)[0].name}))
 const untrackedHistory=recordedNames.filter(v=>!byVersion.has(v))
 const stagedMigrations=local.filter(m=>!recorded.has(m.version))
 const blockers=[
  ...(collisions.length?['DUPLICATE_LOCAL_MIGRATION_VERSION']:[]),
  ...(missingRequired.length?['REQUIRED_MIGRATIONS_NOT_APPLIED']:[]),
  ...(localMissingRequired.length?['CANONICAL_REQUIRED_SQL_MISSING']:[]),
  ...(divergentNames.length?['RECORDED_NAME_DIFFERS_FROM_REPOSITORY']:[]),
  ...(untrackedHistory.length?['DATABASE_MIGRATION_HISTORY_NOT_IN_REPOSITORY']:[]),
 ]
 return Object.freeze({
  status:blockers.length?'BLOCKED':'MANUAL_REPLAY_REVIEW_REQUIRED',
  observedAt:input.observedAt,
  localCount:local.length,remoteCount:recorded.size,
  local: Object.freeze(local),
  collisions:Object.freeze(collisions),
  missingRequired:Object.freeze(uniq(missingRequired)),
  localMissingRequired:Object.freeze(uniq(localMissingRequired)),
  divergentNames:Object.freeze(divergentNames),
  untrackedHistory:Object.freeze(untrackedHistory),
  stagedMigrations:Object.freeze(stagedMigrations),
  blockers:Object.freeze(uniq(blockers)),
  backupRestored:false,
  canApplyProductionMigrations:false,
  productionCertified:false,
  authority:'READ_ONLY_MIGRATION_AUDIT'
 })
}
export function readLocalMigrationFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).filter(x=>x.isFile()&&MIGRATION.test(x.name))
  .map(x=>({filename:x.name,content:readFileSync(join(directory,x.name),'utf8')}))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const directory=process.argv[2],ledgerFile=process.argv[3]
 if(!directory||!ledgerFile){
  console.error('Usage: node scripts/biz-purse-14-migration-audit.mjs <migrations-dir> <read-only-ledger.json>')
  process.exitCode=2
 }else{
  try{
   const ledger=JSON.parse(readFileSync(ledgerFile,'utf8'))
   const result=assessMigrationRecovery({
    local:readLocalMigrationFiles(directory),
    recorded:Array.isArray(ledger)?ledger:ledger.migrations,
    requiredVersions:REQUIRED_BIZ_PURSE_VERSIONS,
    observedAt:ledger.observedAt
   })
   // Don't print migration source SQL or connection details.
   console.log(JSON.stringify({...result,local:result.local.map(({filename,version,name,sha256,bytes})=>({filename,version,name,sha256,bytes}))},null,2))
   if(result.status==='BLOCKED')process.exitCode=1
  }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
 }
}
