import test from "node:test";
import assert from "node:assert/strict";
import {inspectSchema,preflightD1,SCHEMA_SELECT} from "./d1_schema_preflight.mjs";

const A="0123456789abcdef0123456789abcdef";
const D="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN="SYNTHETIC_NOT_AN_ACTUAL_CLOUDFLARE_TOKEN";
const reply=results=>({success:true,result:[{success:true,results}]});
const table=(name,sql)=>({type:"table",name,tbl_name:name,sql});
const index=(name,sql)=>({type:"index",name,tbl_name:"watch",sql});
const rows=[
  table("daily_budget","CREATE TABLE daily_budget(utc_day TEXT PRIMARY KEY,cycles INTEGER CHECK(cycles BETWEEN 0 AND 288))"),
  table("cycles","CREATE TABLE cycles(scheduled_ms INTEGER PRIMARY KEY,status TEXT CHECK(status IN ('STARTED','DONE','ERROR')))"),
  table("watch","CREATE TABLE watch(mint TEXT PRIMARY KEY,state TEXT CHECK(state IN ('OPEN','PRICE_ONLY','CENSORED')))"),
  table("observations","CREATE TABLE observations(mint TEXT,observed_ms INTEGER,PRIMARY KEY(mint, observed_ms), FOREIGN KEY(mint) REFERENCES watch(mint))"),
  table("outcomes","CREATE TABLE outcomes(mint TEXT PRIMARY KEY,FOREIGN KEY(mint) REFERENCES watch(mint))"),
  table("alert_outbox","CREATE TABLE alert_outbox(event_key TEXT PRIMARY KEY,state TEXT CHECK(state IN ('ATTEMPTED','ACKNOWLEDGED')))"),
  index("watch_due","CREATE INDEX watch_due ON watch(state, first_ms, last_check_ms)"),
];
test("brand new dedicated database is empty, not migration-ready or running",()=>{
  const r=inspectSchema(reply([]));
  assert.equal(r.status,"EMPTY_APPROVED_D1_REQUIRES_OPERATOR_MIGRATION");
  assert.equal(r.migrationApplied,false);
  assert.equal(r.workerRunning,false);
});
test("bounded exact six-table schema and index can be seen without asserting real migration provenance",()=>{
  const r=inspectSchema(reply([table("d1_migrations","CREATE TABLE d1_migrations(id INTEGER)"),...rows]));
  assert.equal(r.tablesPresent,6);
  assert.equal(r.indicesPresent,1);
  assert.equal(r.migrationApplied,"UNVERIFIED");
});
test("unknown tables, partial schema, failed results, missing checks and duplicates all stop",()=>{
  for(const r of [
    reply([rows[0]]),
    reply([...rows,table("pupsonstuff","CREATE TABLE pupsonstuff(id int)")]),
    reply(rows.map(x=>x.name==="watch"?{...x,sql:"CREATE TABLE watch(mint TEXT PRIMARY KEY)"}:x)),
    reply([...rows,rows[0]]),
    {success:true,result:[{success:false,results:rows}]},
    {success:true,result:[]},
    reply([...rows,table("d1_migrations","CREATE TABLE d1_migrations(id int)"),table("other","CREATE TABLE other(id int)")]),
  ]) assert.throws(()=>inspectSchema(r));
});
test("preflight uses only GET metadata and a fixed SELECT SQL under D1 Read",async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    const body=url.endsWith("/query")?reply([]):
      {success:true,result:{uuid:D,name:"jhadina-shark-public-free"}};
    return {ok:true,json:async()=>body};
  };
  const result=await preflightD1(A,D,TOKEN,fetcher);
  assert.equal(result.readOnlySelectViaPost,true);
  assert.equal(result.freePlanVerified,false);
  assert.equal(result.canTrade,false);
  assert.equal(result.cronEnabled,false);
  assert.equal(calls.length,2);
  assert.equal(calls[0].opts.method,"GET");
  assert.equal(calls[1].opts.method,"POST");
  const input=JSON.parse(calls[1].opts.body);
  assert.deepEqual(input,{sql:SCHEMA_SELECT,params:[]});
  assert.match(input.sql,/^SELECT /);
  assert.ok(!/INSERT|UPDATE|DELETE|ALTER|DROP|ATTACH|PRAGMA|CREATE/i.test(input.sql));
});
test("wrong D1 identity and missing token never access an unrelated schema",async()=>{
  await assert.rejects(()=>preflightD1(A,D,"",async()=>{throw Error("should not call");}));
  let calls=0;
  await assert.rejects(()=>preflightD1(A,D,TOKEN,async()=>{
    calls++;
    return {ok:true,json:async()=>({success:true,result:{uuid:D,name:"pupsonstuff"}})};
  }));
  assert.equal(calls,1);
});
