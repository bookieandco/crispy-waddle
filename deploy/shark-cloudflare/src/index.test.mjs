import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  RULES, WSOL, mintAllowed, priceNumber, publicCandidates, selectPair,
  riskFromAccount, gradeDue, claimCycle, readMint, runCycle,
} from "./index.mjs";

const MINT = "7YK4z6UMn8YvUPxgDGJnRuuk6zbyDX9qYE7HqbBByxzK";
const PAIR = "9YK4z6UMn8YvUPxgDGJnRuuk6zbyDX9qYE7HqbBByxzK";
const NOW = Date.parse("2026-10-18T12:00:00.000Z");
function mockFetch({ price = "0.001", badRpc = false, pair = PAIR, risk = false } = {}) {
  const calls = [];
  const fn = async (url, req) => {
    calls.push({ url, method: req?.method || "GET" });
    let body;
    if (url.endsWith("/token-profiles/latest/v1"))
      body = [{ chainId: "solana", tokenAddress: MINT }];
    else if (url.endsWith("/token-boosts/latest/v1")) body = [];
    else if (url.includes("/tokens/v1/solana/")) body = [{
      chainId: "solana", baseToken: { address: MINT }, pairAddress: pair,
      liquidity: { usd: 22000 }, priceUsd: price,
    }];
    else if (url.includes("/bot") && url.endsWith("/sendMessage"))
      body = { ok: true, result: { message_id: 1 } };
    else if (url === "https://api.mainnet.solana.com")
      body = badRpc ? { result: { value: null } } : {
        result: { value: { owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          data: { parsed: { type: "mint", info: {
            supply: "90000", mintAuthority: risk ? "owner" : null,
            freezeAuthority: null,
          } } } } },
      };
    else throw Error("external address not allowlisted");
    return { ok: true, headers: { get: () => null },
      text: async () => JSON.stringify(body) };
  };
  return { fn, calls };
}
class Db {
  constructor() {
    this.cycles = new Map();
    this.daily = new Map();
    this.watch = new Map();
    this.obs = new Map();
    this.outcomes = new Map();
    this.alerts = new Map();
  }
  prepare(sql) {
    return { bind: (...args) => {
      const changes = (n) => ({ meta: { changes: n } });
      return {
        run: async () => {
          if (sql.includes("INSERT OR IGNORE INTO cycles(")) {
            if (this.cycles.has(args[0])) return changes(0);
            this.cycles.set(args[0], { scheduled_ms: args[0], started_at: args[1], status: "STARTED" });
            return changes(1);
          }
          if (sql.includes("INSERT OR IGNORE INTO daily_budget")) {
            if (this.daily.has(args[0])) return changes(0);
            this.daily.set(args[0], 0); return changes(1);
          }
          if (sql.includes("UPDATE daily_budget SET cycles=")) {
            if (this.daily.get(args[0]) >= args[1]) return changes(0);
            this.daily.set(args[0], this.daily.get(args[0]) + 1); return changes(1);
          }
          if (sql.includes("INSERT OR IGNORE INTO watch(")) {
            if (this.watch.has(args[0])) return changes(0);
            this.watch.set(args[0], {
              mint: args[0], first_at: args[1], first_ms: args[2],
              pair: args[3], initial_usd: args[4], last_check_ms: args[5],
              last_usd: args[6], state: "OPEN", risk_flags: args[7],
            }); return changes(1);
          }
          if (sql.includes("INSERT OR IGNORE INTO observations(")) {
            this.obs.set(args[0] + ":" + args[1], args); return changes(1);
          }
          if (sql.includes("INSERT OR IGNORE INTO outcomes(")) {
            this.outcomes.set(args[0], { at_ms: args[1], kind: args[2], pct: args[3] });
            return changes(1);
          }
          if (sql.includes("UPDATE watch SET state=")) {
            const row = this.watch.get(args[2]);
            if (!row || row.state !== "OPEN") return changes(0);
            row.state = args[0]; row.last_check_ms = args[1]; return changes(1);
          }
          if (sql.includes("INSERT OR IGNORE INTO alert_outbox(")) {
            if (this.alerts.has(args[0])) return changes(0);
            this.alerts.set(args[0], { state: "ATTEMPTED" });
            return changes(1);
          }
          if (sql.includes("UPDATE alert_outbox SET state=")) {
            this.alerts.get(args[1]).state = args[0]; return changes(1);
          }
          if (sql.includes("UPDATE cycles SET status='DONE'")) {
            Object.assign(this.cycles.get(args[3]), {
              status: "DONE", new_count: args[0], follow_count: args[1],
              invalid_count: args[2],
            }); return changes(1);
          }
          if (sql.includes("UPDATE cycles SET status='ERROR'")) {
            this.cycles.get(args[0]).status = "ERROR"; return changes(1);
          }
          throw Error("Unexpected D1 run: " + sql);
        },
        first: async () => {
          if (sql.includes("SELECT COUNT(*) AS n FROM watch"))
            return { n: [...this.watch.values()].filter(w => w.state === "OPEN").length };
          if (sql.includes("SELECT mint FROM watch WHERE mint=?"))
            return this.watch.get(args[0]) ? { mint: args[0] } : null;
          throw Error("Unexpected D1 first: " + sql);
        },
        all: async () => {
          if (sql.includes("SELECT * FROM watch WHERE state='OPEN'"))
            return { results: [...this.watch.values()].filter(r =>
              r.state === "OPEN" && r.first_ms <= args[0]
            ).sort((a,b) => a.first_ms - b.first_ms).slice(0,args[1]) };
          throw Error("Unexpected D1 all: " + sql);
        },
      };
    } };
  }
}

test("01 default schedule, HTTP and missing-enable never collect", async () => {
  const db = new Db();
  const res = await runCycle({ DB: db }, NOW, () => { throw Error("NETWORK"); });
  assert.equal(res.status, "DISABLED_NO_COLLECTION");
  assert.equal(db.cycles.size, 0);
  assert.equal((await worker.fetch()).status, 404);
});
test("02 free-first candidates exclude WSOL, invalid/mismatched network", () => {
  assert.equal(mintAllowed(WSOL), false);
  assert.equal(priceNumber("-7"), null);
  assert.equal(priceNumber("0"), null);
  assert.deepEqual(publicCandidates([
    { chainId: "solana", tokenAddress: WSOL },
    { chainId: "ethereum", tokenAddress: MINT },
    { chainId: "solana", tokenAddress: MINT },
  ], [{ chainId: "solana", tokenAddress: MINT }]), [MINT]);
  assert.throws(() => publicCandidates({}, []));
});
test("03 token authority can never be considered safe merely because risk flags empty", () => {
  assert.throws(() => riskFromAccount({ result: { value: null } }));
  assert.equal(riskFromAccount({
    result: { value: { owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      data: { parsed: { type: "mint", info: { supply: "5", mintAuthority: null, freezeAuthority: null } } } } },
  }).length, 0);
});
test("04 paper followup not before horizon, never cross-pair or invent trade P&L", () => {
  const firstMs = NOW;
  assert.equal(gradeDue({ firstMs, nowMs: NOW + 1_000, firstUsd: .001,
    latestUsd: .002, pair: PAIR, originalPair: PAIR }).kind, "OPEN");
  assert.deepEqual(gradeDue({ firstMs, nowMs: NOW + RULES.horizonMinMs,
    firstUsd: .001, latestUsd: .0012, pair: PAIR, originalPair: PAIR }),
    { kind: "PRICE_ONLY_UNVERIFIED", pct: 20 });
  assert.equal(gradeDue({ firstMs, nowMs: NOW + RULES.horizonMinMs,
    firstUsd: .001, latestUsd: .002, pair: MINT, originalPair: PAIR }).kind,
    "PAIR_SWITCH_CENSORED");
  assert.equal(gradeDue({ firstMs, nowMs: NOW + RULES.horizonMaxMs + 1,
    firstUsd: .001, latestUsd: .002, pair: PAIR, originalPair: PAIR }).kind,
    "HORIZON_MISSED_CENSORED");
});
test("05 full scheduled D1 public-only discovery, dedupe and 24h price mark", async () => {
  const db = new Db(), env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true" };
  const firstFetch = mockFetch();
  const first = await runCycle(env, NOW, firstFetch.fn, () => NOW);
  assert.equal(first.newCount, 1);
  assert.equal(first.canTrade, false);
  assert.equal(first.privateSendAcknowledged, 0);
  assert.equal(db.watch.size, 1);
  assert.equal(db.obs.size, 1);
  assert.equal(firstFetch.calls.length, 4); // 2 public feeds + public pair/RPC
  const repeat = await runCycle(env, NOW, () => { throw Error("duplicate fetched"); });
  assert.equal(repeat.status, "DUPLICATE_CYCLE_REJECTED");
  const later = await runCycle(env, NOW + RULES.horizonMinMs, mockFetch({ price: "0.0012" }).fn, () => NOW + RULES.horizonMinMs);
  assert.equal(later.priceOnlyCount, 1);
  assert.equal(db.outcomes.get(MINT).kind, "PRICE_ONLY_UNVERIFIED");
  assert.equal(db.outcomes.get(MINT).pct, 20);
  assert.equal(db.watch.get(MINT).state, "PRICE_ONLY");
});
test("06 provider failure quarantines and never opens a positive paper case", async () => {
  const db = new Db(), env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true" };
  const x = await runCycle(env, NOW, mockFetch({ badRpc: true }).fn, () => NOW);
  assert.equal(x.quarantinedCount, 1);
  assert.equal(x.newCount, 0);
  assert.equal(db.watch.size, 0);
});
test("07 outbox sends only explicitly authorized private research, at most once", async () => {
  const db = new Db();
  const env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true",
    SHARK_CF_ALERTS: "true", SHARK_CF_OWNER_AUTHORIZED: "true",
    TELEGRAM_ALLOWED_USER_ID: "123456789",
    TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDEF" };
  const f = mockFetch();
  const r = await runCycle(env, NOW, f.fn, () => NOW);
  assert.equal(r.privateSendAcknowledged, 1);
  assert.equal(db.alerts.get("PUBLIC_FIRST:" + MINT).state, "ACKNOWLEDGED");
  assert.equal(f.calls.filter(x => x.url.includes("telegram.org")).length, 1);
  const r2 = await runCycle(env, NOW + RULES.cycleMs, mockFetch().fn, () => NOW + RULES.cycleMs);
  assert.equal(r2.privateSendAcknowledged, 0);
  assert.equal(db.alerts.size, 1);
});
test("08 D1 daily budget and cycle dedupe enforce bounded invocation", async () => {
  const db = new Db();
  assert.equal(await claimCycle(db, NOW), true);
  assert.equal(await claimCycle(db, NOW), false);
  const day = new Date(NOW).toISOString().slice(0, 10);
  db.daily.set(day, RULES.maxDailyCycles);
  await assert.rejects(claimCycle(db, NOW + RULES.cycleMs), /DAILY_CYCLE_GUARD/);
});
test("prospective timestamp comes from provider response, not scheduled Cron time", async () => {
  const db = new Db();
  const env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true" };
  const actualResponseMs = NOW + 45_000;
  const result = await runCycle(env, NOW, mockFetch().fn, () => actualResponseMs);
  assert.equal(result.newCount, 1);
  assert.equal(db.watch.get(MINT).first_ms, actualResponseMs);
  assert.equal(db.obs.get(MINT + ":" + actualResponseMs)[1], actualResponseMs);
  const premature = await runCycle(env, NOW + RULES.horizonMinMs,
    mockFetch({ price: "0.0012" }).fn, () => NOW + RULES.horizonMinMs);
  assert.equal(premature.priceOnlyCount, 0);
  const correct = await runCycle(env, NOW + RULES.horizonMinMs + RULES.cycleMs,
    mockFetch({ price: "0.0012" }).fn,
    () => NOW + RULES.horizonMinMs + RULES.cycleMs);
  assert.equal(correct.priceOnlyCount, 1);
});

test("stale completed research does not starve new active case admission", async () => {
  const db = new Db();
  for (let i=0; i<1000; i++) db.watch.set("old"+i, { state:"PRICE_ONLY" });
  const env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true" };
  const result = await runCycle(env, NOW, mockFetch().fn, () => NOW);
  assert.equal(result.newCount, 1);
  assert.equal(db.watch.size, 1001);
  assert.equal(db.watch.get(MINT).state, "OPEN");
});

test("at most one outbound Telegram attempt, even after ambiguous failure", async () => {
  const db = new Db();
  const second = "6YK4z6UMn8YvUPxgDGJnRuuk6zbyDX9qYE7HqbBByxzK";
  const env = { DB: db, SHARK_CF_COLLECT_ENABLED: "true",
    SHARK_CF_ALERTS: "true", SHARK_CF_OWNER_AUTHORIZED: "true",
    TELEGRAM_ALLOWED_USER_ID: "123456789",
    TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDEF" };
  const normal = mockFetch();
  let attempted = 0;
  const fetcher = async (url, opts) => {
    if (url.endsWith("/token-profiles/latest/v1")) {
      return { ok:true, headers:{get:()=>null}, text:async()=>JSON.stringify([
        {chainId:"solana",tokenAddress:MINT},
        {chainId:"solana",tokenAddress:second}
      ])};
    }
    if (url.endsWith("/tokens/v1/solana/"+second)) {
      return { ok:true, headers:{get:()=>null}, text:async()=>JSON.stringify([{
        chainId:"solana", baseToken:{address:second}, pairAddress:PAIR,
        liquidity:{usd:22000}, priceUsd:"0.001"
      }])};
    }
    if (url.includes("telegram.org")) {
      attempted++;
      throw Error("synthetic uncertain reply");
    }
    return normal.fn(url,opts);
  };
  const result = await runCycle(env,NOW,fetcher,()=>NOW);
  assert.equal(result.newCount,2);
  assert.equal(result.privateSendAcknowledged,0);
  assert.equal(attempted,1);
  assert.equal(db.alerts.size,1);
  assert.equal([...db.alerts.values()][0].state,"UNCERTAIN_NO_RETRY");
  assert.equal(db.watch.size,2);
});

test("active cap applies inside a two-candidate batch, not only before loop", async () => {
  const db = new Db();
  for (let i=0;i<RULES.maxActiveWatches-1;i++)
    db.watch.set("prior"+i,{state:"OPEN",first_ms:NOW, mint:"prior"+i});
  const env={DB:db, SHARK_CF_COLLECT_ENABLED:"true"};
  const found=await runCycle(env,NOW,mockFetch().fn,()=>NOW);
  assert.equal(found.newCount,1);
  assert.equal([...db.watch.values()].filter(w=>w.state==="OPEN").length,
    RULES.maxActiveWatches);
});

test("missing D1 fails closed, no HTTP request handler for writes", async () => {
  await assert.rejects(runCycle({ SHARK_CF_COLLECT_ENABLED: "true" }, NOW),
    /BINDING_REQUIRED/);
  assert.equal(selectPair([{ chainId: "solana", baseToken: { address: MINT },
    pairAddress: PAIR, priceUsd: "0.01", liquidity: { usd: 30 } }], MINT, MINT).switched, true);
});
