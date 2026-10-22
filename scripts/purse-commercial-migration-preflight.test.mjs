import assert from 'node:assert/strict'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {resolve,dirname} from 'node:path'
import {inspectPurseMigrationSources,reviewPurseMigrationDatabaseSnapshot} from './purse-commercial-migration-preflight.mjs'
import {PURSE_MIGRATION_MANIFEST,REQUIRED_PARENTS} from './purse-commercial-manifest.mjs'
const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
test('all four canonical migrations are Git-blob pinned and preserve owner boundaries',async()=>{
 const r=await inspectPurseMigrationSources(repoRoot)
 assert.equal(r.sourceFiles.length,4)
 assert.ok(r.sourceFiles.every(x=>x.sourceMatches),JSON.stringify(r.sourceFiles))
 assert.equal(r.canApplyMigration,false)
 assert.equal(r.independentlyCertified,false)
})
const allTables=[...REQUIRED_PARENTS,...PURSE_MIGRATION_MANIFEST.flatMap(x=>x.tables)]
const allFns=PURSE_MIGRATION_MANIFEST.flatMap(x=>x.functions)
const complete={
 checkedAt:'2026-10-22T05:00:00Z',
 migrations:PURSE_MIGRATION_MANIFEST.map(x=>({version:x.version,name:x.name})),
 tables:allTables.map(name=>({name,exists:true,rlsEnabled:true,
  anonSelect:false,authenticatedSelect:true,ownerPolicyPresent:true})),
 functions:allFns.map(name=>({name,exists:true,anonExecute:false,authenticatedExecute:true}))
}
test('even fully asserted catalog checks never certify backup or DDL',()=>{
 const r=reviewPurseMigrationDatabaseSnapshot(complete)
 assert.equal(r.status,'BLOCKED_PENDING_INDEPENDENT_RESTORE')
 assert.equal(r.canApplyMigration,false)
 assert.ok(r.blockers.includes('INDEPENDENT_BACKUP_RESTORE_REQUIRED'))
})
test('missing migrations, tables and RPCs report exact gaps',()=>{
 const s={...complete,migrations:[],tables:complete.tables.filter(x=>!x.name.includes('side_hustle')),
  functions:[]}
 const r=reviewPurseMigrationDatabaseSnapshot(s)
 assert.equal(r.missingMigrationVersions.length,4)
 assert.ok(r.missingTables.includes('jhadina_side_hustle_work_orders'))
 assert.ok(r.missingFunctions.includes('jhadina_side_hustle_work_order_save'))
})
test('version/name collisions and unauthorized access cannot be hidden',()=>{
 const migration=complete.migrations.map((x,i)=>i===0?{...x,name:'different_migration'}:x)
 const tables=complete.tables.map(x=>x.name==='jhadina_side_hustle_work_orders'?
  {...x,anonSelect:true,ownerPolicyPresent:false}:x)
 const r=reviewPurseMigrationDatabaseSnapshot({...complete,migrations:migration,tables})
 assert.ok(r.blockers.includes('MIGRATION_VERSION_NAME_COLLISION:20261002190000'))
 assert.ok(r.blockers.includes('ANON_SELECT_GRANTED:jhadina_side_hustle_work_orders'))
 assert.ok(r.blockers.includes('OWNER_RLS_POLICY_NOT_EVIDENCED:jhadina_side_hustle_work_orders'))
})
test('duplicate version or forged table fails closed',()=>{
 assert.throws(()=>reviewPurseMigrationDatabaseSnapshot({...complete,
  migrations:[...complete.migrations,complete.migrations[0]]}),/DUPLICATE_MIGRATION/)
 assert.throws(()=>reviewPurseMigrationDatabaseSnapshot({...complete,
  tables:[...complete.tables,complete.tables[0]]}),/DUPLICATE_OR_BAD_TABLE/)
})
