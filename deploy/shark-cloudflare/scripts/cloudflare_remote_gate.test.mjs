import test from "node:test";
import assert from "node:assert/strict";
import {validateD1,validateSchedules,verifyRemote} from "./cloudflare_remote_gate.mjs";
const A="0123456789abcdef0123456789abcdef";
const D="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOK="SYNTHETIC_TEST_TOKEN_NOT_A_SECRET";
const ok=body=>({ok:true,json:async()=>body});
test("genuine D1 name and UUID both required",()=>{
  assert.deepEqual(validateD1({success:true,result:{uuid:D,name:"jhadina-shark-public-free"}},D),
    {dbIdentityVerified:true,databaseNameMatches:true});
  for(const name of ["pupsonstuff", "jhadina-tv", null])
    assert.throws(()=>validateD1({success:true,result:{uuid:D,name}},D));
  assert.throws(()=>validateD1({success:false,result:{uuid:D,name:"jhadina-shark-public-free"}},D));
});
test("remote schedules must exist and be EMPTY",()=>{
  assert.deepEqual(validateSchedules({success:true,result:{schedules:[]}}),
    {cronTriggerCount:0,verifiedNoCron:true});
  assert.throws(()=>validateSchedules({success:true,result:{schedules:[{cron:"*/5 * * * *"}]}}));
  assert.throws(()=>validateSchedules({success:true,result:null}));
});
test("verify-only reads D1 and makes no mutations",async()=>{
  const calls=[];
  const fetcher=async (url,opts)=>{
    calls.push({url,opts});
    return ok({success:true,result:{uuid:D,name:"jhadina-shark-public-free"}});
  };
  const receipt=await verifyRemote(A,D,TOK,"verify",fetcher);
  assert.equal(receipt.verifiedDedicatedDbIdentity,true);
  assert.equal(receipt.cloudflareFreePlanVerified,false);
  assert.equal(receipt.workerDeployed,false);
  assert.equal(calls.length,1);
  assert.equal(calls[0].opts.method,"GET");
  assert.equal(calls[0].url,"https://api.cloudflare.com/client/v4/accounts/"+A+"/d1/database/"+D);
});
test("postdeploy checks exact zero Cron via GET without enabling it",async()=>{
  const calls=[];
  const receipt=await verifyRemote(A,D,TOK,"cron-readback",async (url,opts)=>{
    calls.push({url,method:opts.method});
    return ok({success:true,result:url.endsWith("/schedules")
      ?{schedules:[]}:{uuid:D,name:"jhadina-shark-public-free"}});
  });
  assert.equal(receipt.remoteNoCronVerified,true);
  assert.equal(calls.length,2);
  assert.ok(calls.every(c=>c.method==="GET"));
});
test("missing credential, wrong D1, live cron all fail closed",async()=>{
  await assert.rejects(verifyRemote(A,D,"","verify",async()=>{throw Error("not reached");}));
  await assert.rejects(verifyRemote(A,D,TOK,"verify",async()=>
    ok({success:true,result:{uuid:D,name:"PupsonStuff"}})));
  await assert.rejects(verifyRemote(A,D,TOK,"cron-readback",async url=>
    ok({success:true,result:url.endsWith("/schedules")
      ?{schedules:[{cron:"*/5 * * * *"}]}:{uuid:D,name:"jhadina-shark-public-free"}})));
});
