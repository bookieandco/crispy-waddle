#!/usr/bin/env node
/**
 * LIVE.09/.12: local budget screening for operator-provided Cloudflare metrics.
 * Source-proven arithmetic is NOT Cloudflare-attested quota, billing, CPU,
 * consent, host persistence, market outcomes or cron authorization.
 */
import {parseArgs} from "node:util";
import {readFileSync} from "node:fs";

const FREE=Object.freeze({
  cpuMs:10,subrequests:50,workerRequestsDay:100000,
  d1RowsReadDay:5000000,d1RowsWrittenDay:100000,
  d1BytesPerDatabase:500000000,d1BytesAccount:5000000000
});
const METRICS=Object.keys(FREE);
const NEVER={cronAuthorized:false,workerCollectionAuthorized:false,
  telegramAuthorized:false,tradingAuthorized:false,
  actualCloudflarePlanVerified:false,source:"OPERATOR_SUPPLIED_UNATTESTED"};
export function assessFreeBudget(sample) {
  if(!sample || typeof sample!=="object" || Array.isArray(sample))
    throw Error("SHARK_CF_BUDGET_SAMPLE_REQUIRED");
  // Conservative screen needs account-wide figures including unrelated Workers
  // and D1 databases. Unknown is explicitly NOT a zero-usage assumption.
  if(Object.keys(sample).some(k=>!["collectedAt","sourceRef","planReported","usage"].includes(k)))
    throw Error("SHARK_CF_UNREVIEWED_BUDGET_FIELD");
  const u=sample.usage;
  if(!u || typeof u!=="object" || Array.isArray(u) ||
     Object.keys(u).sort().join(",")!==METRICS.slice().sort().join(","))
    throw Error("SHARK_CF_BUDGET_METRICS_MISSING");
  if(typeof sample.sourceRef!=="string" || sample.sourceRef.length<8 ||
     sample.sourceRef.length>300 || !/^https:\/\//.test(sample.sourceRef) ||
     typeof sample.collectedAt!=="string" ||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(sample.collectedAt) ||
     !Number.isFinite(Date.parse(sample.collectedAt)))
    throw Error("SHARK_CF_BUDGET_PROVENANCE_INSUFFICIENT");
  if(METRICS.some(k=>typeof u[k]!=="number" || !Number.isFinite(u[k]) || u[k]<0))
    throw Error("SHARK_CF_BUDGET_VALUES_INVALID");
  // Leave 20% account-wide quota buffer; CPU and subrequest hard guards.
  const rules={
    cpuMs:u.cpuMs<FREE.cpuMs,
    subrequests:u.subrequests<FREE.subrequests,
    workerRequestsDay:u.workerRequestsDay<=FREE.workerRequestsDay*0.8,
    d1RowsReadDay:u.d1RowsReadDay<=FREE.d1RowsReadDay*0.8,
    d1RowsWrittenDay:u.d1RowsWrittenDay<=FREE.d1RowsWrittenDay*0.8,
    d1BytesPerDatabase:u.d1BytesPerDatabase<=FREE.d1BytesPerDatabase*0.8,
    d1BytesAccount:u.d1BytesAccount<=FREE.d1BytesAccount*0.8
  };
  const missingFreeProof=sample.planReported!=="FREE";
  const within=Object.values(rules).every(Boolean);
  return {schema:"SHARK_CF_FREE_BUDGET_SCREEN_01",
    status:missingFreeProof?"FREE_PLAN_NOT_OPERATOR_REPORTED":
      within?"NUMERIC_HEADROOM_SCREEN_ONLY":"FREE_BUDGET_HEADROOM_FAILED",
    reportedFreePlan:!missingFreeProof,nominalHeadroomWithinGuards:within,
    checks:rules,operatorSampleRequiresIndependentVerification:true,...NEVER};
}
function main(){
  const {values}=parseArgs({options:{input:{type:"string"}},strict:true});
  if(!values.input || values.input.includes("..") || values.input.startsWith("-"))
    throw Error("SHARK_CF_LOCAL_INPUT_REQUIRED");
  const data=JSON.parse(readFileSync(values.input,"utf8"));
  const report=assessFreeBudget(data);
  process.stdout.write(JSON.stringify(report)+"\n");
  if(!report.nominalHeadroomWithinGuards || !report.reportedFreePlan)
    process.exitCode=2;
}
if(process.argv[1]?.endsWith("/free_quota_gate.mjs")){
  try{main()}catch{
    process.stderr.write("SHARK_CF_FREE_BUDGET_FAIL_CLOSED\n");process.exitCode=1;
  }
}
