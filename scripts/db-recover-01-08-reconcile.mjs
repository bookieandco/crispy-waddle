/**
 * DB-RECOVER.01–.08: immutable migration source/remote-history snapshot audit.
 * No network, SQL execution, production history editing or sensitive data access.
 * A matching snapshot is source consistency, NOT evidence of a restored backup.
 */
import {readFileSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'

const PATH=/^supabase\/migrations\/([0-9]{14})_([a-z0-9_]+)\.sql$/
const VERSION=/^[0-9]{14}$/
const SHA1=/^[a-f0-9]{40}$/
const REQUIRED=Object.freeze(['20261002190000','20261003143000','20261003181500','20261003221000'])

export function reconcileDbRecoverySnapshot(snapshot){
 if(!snapshot||snapshot.schemaVersion!==1||!snapshot.source||
  !SHA1.test(snapshot.source.gitHead??'')||
  snapshot.source.repo!=='bookieandco/crispy-waddle'||
  snapshot.source.projectId!=='kqbkaozfjubkjevdfvic'||
  !Array.isArray(snapshot.localMigrations)||!Array.isArray(snapshot.recordedMigrations)||
  !Array.isArray(snapshot.collisionBaseline)||!Array.isArray(snapshot.requiredVersions))
  throw Error('DB_RECOVER_SNAPSHOT_INVALID')
 if(JSON.stringify(snapshot.requiredVersions)!==JSON.stringify(REQUIRED))
  throw Error('DB_RECOVER_REQUIRED_VERSIONS_TAMPERED')
 const paths=new Set(),byVersion=new Map()
 for(const f of snapshot.localMigrations){
  const m=typeof f?.path==='string'&&PATH.exec(f.path)
  if(!m||!SHA1.test(f.gitBlobSha??'')||f.version!==m[1]||f.name!==m[2]||paths.has(f.path))
   throw Error('DB_RECOVER_LOCAL_MANIFEST_INVALID')
  paths.add(f.path)
  const list=byVersion.get(f.version)||[];list.push(f);byVersion.set(f.version,list)
 }
 const recorded=new Map()
 for(const r of snapshot.recordedMigrations){
  if(!r||!VERSION.test(r.version)||typeof r.name!=='string'||
   !/^[a-z0-9_]+$/.test(r.name)||recorded.has(r.version))
    throw Error('DB_RECOVER_REMOTE_HISTORY_INVALID')
  recorded.set(r.version,r.name)
 }
 const collisions=[...byVersion].filter(([,files])=>files.length>1)
  .map(([version,files])=>({version,candidates:files.map(f=>({path:f.path,gitBlobSha:f.gitBlobSha}))
    .sort((a,b)=>a.path.localeCompare(b.path)),recordedName:recorded.get(version)??null}))
  .sort((a,b)=>a.version.localeCompare(b.version))
 if(JSON.stringify(collisions)!==JSON.stringify(snapshot.collisionBaseline))
  throw Error('DB_RECOVER_COLLISION_BASELINE_DRIFT')
 const remoteOnly=[...recorded.keys()].filter(v=>!byVersion.has(v)).sort()
 const localOnly=[...byVersion.keys()].filter(v=>!recorded.has(v)).sort()
 const divergent=[]
 const collisionRecorded=[]
 let matchingUnique=0
 for(const [version,files] of byVersion){
  if(!recorded.has(version))continue
  if(files.length>1){
   collisionRecorded.push({version,recordedName:recorded.get(version),
     candidateNames:files.map(f=>f.name).sort(),
     nameMatches:files.filter(f=>f.name===recorded.get(version)).map(f=>f.path)})
  }else if(files[0].name!==recorded.get(version))
   divergent.push({version,localName:files[0].name,recordedName:recorded.get(version)})
  else matchingUnique++
 }
 const unrecordedRequired=REQUIRED.filter(v=>!recorded.has(v))
 const missingRequiredSource=REQUIRED.filter(v=>!byVersion.has(v))
 const blockers=[
  ...(collisions.length?['MIGRATION_VERSION_COLLISIONS']:[]),
  ...(remoteOnly.length?['RECORDED_HISTORY_MISSING_SOURCE']:[]),
  ...(localOnly.length?['REPOSITORY_VERSIONS_UNRECORDED']:[]),
  ...(divergent.length?['SAME_VERSION_DIFFERENT_NAMES']:[]),
  ...(unrecordedRequired.length?['REQUIRED_COMMERCE_MIGRATIONS_NOT_RECORDED']:[]),
  ...(missingRequiredSource.length?['REQUIRED_COMMERCE_SOURCE_MISSING']:[]),
 ]
 return Object.freeze({
  state:'BLOCKED',authority:'READ_ONLY_HISTORY_RECONCILIATION',
  sourceGitHead:snapshot.source.gitHead,observedAt:snapshot.source.observedAt,
  counts:Object.freeze({localFiles:paths.size,uniqueLocalVersions:byVersion.size,
   remoteVersions:recorded.size,matchingUnique,collisionVersions:collisions.length,
   remoteOnly:remoteOnly.length,localOnly:localOnly.length,divergent:divergent.length}),
  collisions:Object.freeze(collisions),collisionRecorded:Object.freeze(collisionRecorded),
  remoteOnly:Object.freeze(remoteOnly),localOnly:Object.freeze(localOnly),
  divergent:Object.freeze(divergent),unrecordedRequired:Object.freeze(unrecordedRequired),
  missingRequiredSource:Object.freeze(missingRequiredSource),
  blockers:Object.freeze(blockers),
  canRepairMigrationHistory:false,canApplySql:false,canMigrateProduction:false,
  independentBackupVerified:false,isolatedRestoreVerified:false,productionCertified:false
 })
}
export function verifySnapshotSourceBytes(snapshot,root){
 // Verify tracked SQL source bytes against Git blob objects. Does not touch DB.
 const actualDir=join(root,'supabase','migrations')
 const actual=readdirSync(actualDir).filter(n=>PATH.test('supabase/migrations/'+n)).sort()
 const recorded=snapshot.localMigrations.map(f=>f.path.split('/').at(-1)).sort()
 if(JSON.stringify(actual)!==JSON.stringify(recorded))throw Error('DB_RECOVER_MIGRATION_FILESET_DRIFT')
 for(const f of snapshot.localMigrations){
  if(!PATH.test(f.path))throw Error('DB_RECOVER_UNSAFE_PATH')
  const bytes=readFileSync(join(root,f.path))
  const gitBlobSha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')
  if(gitBlobSha!==f.gitBlobSha)throw Error('DB_RECOVER_SQL_BYTES_CHANGED:'+f.version)
 }
 return Object.freeze({sourceBytesVerified:true,fileCount:recorded.length,
  productionCertified:false})
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const root=resolve(process.argv[2]??'.')
  const file=join(root,'docs/architecture/DB-RECOVER-SWLC-MIGRATION-SNAPSHOT.json')
  const snapshot=JSON.parse(readFileSync(file,'utf8'))
  const integrity=verifySnapshotSourceBytes(snapshot,root)
  const review=reconcileDbRecoverySnapshot(snapshot)
  console.log(JSON.stringify({
   sourceBytesVerified:integrity.sourceBytesVerified,counts:review.counts,
   collisions:review.collisions,collisionRecorded:review.collisionRecorded,
   unrecordedRequired:review.unrecordedRequired,blockers:review.blockers,
   authority:review.authority,productionCertified:review.productionCertified
  },null,2))
  process.exitCode=1 // Known blockers. A manual reviewer cannot override by command-line flag.
 }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
}
