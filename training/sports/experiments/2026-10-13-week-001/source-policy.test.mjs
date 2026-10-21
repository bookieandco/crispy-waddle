import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_ID,SOURCE_REGISTRY,NETWORK_OPERATIONS,DISABLED_SIDE_EFFECTS,sourceDecision,sourcePolicyReport,requireSourceOperation} from './source-policy.mjs';

test('every known external network operation is deny-by-default',()=>{
 for(const op of NETWORK_OPERATIONS){
   assert.deepEqual(sourceDecision(SOURCE_ID,op).allowed,false,op);
   assert.throws(()=>requireSourceOperation(SOURCE_ID,op),/SOURCE_RIGHTS_HOLD/,op);
 }
});
test('no runtime permission claim, env flag or undocumented source can grant access',()=>{
 const injected={permission:'VERIFIED',license:'yes',approved_by:'owner'};
 for(const source of ['user_supplied',SOURCE_ID+'?'+JSON.stringify(injected),'']) {
   assert.equal(sourceDecision(source,'COLLECT_RESULTS').allowed,false);
 }
 assert.equal(SOURCE_REGISTRY[SOURCE_ID].documented_permission_uri,null);
});
test('archive hash check is strictly offline and never grants rights',()=>{
 const answer=requireSourceOperation(SOURCE_ID,'HASH_VALIDATE_ARCHIVED_RECEIPTS');
 assert.equal(answer.allowed,true);
 assert.equal(answer.rights_verified,false);
 assert.equal(sourcePolicyReport().network_collection_allowed,false);
});
test('no source can authorize real wagers, payments, live trades, settlement or model tuning',()=>{
 for(const effect of DISABLED_SIDE_EFFECTS)
   assert.equal(sourceDecision(SOURCE_ID,effect).allowed,false,effect);
 assert.equal(sourceDecision('UNKNOWN','REAL_BET').allowed,false);
 assert.equal(sourceDecision(SOURCE_ID,'UNKNOWN').allowed,false);
});
