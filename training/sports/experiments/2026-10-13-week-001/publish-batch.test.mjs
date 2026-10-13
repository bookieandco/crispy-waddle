import test from 'node:test';
import assert from 'node:assert/strict';
import {publishBatch} from './publish-batch.mjs';
const sha=n=>n.repeat(40);
const report={schema_version:'jhadina.sports.week001_run.v2',placed_bets:0,virtual_bankroll_usd:3100,training_updates:0};
const body=JSON.stringify(report);
const sample={schema_version:'sports.publication.v1',files:[{path:'training/sports/paper-ledger/week001/runs/100-1.json',content:body}]};
const creds={repository:'bookieandco/crispy-waddle',branch:'main',token:'fake_test_token'};
function mock({exists=false,conflict=false,failPatchOnce=false}={}){
 const calls=[];let patches=0;
 const fetchImpl=async(url,args)=>{
  const method=args.method;const route=url.split('/repos/bookieandco/crispy-waddle')[1];
  calls.push({method,route,body:args.body&&JSON.parse(args.body)});
  const ok=data=>({ok:true,status:200,json:async()=>data});
  if(route==='/git/ref/heads/main')return ok({object:{sha:sha('a')}});
  if(route.startsWith('/contents/'))return exists?ok({encoding:'base64',content:Buffer.from(conflict?'DIFFERENT':body).toString('base64')}):{ok:false,status:404};
  if(route==='/git/commits/'+sha('a'))return ok({tree:{sha:sha('b')}});
  if(route==='/git/trees'&&method==='POST')return ok({sha:sha('c')});
  if(route==='/git/commits'&&method==='POST')return ok({sha:sha('d')});
  if(route==='/git/refs/heads/main'&&method==='PATCH'){
    patches++;return failPatchOnce&&patches===1?{ok:false,status:409}:ok({object:{sha:sha('d')}});
  }
  throw Error('UNMOCKED_'+method+'_'+route);
 };
 return {fetchImpl,calls};
}
test('one commit for one or more receipts',async()=>{
 const {fetchImpl,calls}=mock();
 const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.created,1);assert.equal(result.committed,true);
 assert.equal(calls.filter(c=>c.route==='/git/commits'&&c.method==='POST').length,1);
 assert.equal(calls.filter(c=>c.route==='/git/refs/heads/main').length,1);
 assert.equal(calls.filter(c=>c.route.includes('/contents/')&&c.method==='PUT').length,0);
 assert.equal(calls.find(c=>c.route==='/git/refs/heads/main').body.force,false);
});
test('identical receipt is idempotent without new commit',async()=>{
 const {fetchImpl,calls}=mock({exists:true});const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.created,0);assert.equal(result.idempotent,1);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
});
test('existing divergent receipt blocks whole batch',async()=>{
 const {fetchImpl,calls}=mock({exists:true,conflict:true});
 await assert.rejects(publishBatch(sample,{...creds,fetchImpl}),/IMMUTABLE_LEDGER_CONFLICT/);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
});
test('ref mismatch retries without force push',async()=>{
 const {fetchImpl,calls}=mock({failPatchOnce:true});
 const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.attempts,2);assert.equal(result.created,1);
 assert.equal(calls.filter(x=>x.route==='/git/refs/heads/main').length,2);
});
test('no repository or token scope violations',async()=>{
 const {fetchImpl}=mock();
 await assert.rejects(publishBatch(sample,{...creds,repository:'another/owner',fetchImpl}),/PUBLISH_NOT_AUTHORIZED/);
 await assert.rejects(publishBatch(sample,{...creds,token:'',fetchImpl}),/PUBLISH_NOT_AUTHORIZED/);
});
