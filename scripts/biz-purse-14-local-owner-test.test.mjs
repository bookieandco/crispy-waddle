import assert from 'node:assert/strict'
import test from 'node:test'
import {buildDisposableSqlTestPlan,parseDisposablePostgresUrl} from './biz-purse-14-local-owner-test.mjs'
const url='postgresql://postgres:local-only@127.0.0.1:54322/biz_purse_recovery_case'
test('explicit local disposable target can plan static SQL test without executing',()=>{
 const plan=buildDisposableSqlTestPlan({databaseUrl:url,confirmation:'YES_DISPOSABLE_DB_ONLY'})
 assert.equal(plan.command,'psql')
 assert.equal(plan.productionAuthorized,false)
 assert(plan.args.includes('biz_purse_recovery_case'))
 assert(plan.file.endsWith('biz-purse-14-two-owner-local-only.sql'))
})
test('no explicit confirmation fails closed',()=>{
 assert.throws(()=>buildDisposableSqlTestPlan({databaseUrl:url}),/CONFIRMATION_REQUIRED/)
})
test('remote, production-name, and unpinned ports fail closed',()=>{
 for(const bad of [
 'postgresql://postgres:x@db.supabase.co:5432/biz_purse_recovery_case',
 'postgresql://postgres:x@127.0.0.1:54322/postgres',
 'postgresql://postgres:x@127.0.0.1/biz_purse_recovery_case',
 'postgresql://admin:x@127.0.0.1:54322/biz_purse_recovery_case',
 ])assert.throws(()=>parseDisposablePostgresUrl(bad))
})
test('malicious connection params cannot alter CLI execution',()=>{
 assert.throws(()=>parseDisposablePostgresUrl(url+'?options=-c%20search_path%3Dpublic'),/OPTIONS_INVALID/)
})
