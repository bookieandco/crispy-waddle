import test from "node:test";
import assert from "node:assert/strict";
import {validateD1,validateSchedules,validateDisabledBindings,validateSubdomainDisabled,verifyRemote} from "./cloudflare_remote_gate.mjs";
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

const disabledBindings = [
  {name:"DB",type:"d1",database_id:D},
  {name:"SHARK_CF_COLLECT_ENABLED",type:"plain_text",text:"false"},
  {name:"SHARK_CF_ALERTS",type:"plain_text",text:"false"},
  {name:"SHARK_CF_OWNER_AUTHORIZED",type:"plain_text",text:"false"},
];
test("remote disabled Worker bindings accept only one approved D1 and three false flags",()=>{
  assert.deepEqual(validateDisabledBindings({success:true,result:{bindings:disabledBindings}},D),
    {approvedD1Binding:true,exactlyThreeDisabledFlags:true,extraBindings:0,
      cronNotEvaluatedByThisCheck:true});
  for (const bad of [
    [...disabledBindings,{name:"SECRET",type:"secret_text"}],
    disabledBindings.map(x=>x.name==="DB"?{...x,database_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}:x),
    disabledBindings.map(x=>x.name==="SHARK_CF_ALERTS"?{...x,text:"true"}:x),
    disabledBindings.map(x=>x.name==="SHARK_CF_COLLECT_ENABLED"?{...x,text:null}:x),
    disabledBindings.map(x=>x.name==="DB"?{...x,name:"SECOND_DB"}:x),
    disabledBindings.slice(1),
  ]) {
    assert.throws(()=>validateDisabledBindings({success:true,result:{bindings:bad}},D));
  }
  assert.throws(()=>validateDisabledBindings({success:false,result:{bindings:disabledBindings}},D));
});
test("remote disabled Worker bindings readback GET is read-only and has no false live claims",async()=>{
  const calls=[];
  const receipt=await verifyRemote(A,D,TOK,"disabled-bindings-readback",async(url,opts)=>{
    calls.push({url,method:opts.method});
    return ok({success:true,result:url.endsWith("/settings")
      ? {bindings:disabledBindings}:{uuid:D,name:"jhadina-shark-public-free"}});
  });
  assert.equal(receipt.remoteDisabledBindingsVerified,true);
  assert.equal(receipt.remoteNoCronVerified,false);
  assert.equal(receipt.publicRoutesVerified,false);
  assert.equal(receipt.workersDevDisabledRemotelyVerified,false);
  assert.equal(receipt.canTrade,false);
  assert.equal(calls.length,2);
  assert.ok(calls.every(c=>c.method==="GET"));
  assert.ok(calls[1].url.endsWith("/workers/scripts/jhadina-shark-public-free/settings"));
});

test("workers.dev public subdomain must be off and cannot prove custom routes",async()=>{
  const readback=validateSubdomainDisabled({success:true,result:{enabled:false,previews_enabled:false}});
  assert.equal(readback.workersDevSubdomainDisabled,true);
  assert.equal(readback.zoneRoutesVerified,false);
  assert.equal(readback.previewUrlsVerifiedDisabled,true);
  for(const body of [
    {success:true,result:{enabled:false,previews_enabled:true}},
    {success:true,result:{enabled:false}},
    {success:true,result:{enabled:true,previews_enabled:false}},
    {success:true,result:{enabled:"false"}},
    {success:true,result:{}},
    {success:false,result:{enabled:false}},
  ]) assert.throws(()=>validateSubdomainDisabled(body));
  const seen=[];
  const receipt=await verifyRemote(A,D,TOK,"subdomain-readback",async (url,opts)=>{
    seen.push({url,method:opts.method});
    return ok({success:true,result:url.endsWith("/subdomain")?
      {enabled:false,previews_enabled:false}:{uuid:D,name:"jhadina-shark-public-free"}});
  });
  assert.equal(receipt.status,"REMOTE_WORKERS_DEV_SUBDOMAIN_OFF_ROUTES_UNVERIFIED");
  assert.equal(receipt.canTrade,false);
  assert.equal(receipt.previewUrlsVerifiedDisabled,true);
  assert.equal(seen.length,2);
  assert.ok(seen.every(x=>x.method==="GET"));
  assert.ok(seen[1].url.endsWith("/workers/scripts/jhadina-shark-public-free/subdomain"));
});
