import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const file=new URL('../../../../supabase/recovery/biz-purse-15-order-journal.local.sql',import.meta.url)
const sql=readFileSync(file,'utf8')
test('recovery SQL is not a production migration and requires disposable DB',()=>{
 assert.match(sql,/LOCAL REHEARSAL ONLY/)
 assert.match(sql,/current_database\(\) !~ '\^biz_purse_recovery_/)
 assert.match(sql,/BIZ_PURSE_15_DISPOSABLE_POSTGRES_REQUIRED/)
})
test('atomic append locks owner/order stream and forbids cross-order event replay',()=>{
 assert.match(sql,/for update;/i)
 assert.match(sql,/unique \(owner_user_id,event_id\)/)
 assert.match(sql,/BIZ_PURSE_15_REPLAY_CONFLICT/)
 assert.match(sql,/BIZ_PURSE_15_STALE_HEAD/)
})
test('provider event dedupe and paid settlement uniqueness are independently scoped',()=>{
 assert.match(sql,/bp15_provider_event_unique/)
 assert.match(sql,/bp15_settled_payment_unique/)
 assert.match(sql,/where kind='PAYMENT_SETTLED'/)
})
test('schema and function cannot be directly used by browser roles',()=>{
 assert.match(sql,/revoke all on schema biz_purse_15_recovery from anon, authenticated/i)
 assert.match(sql,/security invoker/i)
 assert.match(sql,/revoke all on function biz_purse_15_recovery\.append_order_event_atomic[\s\S]*from public,anon,authenticated;/)
 assert.doesNotMatch(sql,/grant execute[\s\S]{0,180}to authenticated;/i)
})
test('SQL has no output that can authorize financial execution',()=>{
 assert.doesNotMatch(sql,/insert into (?:public\.)?(?:orders|trades|withdrawals)/i)
 assert.match(sql,/BIZ_PURSE_15_FINANCIAL_AUTHORITY_PAYLOAD_FORBIDDEN/)
})
