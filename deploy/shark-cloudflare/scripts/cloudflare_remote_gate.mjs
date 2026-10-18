#!/usr/bin/env node
/** Owner-authorized Cloudflare readback; no remote mutations in this module. */
import { parseArgs } from "node:util";
const ACCT = /^[0-9a-f]{32}$/;
const DBID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const NAME = "jhadina-shark-public-free";
const WORKER = "jhadina-shark-public-free";

export function validateD1(body, expectedId) {
  if (!body || body.success !== true || body.result?.uuid !== expectedId ||
      body.result?.name !== NAME)
    throw Error("REMOTE_D1_NOT_THE_APPROVED_SHARK_DATABASE");
  return { dbIdentityVerified: true, databaseNameMatches: true };
}
/** Proves only the public workers.dev subdomain gate, not zone routes/domains. */
export function validateSubdomainDisabled(payload) {
  if(payload?.success!==true || payload.result?.enabled!==false ||
     payload.result?.previews_enabled!==false)
    throw Error("REMOTE_WORKERS_DEV_OR_PREVIEW_ACCESS_NOT_DISABLED");
  return {workersDevSubdomainDisabled:true,previewUrlsVerifiedDisabled:true,
    zoneRoutesVerified:false,customDomainsVerified:false};
}
export function validateSchedules(body) {
  if (!body || body.success !== true ||
      !Array.isArray(body.result?.schedules) ||
      body.result.schedules.length !== 0)
    throw Error("REMOTE_CRON_DISABLED_NOT_VERIFIED");
  return { cronTriggerCount: 0, verifiedNoCron: true };
}
/** Remote account's Worker config, not the local Wrangler template. Reject all extra bindings. */
export function validateDisabledBindings(body, expectedId) {
  const rows = body?.result?.bindings;
  if (body?.success !== true || !Array.isArray(rows) || rows.length !== 4)
    throw Error("REMOTE_WORKER_UNEXPECTED_BINDINGS");
  const byName = new Map(rows.map(row => [row?.name, row]));
  if (byName.size !== 4 ||
      [...byName.keys()].some(name => !["DB","SHARK_CF_COLLECT_ENABLED",
        "SHARK_CF_ALERTS","SHARK_CF_OWNER_AUTHORIZED"].includes(name)))
    throw Error("REMOTE_WORKER_UNEXPECTED_BINDINGS");
  const d1 = byName.get("DB");
  if (d1?.type !== "d1" || d1.database_id !== expectedId)
    throw Error("REMOTE_WORKER_D1_BINDING_MISMATCH");
  for (const name of ["SHARK_CF_COLLECT_ENABLED","SHARK_CF_ALERTS",
    "SHARK_CF_OWNER_AUTHORIZED"]) {
    const row = byName.get(name);
    if (row?.type !== "plain_text" || row.text !== "false")
      throw Error("REMOTE_WORKER_ACTIVE_OR_UNVERIFIED_FLAG");
  }
  return { approvedD1Binding: true, exactlyThreeDisabledFlags: true,
    extraBindings: 0, cronNotEvaluatedByThisCheck: true };
}
async function apiGET(url, token, fetcher) {
  const response = await fetcher(url, {
    method: "GET",
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    redirect: "error", signal: AbortSignal.timeout(9000),
  });
  if (!response?.ok) throw Error("CLOUDFLARE_REMOTE_READ_REFUSED");
  const payload = await response.json();
  if (!payload || payload.success !== true) throw Error("CLOUDFLARE_REMOTE_READ_UNVERIFIED");
  return payload;
}
export async function verifyRemote(accountId, databaseId, token, mode = "verify", fetcher = fetch) {
  if (!ACCT.test(accountId) || !DBID.test(databaseId) ||
      typeof token !== "string" || token.length < 20)
    throw Error("OWNER_SCOPED_CREDENTIALS_MISSING");
  const root = "https://api.cloudflare.com/client/v4/accounts/" + accountId;
  const db = await apiGET(root + "/d1/database/" + databaseId, token, fetcher);
  validateD1(db, databaseId);
  if (mode === "verify")
    return { schema: "SHARK_CF_REMOTE_REVIEW_01",
      status: "REMOTE_D1_NAME_AND_ID_VERIFIED",
      verifiedDedicatedDbIdentity: true,
      cloudflareFreePlanVerified: false, paidPlanChangesMade: false,
      workerDeployed: false, cronEnabled: false, privateAlertsEnabled: false,
      actualCpuMeasured: false, canTrade: false };
  if (mode === "subdomain-readback") {
    const publicSubdomain=await apiGET(root+"/workers/scripts/"+WORKER+"/subdomain",token,fetcher);
    const readback=validateSubdomainDisabled(publicSubdomain);
    return {schema:"SHARK_CF_REMOTE_REVIEW_03",
      status:"REMOTE_WORKERS_DEV_SUBDOMAIN_OFF_ROUTES_UNVERIFIED",
      verifiedDedicatedDbIdentity:true,...readback,remoteNoCronVerified:false,
      remoteDisabledBindingsVerified:false,cloudflareFreePlanVerified:false,
      paidPlanChangesMade:false,actualCpuMeasured:false,canTrade:false};
  }
  if (mode === "disabled-bindings-readback") {
    const settings = await apiGET(
      root + "/workers/scripts/" + WORKER + "/settings", token, fetcher);
    validateDisabledBindings(settings, databaseId);
    return { schema: "SHARK_CF_REMOTE_REVIEW_02",
      status: "REMOTE_D1_AND_DISABLED_BINDINGS_VERIFIED",
      verifiedDedicatedDbIdentity: true, remoteDisabledBindingsVerified: true,
      cloudflareFreePlanVerified: false, paidPlanChangesMade: false,
      remoteNoCronVerified: false, publicRoutesVerified: false,
      workersDevDisabledRemotelyVerified: false, actualCpuMeasured: false,
      phoneAlertVerified: false, canTrade: false };
  }
  if (mode !== "cron-readback") throw Error("REVIEW_MODE_NOT_PERMITTED");
  const schedules = await apiGET(
    root + "/workers/scripts/" + WORKER + "/schedules", token, fetcher);
  validateSchedules(schedules);
  return { schema: "SHARK_CF_REMOTE_REVIEW_01",
    status: "REMOTE_D1_AND_NO_CRON_VERIFIED",
    verifiedDedicatedDbIdentity: true, remoteNoCronVerified: true,
    cloudflareFreePlanVerified: false, paidPlanChangesMade: false,
    privateAlertsEnabled: false, actualCpuMeasured: false,
    phoneAlertVerified: false, canTrade: false };
}
async function main() {
  const { values } = parseArgs({ options: { mode: { type: "string" } }, strict: true });
  const r = await verifyRemote(
    process.env.SHARK_CF_ACCOUNT_ID, process.env.SHARK_CF_D1_ID,
    process.env.SHARK_CLOUDFLARE_API_TOKEN, values.mode);
  process.stdout.write(JSON.stringify(r) + "\n");
}
if (process.argv[1]?.endsWith("/cloudflare_remote_gate.mjs")) {
  main().catch(() => {
    // Never log API payloads, account IDs, authorization headers or token.
    process.stderr.write("SHARK_CF_REMOTE_READBACK_FAIL_CLOSED\n");
    process.exitCode = 1;
  });
}
