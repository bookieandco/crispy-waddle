import test from "node:test";
import assert from "node:assert/strict";
import {assessFreeBudget} from "./free_quota_gate.mjs";
const sample={
  collectedAt:"2026-10-18T20:00:00Z",
  sourceRef:"https://dash.cloudflare.com/private-receipt",
  planReported:"FREE",
  usage:{
    cpuMs:7.5,subrequests:12,workerRequestsDay:5000,
    d1RowsReadDay:100000,d1RowsWrittenDay:1000,
    d1BytesPerDatabase:20000000,d1BytesAccount:100000000
  }
};
const copy=()=>structuredClone(sample);
test("passing operator numbers never assert actual Cloudflare metrics, cron or trading permission",()=>{
  const x=assessFreeBudget(copy());
  assert.equal(x.nominalHeadroomWithinGuards,true);
  assert.equal(x.status,"NUMERIC_HEADROOM_SCREEN_ONLY");
  assert.equal(x.actualCloudflarePlanVerified,false);
  assert.equal(x.cronAuthorized,false);
  assert.equal(x.workerCollectionAuthorized,false);
  assert.equal(x.telegramAuthorized,false);
  assert.equal(x.tradingAuthorized,false);
});
test("cpu, subrequest, account-wide and individual D1 caps fail screen",()=>{
  const bad={
    cpuMs:10,subrequests:50,workerRequestsDay:81000,
    d1RowsReadDay:4100000,d1RowsWrittenDay:81000,
    d1BytesPerDatabase:410000000,d1BytesAccount:4100000000
  };
  for(const [key,value] of Object.entries(bad)){
    const s=copy();s.usage[key]=value;
    const x=assessFreeBudget(s);
    assert.equal(x.nominalHeadroomWithinGuards,false,key);
    assert.equal(x.cronAuthorized,false);
  }
});
test("missing and invented measurement fields never silently default to zero",()=>{
  for(const bad of [
    { ...copy(),usage:{cpuMs:1}},
    {...copy(),usage:{...sample.usage,extra:1}},
    {...copy(),usage:{...sample.usage,cpuMs:NaN}},
    {...copy(),usage:{...sample.usage,subrequests:-1}},
    {...copy(),collectedAt:"tomorrow"},
    {...copy(),sourceRef:""},
    {...copy(),sourceRef:"file:///tmp/not-attested"},
    {...copy(),secret:"DO_NOT_ALLOW"},
    null
  ]) assert.throws(()=>assessFreeBudget(bad));
});
test("a claimed paid plan cannot qualify even when all reported numbers pass",()=>{
  const s=copy();s.planReported="PAID";
  const x=assessFreeBudget(s);
  assert.equal(x.reportedFreePlan,false);
  assert.equal(x.status,"FREE_PLAN_NOT_OPERATOR_REPORTED");
  assert.equal(x.cronAuthorized,false);
});
