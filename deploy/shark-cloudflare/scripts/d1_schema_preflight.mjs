#!/usr/bin/env node
/**
 * SHARK-CLOUDFLARE.LIVE.11 — read-only SQL schema preflight of the
 * separately owner-approved SHARK D1. This module NEVER migrates or writes.
 * Cloudflare's D1 query API uses HTTP POST even for a SQL SELECT.
 */
import {parseArgs} from "node:util";
import {validateD1} from "./cloudflare_remote_gate.mjs";

const ACCT=/^[0-9a-f]{32}$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const SCHEMA_SELECT="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name";
const REQUIRED=new Map([
  ["daily_budget",["create table","utc_day text primary key","check(cycles between 0 and 288)"]],
  ["cycles",["create table","scheduled_ms integer primary key","check(status in"]],
  ["watch",["create table","mint text primary key","check(state in"]],
  ["observations",["create table","primary key(mint, observed_ms)","foreign key(mint) references watch(mint)"]],
  ["outcomes",["create table","mint text primary key","foreign key(mint) references watch(mint)"]],
  ["alert_outbox",["create table","event_key text primary key","check(state in"]],
  ["watch_due",["create index","on watch(state, first_ms, last_check_ms)"]],
]);
const SYSTEM=new Set(["d1_migrations"]);
export function inspectSchema(payload) {
  if(payload?.success!==true || !Array.isArray(payload.result) ||
     payload.result.length!==1 || payload.result[0]?.success!==true ||
     !Array.isArray(payload.result[0]?.results))
    throw Error("REMOTE_D1_SCHEMA_UNREADABLE");
  const rows=payload.result[0].results;
  if(rows.length>25) throw Error("REMOTE_D1_SCHEMA_TOO_MANY_OBJECTS");
  const found=new Map();
  for(const row of rows) {
    if(!row || typeof row.name!=="string" || typeof row.sql!=="string" ||
       !["table","index"].includes(row.type) || found.has(row.name))
      throw Error("REMOTE_D1_SCHEMA_INVALID");
    if(SYSTEM.has(row.name)) {
      if(row.type!=="table") throw Error("REMOTE_D1_SYSTEM_SCHEMA_UNEXPECTED");
      continue;
    }
    if(!REQUIRED.has(row.name)) throw Error("REMOTE_D1_OTHER_PROJECT_OR_UNREVIEWED_SCHEMA");
    if(row.type!==(row.name==="watch_due"?"index":"table"))
      throw Error("REMOTE_D1_SCHEMA_WRONG_OBJECT_TYPE");
    const sql=row.sql.toLowerCase().replace(/\s+/g," ").replaceAll('"',"").replaceAll("`","");
    if(REQUIRED.get(row.name).some(fragment=>!sql.includes(fragment)))
      throw Error("REMOTE_D1_SCHEMA_CONSTRAINT_MISMATCH");
    found.set(row.name,true);
  }
  if(found.size===0)
    return {schema:"SHARK_CF_D1_PREFLIGHT_01",status:"EMPTY_APPROVED_D1_REQUIRES_OPERATOR_MIGRATION",
      tablesPresent:0,readOnly:true,migrationApplied:false,workerRunning:false};
  if(found.size!==REQUIRED.size)
    throw Error("REMOTE_D1_PARTIAL_SCHEMA_STOP");
  return {schema:"SHARK_CF_D1_PREFLIGHT_01",status:"EXPECTED_SCHEMA_OBJECTS_PRESENT_UNATTESTED",
    tablesPresent:6,indicesPresent:1,readOnly:true,
    migrationApplied:"UNVERIFIED",workerRunning:false};
}
async function readJson(url,init,fetcher) {
  const res=await fetcher(url,{...init,redirect:"error",signal:AbortSignal.timeout(9000),
    headers:{Authorization:"Bearer "+init.token,Accept:"application/json",...(init.method==="POST"?{"Content-Type":"application/json"}:{})}});
  if(!res?.ok) throw Error("REMOTE_D1_PREFLIGHT_ACCESS_DENIED");
  const data=await res.json();
  if(data?.success!==true) throw Error("REMOTE_D1_PREFLIGHT_FAILED");
  return data;
}
export async function preflightD1(accountId,databaseId,token,fetcher=fetch) {
  if(!ACCT.test(accountId||"")||!UUID.test(databaseId||"")||
     typeof token!=="string"||token.length<20)
    throw Error("APPROVED_SHARK_D1_CREDENTIALS_MISSING");
  const root="https://api.cloudflare.com/client/v4/accounts/"+accountId+"/d1/database/"+databaseId;
  const metadata=await readJson(root,{method:"GET",token},fetcher);
  validateD1(metadata,databaseId);
  const schema=await readJson(root+"/query",{
    method:"POST",token,body:JSON.stringify({sql:SCHEMA_SELECT,params:[]})},fetcher);
  return {...inspectSchema(schema),databaseIdentityVerified:true,
    freePlanVerified:false,quotaVerified:false,
    readOnlySelectViaPost:true,canTrade:false,cronEnabled:false};
}
async function main(){
  const {values}=parseArgs({options:{mode:{type:"string"}},strict:true});
  if(values.mode!=="schema-preflight") throw Error("ONLY_SCHEMA_PREFLIGHT_ALLOWED");
  const result=await preflightD1(process.env.SHARK_CF_ACCOUNT_ID,
    process.env.SHARK_CF_D1_ID,process.env.SHARK_CLOUDFLARE_API_TOKEN);
  process.stdout.write(JSON.stringify(result)+"\n");
}
if(process.argv[1]?.endsWith("/d1_schema_preflight.mjs")){
  main().catch(()=>{process.stderr.write("SHARK_D1_READ_ONLY_PREFLIGHT_FAILED_CLOSED\n");process.exitCode=1;});
}
