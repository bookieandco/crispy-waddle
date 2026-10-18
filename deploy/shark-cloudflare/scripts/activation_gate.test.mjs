import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, lstatSync, readFileSync, unlinkSync, chmodSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {
  parseTemplate, disabledConfig, strictCheck, createDisabled, reviewPrivate
} from "./activation_gate.mjs";

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(HOME, "wrangler.jsonc");
const ACCT = "0123456789abcdef0123456789abcdef";
const DBID = "00000000-0000-4000-8000-000000000002";
const PHRASE = "STAGE-SHARK-FREE-DISABLED-ONLY";

test("01 source template has zero cron, public routes, collection and alerts", () => {
  const x = parseTemplate();
  assert.deepEqual(x.triggers.crons, []);
  assert.equal(x.workers_dev, false);
  assert.equal(x.vars.SHARK_CF_COLLECT_ENABLED, "false");
  assert.equal(x.vars.SHARK_CF_ALERTS, "false");
  assert.equal(x.vars.SHARK_CF_OWNER_AUTHORIZED, "false");
});
test("02 only existing owner account and dedicated D1 UUIDs can be staged", () => {
  assert.throws(() => disabledConfig(parseTemplate(), "bad", DBID));
  assert.throws(() => disabledConfig(parseTemplate(), ACCT, "REPLACE_WITH_UUID"));
  assert.throws(() => disabledConfig(parseTemplate(), DBID, DBID));
  const x = disabledConfig(parseTemplate(), ACCT, DBID);
  assert.equal(x.account_id, ACCT);
  assert.equal(x.d1_databases[0].database_id, DBID);
  assert.deepEqual(x.triggers.crons, []);
});
test("03 refuse any hidden routes, cron, HTTP enablement or send flag", () => {
  const base = disabledConfig(parseTemplate(), ACCT, DBID);
  for (const modified of [
    {...base, routes:["example.com/*"]},
    {...base, triggers:{crons:["*/5 * * * *"]}},
    {...base, workers_dev:true},
    {...base, vars:{...base.vars,SHARK_CF_COLLECT_ENABLED:"true"}},
    {...base, vars:{...base.vars,SHARK_CF_ALERTS:"true"}},
    {...base, vars:{...base.vars,SHARK_CF_OWNER_AUTHORIZED:"true"}},
    {...base, observability:{enabled:true}},
    {...base, d1_databases:[{...base.d1_databases[0],database_name:"pupsonstuff"}]},
    {...base, d1_databases:[{...base.d1_databases[0],binding:"UNREVIEWED"}]},
  ]) {
    assert.throws(() => strictCheck(modified));
  }
});
test("04 refuse staging without exact owner consent or an overwritten target", () => {
  assert.throws(() => createDisabled({accountId:ACCT,databaseId:DBID,
    confirmation:"YES"}), /CONSENT/);
  assert.throws(() => createDisabled({accountId:ACCT,databaseId:DBID,
    confirmation:PHRASE,out:"/tmp/elsewhere.jsonc"}), /UNSAFE/);
});
test("05 successful local stage creates owner-only file with no remote claims", () => {
  assert.equal(existsSync(TARGET), false,
    "developer/private Wrangler config must not be present when certification runs");
  try {
    const r = createDisabled({accountId:ACCT,databaseId:DBID,
      confirmation:PHRASE});
    assert.equal(r.workerDeployed,false);
    assert.equal(r.dedicatedD1OwnershipVerifiedRemotely,false);
    assert.equal(lstatSync(TARGET).mode & 0o077,0);
    const x = JSON.parse(readFileSync(TARGET,"utf8"));
    assert.deepEqual(x.triggers.crons,[]);
    assert.equal(x.account_id,ACCT);
    assert.equal(x.d1_databases[0].database_id,DBID);
    const audit = reviewPrivate();
    assert.equal(audit.accountVerifiedByCloudflare,false);
    assert.equal(audit.actualWorkersCpuMeasured,false);
    assert.equal(audit.canTrade,false);
    assert.throws(()=>createDisabled({accountId:ACCT,databaseId:DBID,
      confirmation:PHRASE}), /OVERWRITE/);
    chmodSync(TARGET,0o644);
    assert.throws(()=>reviewPrivate(),/PERMISSIONS_INVALID/);
  } finally {
    if (existsSync(TARGET)) unlinkSync(TARGET);
  }
});
