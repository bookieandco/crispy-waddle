import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('./db-recover-07-postrestore-readonly.sql',import.meta.url),'utf8')
test('catalog checks cover all five commercial tables, policies and actual role grants',()=>{
 assert.equal((source.match(/\('jhadina_(?:side_hustle|digital_product)[^']*'\)/g)||[]).length,5)
 assert.match(source,/relrowsecurity/i)
 assert.match(source,/pg_catalog\.pg_policies/i)
 assert.match(source,/has_table_privilege\('anon'/i)
 assert.match(source,/has_table_privilege\('authenticated'/i)
 assert.match(source,/readyForProductionCertification',false/i)
})
test('cannot silently execute SQL DDL, grant, writes, or migrations',()=>{
 assert.doesNotMatch(source,/^\s*(?:create|alter|drop|insert|update|delete|grant|revoke|call|do|truncate)\b/im)
})
