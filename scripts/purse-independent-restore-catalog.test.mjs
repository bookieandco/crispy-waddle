import assert from 'node:assert/strict'
import test from 'node:test'
import {reviewIndependentRestoreCatalogs} from './purse-independent-restore-catalog.mjs'
const ext=[
 {name:'pg_cron',version:'1.6.4',schema:'pg_catalog'},
 {name:'pg_net',version:'0.20.4',schema:'extensions'},
 {name:'supabase_vault',version:'0.3.1',schema:'vault'}
]
const t=['public','auth','storage','realtime','vault','supabase_migrations'].map((schema,i)=>({
 schema,name:'fixture_'+i,rls:true,policyCount:1,policyHash:'a'.repeat(32)}))
const roles=[
{name:'authenticated',canLogin:false,superuser:false,bypassRls:false},
{name:'service_role',canLogin:false,superuser:false,bypassRls:true}
]
const m=[{version:'20261002190000',name:'side_hustle_commercial_runtime'}]
const fixture=()=>({kind:'pg17-source-catalog-v1',capturedAt:'2026-10-22T18:00:00Z',
 major:17,database:'postgres',extensions:ext.map(x=>({...x})),
 tables:t.map(x=>({...x})),roles:roles.map(x=>({...x})),
 migrations:m.map(x=>({...x}))})
test('equal asserted catalogs never certify real restore or authorize production DDL',()=>{
 const x=reviewIndependentRestoreCatalogs(fixture(),fixture())
 assert.equal(x.metadataParity,true)
 assert.equal(x.independentRestoreVerified,false)
 assert.equal(x.canApplyProductionDDL,false)
 assert.equal(x.canExecute,false)
 assert.ok(x.blockers.includes('DISABLE_OR_ISOLATE_RESTORED_CRON_NETWORK_SIDE_EFFECTS'))
 assert.ok(x.blockers.includes('VAULT_SECRET_ACCESS_AND_EXTERNAL_STORAGE_NOT_CERTIFIED'))
})
test('missing extension and downgraded RLS fail closed',()=>{
 const left=fixture(),right=fixture()
 right.extensions=right.extensions.filter(x=>x.name!=='supabase_vault')
 right.tables[0].rls=false
 const x=reviewIndependentRestoreCatalogs(left,right)
 assert.equal(x.metadataParity,false)
 assert.ok(x.failures.includes('EXTENSION_ABSENT_ON_RESTORE:supabase_vault'))
 assert.ok(x.failures.includes('TABLE_MISMATCH:public.fixture_0:rls'))
})
test('policy change, role escalation and migration drift fail closed',()=>{
 const left=fixture(),right=fixture()
 right.tables[0].policyHash='b'.repeat(32)
 right.roles[0].bypassRls=true
 right.migrations[0].name='wrong'
 const x=reviewIndependentRestoreCatalogs(left,right)
 assert.equal(x.metadataParity,false)
 assert.ok(x.failures.some(y=>y.includes('policyHash')))
 assert.ok(x.failures.some(y=>y.includes('bypassRls')))
 assert.ok(x.failures.some(y=>y.includes('MIGRATION_MISMATCH')))
})
test('bad data, duplicate IDs and absent collections rejected',()=>{
 const bad=fixture();bad.major=16
 assert.throws(()=>reviewIndependentRestoreCatalogs(bad,fixture()),/INCOMPLETE/)
 const dup=fixture();dup.tables.push({...dup.tables[0]})
 assert.throws(()=>reviewIndependentRestoreCatalogs(dup,fixture()),/DUPLICATE_TABLE/)
 const unsafe=fixture();unsafe.tables[0].policyHash='not-a-md5'
 assert.throws(()=>reviewIndependentRestoreCatalogs(unsafe,fixture()),/POLICY_NOT_GROUNDED/)
})
test('a restored catalog with different table cardinality cannot pass',()=>{
 const left=fixture(),right=fixture()
 right.tables.pop()
 const x=reviewIndependentRestoreCatalogs(left,right)
 assert.equal(x.metadataParity,false)
 assert.ok(x.failures.includes('TABLE_INVENTORY_CARDINALITY_MISMATCH'))
})
