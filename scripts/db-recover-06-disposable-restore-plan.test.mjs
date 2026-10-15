import test from 'node:test'
import assert from 'node:assert/strict'
import {buildDisposableRestorePlan} from './db-recover-06-disposable-restore-plan.mjs'
const bundle={status:'BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE',
 sourceProjectId:'kqbkaozfjubkjevdfvic',files:[{kind:'roles'},{kind:'schema'},{kind:'data'}]}
const url='postgresql://postgres:local-only@127.0.0.1:54322/biz_purse_recovery_test'
const plan=(o={})=>buildDisposableRestorePlan({confirmation:'YES_DISPOSABLE_DB_ONLY',
 bundle,bundleDir:'/tmp/db-recover-fixture',databaseUrl:url,...o})
test('valid local plan holds execution until manual inspected operator step',()=>{
 const p=plan()
 assert.equal(p.command,'psql');assert.equal(p.status,'LOCAL_RESTORE_PLAN_ONLY')
 assert.equal(p.canExecuteProduction,false);assert.equal(p.backupRestored,false)
 assert.deepEqual(p.environmentKeysRequired,['PGPASSWORD'])
 assert(p.args.includes('--single-transaction'))
 assert(p.args.includes('ON_ERROR_STOP=1'))
 assert(p.args.filter(x=>x==='--file').length===3)
 assert(!JSON.stringify(p).includes('local-only'))
})
test('remote host, production name, missing confirmation and unverified bytes fail closed',()=>{
 assert.throws(()=>plan({databaseUrl:'postgresql://postgres:secret@db.example.com:5432/postgres'}),/NOT_LOOPBACK/)
 assert.throws(()=>plan({databaseUrl:'postgresql://postgres:local@localhost:5432/postgres'}),/NAME_INVALID/)
 assert.throws(()=>plan({confirmation:''}),/CONFIRMATION_REQUIRED/)
 assert.throws(()=>plan({bundle:{...bundle,status:'SYNTHETIC_CANARY'}}),/BYTES_UNVERIFIED/)
})
