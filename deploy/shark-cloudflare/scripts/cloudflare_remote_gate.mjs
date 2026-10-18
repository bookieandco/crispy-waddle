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
export function validateSchedules(body) {
  if (!body || body.success !== true ||
      !Array.isArray(body.result?.schedules) ||
      body.result.schedules.length !== 0)
    throw Error("REMOTE_CRON_DISABLED_NOT_VERIFIED");
  return { cronTriggerCount: 0, verifiedNoCron: true };
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
