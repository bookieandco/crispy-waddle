#!/usr/bin/env node
/**
 * SHARK-CLOUDFLARE.ACTIVATE.01-.04 — offline, owner-verified staging gates.
 *
 * This tool makes NO API requests and cannot create a Cloudflare account,
 * D1 database, Worker, Cron Trigger, secret, alert or expense. It emits an
 * untracked deploy-disabled Wrangler config only for an existing, separately
 * verified account and dedicated D1 database.
 */
import { readFileSync, writeFileSync, lstatSync, existsSync, openSync, closeSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = resolve(HOME, "wrangler.example.jsonc");
const OUTPUT = resolve(HOME, "wrangler.jsonc");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ACCOUNT_ID = /^[0-9a-f]{32}$/; // Cloudflare account tag (NOT a UUID).
const CONFIRM = "STAGE-SHARK-FREE-DISABLED-ONLY";
const EXPECTED_NAME = "jhadina-shark-public-free";
const GATES = ["SHARK_CF_COLLECT_ENABLED", "SHARK_CF_ALERTS", "SHARK_CF_OWNER_AUTHORIZED"];

export function disabledConfig(template, accountId, databaseId) {
  if (!ACCOUNT_ID.test(accountId) || !UUID.test(databaseId))
    throw Error("INVALID_OWNER_VERIFIED_ACCOUNT_OR_DATABASE_ID");
  const config = structuredClone(template);
  config.account_id = accountId;
  config.d1_databases[0].database_id = databaseId;
  return strictCheck(config, false);
}
export function strictCheck(config, templateMode = false) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw Error("INVALID_WRANGLER_CONFIG");
  const allowed = ["name", "main", "compatibility_date", "workers_dev", "triggers",
    "observability", "vars", "d1_databases", ...(templateMode ? [] : ["account_id"])];
  if (Object.keys(config).some(k => !allowed.includes(k)))
    throw Error("UNREVIEWED_WRANGLER_FIELD");
  if (config.name !== EXPECTED_NAME || config.main !== "src/index.mjs" ||
      config.workers_dev !== false ||
      config.triggers?.crons?.length !== 0 ||
      Object.keys(config.triggers || {}).join(",") !== "crons" ||
      config.observability?.enabled !== false ||
      config.compatibility_date !== "2026-10-18")
    throw Error("DEPLOY_DISABLED_WORKER_CONFIG_REQUIRED");
  if (!config.vars || Object.keys(config.vars).length !== GATES.length ||
      GATES.some(k => config.vars[k] !== "false"))
    throw Error("EVERY_PUBLIC_COLLECTION_AND_ALERT_GRANT_MUST_BE_FALSE");
  if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1 ||
      config.d1_databases[0].binding !== "DB" ||
      config.d1_databases[0].database_name !== EXPECTED_NAME ||
      config.d1_databases[0].migrations_dir !== "migrations" ||
      Object.keys(config.d1_databases[0]).sort().join(",") !==
       ["binding","database_id","database_name","migrations_dir"].sort().join(","))
    throw Error("DEDICATED_D1_BINDING_REQUIRED");
  if (templateMode) {
    if (config.d1_databases[0].database_id !== "REPLACE_WITH_APPROVED_NEW_D1_UUID")
      throw Error("TEMPLATE_MUST_NOT_CONTAIN_REAL_ACCOUNT_RESOURCES");
  } else {
    if (!ACCOUNT_ID.test(config.account_id) ||
        !UUID.test(config.d1_databases[0].database_id))
      throw Error("ACTUAL_OWNER_ACCOUNT_AND_D1_IDENTIFIERS_REQUIRED");
  }
  return config;
}
export function parseTemplate(file = TEMPLATE) {
  const raw = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return strictCheck(JSON.parse(raw), true);
}
export function createDisabled({accountId,databaseId,confirmation,out = OUTPUT}) {
  if (confirmation !== CONFIRM) throw Error("EXPLICIT_DISABLED_STAGING_CONSENT_MISSING");
  const dest = resolve(out);
  if (dest !== OUTPUT || basename(dest) !== "wrangler.jsonc" ||
      existsSync(dest)) throw Error("UNSAFE_CONFIG_TARGET_OR_OVERWRITE");
  const config = disabledConfig(parseTemplate(), accountId, databaseId);
  const payload = JSON.stringify(config, null, 2) + "\n";
  const fd = openSync(dest, "wx", 0o600);
  try {
    writeFileSync(fd, payload, "utf8");
  } catch (e) {
    closeSync(fd);
    unlinkSync(dest);
    throw e;
  }
  closeSync(fd);
  return { schema: "SHARK-CF-ACTIVATE-SOURCE-V1", status: "PRIVATE_DEPLOY_DISABLED_CONFIG_STAGED",
    hasApprovedCloudflareAccount: false, freeAccountBillingProven: false,
    dedicatedD1OwnershipVerifiedRemotely: false, workerDeployed: false,
    cronEnabled: false, collectionEnabled: false, telegramSendEnabled: false,
    canTrade: false };
}
export function reviewPrivate(file = OUTPUT) {
  const dest = resolve(file);
  if (dest !== OUTPUT) throw Error("APPROVED_PRIVATE_WRANGLER_PATH_REQUIRED");
  const item = lstatSync(dest);
  if (!item.isFile() || item.isSymbolicLink() || (item.mode & 0o077))
    throw Error("PRIVATE_WRANGLER_FILE_PERMISSIONS_INVALID");
  const config = strictCheck(JSON.parse(readFileSync(dest, "utf8")));
  return { schema: "SHARK-CF-ACTIVATE-SOURCE-V1",
    status: "LOCAL_DISABLED_CONFIG_VALID_NOT_ACCOUNT_PROVEN",
    d1Binding: config.d1_databases[0].binding, worker: config.name,
    cronEnabled: false, collectionEnabled: false,
    telegramSendEnabled: false, accountVerifiedByCloudflare: false,
    actualWorkersCpuMeasured: false, noExternalRequests: true, canTrade: false };
}
function main() {
  const { values } = parseArgs({ options: {
    mode: { type: "string" }, "account-id": { type: "string" },
    "database-id": { type: "string" }, confirm: { type: "string" },
  }, strict: true });
  let answer;
  if (values.mode === "template")
    answer = {schema:"SHARK-CF-ACTIVATE-SOURCE-V1",
      status:"SOURCE_DISABLED_TEMPLATE_VALIDATED", sourceOnly:true,
      cloudflareAuthenticated:false, d1Provisioned:false, cronEnabled:false,
      actualWorkersCpuMeasured:false, canTrade:false, verifiedName:parseTemplate().name};
  else if (values.mode === "stage")
    answer = createDisabled({accountId:values["account-id"],
      databaseId:values["database-id"], confirmation:values.confirm});
  else if (values.mode === "review") answer = reviewPrivate();
  else throw Error("UNKNOWN_MODE");
  process.stdout.write(JSON.stringify(answer)+"\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch {
    process.stderr.write("SHARK_CF_ACTIVATION_SOURCE_GATE_FAIL_CLOSED\n");
    process.exitCode = 1;
  }
}
