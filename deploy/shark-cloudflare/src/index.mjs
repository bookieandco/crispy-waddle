/**
 * SHARK-CLOUDFLARE.FREE.01-.08: independent lightweight PUBLIC observation
 * adapter; the Python SHARK study remains canonical for full-risk verification.
 *
 * Never imports Telegram messages, places trades, signs wallets, or claims
 * provider-attested alpha. D1 data is NOT interchangeable with Python ledger.
 * No HTTP ingress. Cron is DISABLED in the checked-in Wrangler template.
 */
export const RULES = Object.freeze({
  cycleMs: 300_000, horizonMinMs: 86_400_000, horizonMaxMs: 108_000_000,
  maxDailyCycles: 288, maxActiveWatches: 1000, maxNew: 2, maxFollow: 3,
  maxAlerts: 1, minRetryMs: 600_000, maxBody: 150_000,
});
export const WSOL = "So11111111111111111111111111111111111111112";
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEX = "https://api.dexscreener.com";
const RPC = "https://api.mainnet.solana.com";
const LEGACY_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOURCE = "PUBLIC_DEX_RPC_UNATTESTED";
const HEADERS = { accept: "application/json" };

export function mintAllowed(mint) {
  return typeof mint === "string" && ADDRESS.test(mint) && mint !== WSOL;
}
export function priceNumber(x) {
  const n = typeof x === "string" && /^[0-9]+(?:\.[0-9]+)?(?:e[-+]?[0-9]+)?$/i.test(x)
    ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function publicCandidates(profiles, boosts) {
  const found = new Set();
  for (const source of [profiles, boosts]) {
    if (!Array.isArray(source)) throw Error("PUBLIC_DISCOVERY_INVALID");
    for (const item of source.slice(0, 100)) {
      if (item && item.chainId === "solana" && mintAllowed(item.tokenAddress))
        found.add(item.tokenAddress);
    }
  }
  return [...found].slice(0, RULES.maxNew);
}
export function selectPair(rows, mint, expectedPair = null) {
  if (!Array.isArray(rows)) throw Error("PUBLIC_PAIR_INVALID");
  const viable = rows.slice(0, 80).filter(p =>
    p && p.chainId === "solana" && p.baseToken?.address === mint &&
    typeof p.pairAddress === "string" && ADDRESS.test(p.pairAddress) &&
    priceNumber(p.priceUsd) !== null &&
    typeof p.liquidity?.usd === "number" && Number.isFinite(p.liquidity.usd) &&
    p.liquidity.usd >= 0);
  if (!viable.length) throw Error("PUBLIC_PAIR_MISSING");
  const chosen = expectedPair
    ? viable.find(p => p.pairAddress === expectedPair)
    : viable.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
  if (!chosen) return { switched: true };
  return {
    switched: false, pair: chosen.pairAddress, usd: priceNumber(chosen.priceUsd),
    liquidity: chosen.liquidity.usd,
  };
}
export function riskFromAccount(reply) {
  const value = reply?.result?.value;
  const data = value?.data?.parsed;
  if (!value || value.owner !== LEGACY_TOKEN || data?.type !== "mint" ||
      !data.info || typeof data.info.supply !== "string") {
    throw Error("PUBLIC_TOKEN_PROGRAM_OR_MINT_UNVERIFIED");
  }
  const flags = [];
  if (data.info.mintAuthority != null) flags.push("MINT_AUTHORITY_ACTIVE");
  if (data.info.freezeAuthority != null) flags.push("FREEZE_AUTHORITY_ACTIVE");
  // These flags are limited checks; missing flags never means token safety.
  return flags;
}
export function gradeDue({ firstMs, nowMs, firstUsd, latestUsd, pair, originalPair }) {
  const age = nowMs - firstMs;
  if (age < RULES.horizonMinMs) return { kind: "OPEN", pct: null };
  if (age > RULES.horizonMaxMs)
    return { kind: "HORIZON_MISSED_CENSORED", pct: null };
  if (pair !== originalPair)
    return { kind: "PAIR_SWITCH_CENSORED", pct: null };
  if (![firstUsd, latestUsd].every(x => typeof x === "number" && Number.isFinite(x) && x > 0))
    return { kind: "MISSING_PROVIDER_CENSORED", pct: null };
  return { kind: "PRICE_ONLY_UNVERIFIED", pct: Math.round(((latestUsd / firstUsd) - 1) * 1e8) / 1e6 };
}
async function getJson(url, init, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    ...init, redirect: "error",
    signal: AbortSignal.timeout(4000),
    headers: { ...HEADERS, ...(init?.headers || {}) },
  });
  if (!res?.ok) throw Error("PUBLIC_PROVIDER_HTTP_FAILURE");
  const length = Number(res.headers?.get?.("content-length") ?? 0);
  if (length > RULES.maxBody) throw Error("PUBLIC_PROVIDER_OVERSIZE");
  const text = await res.text();
  if (text.length > RULES.maxBody) throw Error("PUBLIC_PROVIDER_OVERSIZE");
  return JSON.parse(text);
}
export async function readMint(mint, expectedPair = null, fetchImpl = fetch) {
  if (!mintAllowed(mint)) throw Error("PUBLIC_MINT_INVALID");
  const [rows, account] = await Promise.all([
    getJson(DEX + "/tokens/v1/solana/" + mint, undefined, fetchImpl),
    getJson(RPC, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
    }, fetchImpl),
  ]);
  const risk = riskFromAccount(account);
  const pair = selectPair(rows, mint, expectedPair);
  return { ...pair, risk, source: SOURCE };
}
function q(db, sql, ...params) { return db.prepare(sql).bind(...params); }
function changed(r) { return Number(r?.meta?.changes || 0) > 0; }
function iso(ms) { return new Date(ms).toISOString(); }
function validClock(ms) { return Number.isSafeInteger(ms) && ms > 1_700_000_000_000 && ms < 4_000_000_000_000; }

export async function claimCycle(db, scheduledMs) {
  if (!validClock(scheduledMs)) throw Error("PUBLIC_CLOCK_INVALID");
  const first = await q(db,
    "INSERT OR IGNORE INTO cycles(scheduled_ms,started_at,status) VALUES(?,?,'STARTED')",
    scheduledMs, iso(scheduledMs)).run();
  if (!changed(first)) return false; // duplicate schedule or retry: never replay
  const date = iso(scheduledMs).slice(0, 10);
  await q(db, "INSERT OR IGNORE INTO daily_budget(utc_day,cycles) VALUES(?,0)", date).run();
  const budget = await q(db,
    "UPDATE daily_budget SET cycles=cycles+1 WHERE utc_day=? AND cycles<?",
    date, RULES.maxDailyCycles).run();
  if (!changed(budget)) throw Error("PUBLIC_FREE_TIER_DAILY_CYCLE_GUARD");
  return true;
}
async function fetchDiscovery(fetchImpl) {
  const [profiles, boosts] = await Promise.all([
    getJson(DEX + "/token-profiles/latest/v1", undefined, fetchImpl),
    getJson(DEX + "/token-boosts/latest/v1", undefined, fetchImpl),
  ]);
  return publicCandidates(profiles, boosts);
}
async function sendPrivateOnce(env, db, mint, flags, nowMs, fetchImpl) {
  if (env.SHARK_CF_ALERTS !== "true" ||
      env.SHARK_CF_OWNER_AUTHORIZED !== "true") return false;
  if (!/^[0-9]{5,20}$/.test(env.TELEGRAM_ALLOWED_USER_ID || "") ||
      !/^[0-9]{5,15}:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN || ""))
    throw Error("PUBLIC_ALERT_AUTHORIZATION_INCOMPLETE");
  const claimed = await q(db,
    "INSERT OR IGNORE INTO alert_outbox(event_key,mint,created_ms,state) VALUES(?, ?, ?, 'ATTEMPTED')",
    "PUBLIC_FIRST:" + mint, mint, nowMs).run();
  if (!changed(claimed)) return false;
  let ack = false;
  try {
    const body = "Jhadina SHARK | PUBLIC research, NOT a trade signal\n" +
      "Unverified Solana-format mint: " + mint + "\n" +
      "Limited controls: " + (flags.join(", ") || "No authority flags found; NOT proof of safety") +
      "\nIndependent verification, execution and profits: NOT ESTABLISHED";
    const url = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
    const reply = await getJson(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_ALLOWED_USER_ID, text: body }),
    }, fetchImpl);
    ack = reply?.ok === true;
  } catch {
    // Preserve uncertain state; never automatically retry.
  }
  await q(db, "UPDATE alert_outbox SET state=? WHERE event_key=?",
    ack ? "ACKNOWLEDGED" : "UNCERTAIN_NO_RETRY", "PUBLIC_FIRST:" + mint).run();
  return ack;
}
export async function runCycle(env, scheduledMs, fetchImpl = fetch, clock = () => Date.now()) {
  if (env.SHARK_CF_COLLECT_ENABLED !== "true")
    return { status: "DISABLED_NO_COLLECTION", noTrade: true };
  if (!env.DB) throw Error("PUBLIC_D1_BINDING_REQUIRED");
  if (!validClock(scheduledMs)) throw Error("PUBLIC_CLOCK_INVALID");
  // A deployment with no Cron Trigger never calls this function.
  const db = env.DB;
  if (!await claimCycle(db, scheduledMs))
    return { status: "DUPLICATE_CYCLE_REJECTED", noTrade: true };
  let newly = 0, followed = 0, censored = 0, quarantined = 0, alerts = 0, alertAttempts = 0;
  try {
    // Due followups FIRST, so new discovery cannot starve prospective cases.
    const due = await q(db,
      "SELECT * FROM watch WHERE state='OPEN' AND first_ms<=? ORDER BY first_ms LIMIT ?",
      scheduledMs - RULES.horizonMinMs, RULES.maxFollow).all();
    for (const row of due.results || []) {
      const age = scheduledMs - row.first_ms;
      let status;
      let sample = null;
      let observedAt = scheduledMs;
      if (age > RULES.horizonMaxMs) {
        status = { kind: "HORIZON_MISSED_CENSORED", pct: null };
      } else {
        try {
          sample = await readMint(row.mint, row.pair, fetchImpl);
          const observedMs = clock();
          if (!validClock(observedMs) || observedMs < scheduledMs) throw Error('PUBLIC_PROVIDER_REPLY_CLOCK_INVALID');
          observedAt = observedMs;
          status = gradeDue({
            firstMs: row.first_ms, nowMs: observedMs,
            firstUsd: row.initial_usd, latestUsd: sample.usd,
            pair: sample.switched ? "" : sample.pair, originalPair: row.pair,
          });
        } catch {
          status = { kind: "MISSING_PROVIDER_CENSORED", pct: null };
          quarantined++;
        }
      }
      if (status.kind === "OPEN") throw Error("PUBLIC_HORIZON_INVALID");
      await q(db,
        "INSERT OR IGNORE INTO outcomes(mint,at_ms,kind,return_pct) VALUES(?,?,?,?)",
        row.mint, observedAt, status.kind, status.pct).run();
      await q(db, "UPDATE watch SET state=?,last_check_ms=? WHERE mint=? AND state='OPEN'",
        status.kind === "PRICE_ONLY_UNVERIFIED" ? "PRICE_ONLY" : "CENSORED",
        scheduledMs, row.mint).run();
      if (sample && !sample.switched && status.kind === "PRICE_ONLY_UNVERIFIED") {
        await q(db,
          "INSERT OR IGNORE INTO observations(mint,observed_ms,pair,price_usd,liquidity_usd) VALUES(?,?,?,?,?)",
          row.mint, observedAt, sample.pair, sample.usd, sample.liquidity).run();
      }
      status.kind === "PRICE_ONLY_UNVERIFIED" ? followed++ : censored++;
    }
    const count = await q(db, "SELECT COUNT(*) AS n FROM watch WHERE state='OPEN'").first();
    if (Number.isSafeInteger(Number(count?.n)) && Number(count.n) < RULES.maxActiveWatches) {
      const candidates = await fetchDiscovery(fetchImpl);
      for (const mint of candidates) {
        if (Number(count.n) + newly >= RULES.maxActiveWatches) break;
        const exists = await q(db, "SELECT mint FROM watch WHERE mint=?", mint).first();
        if (exists) continue;
        try {
          const read = await readMint(mint, null, fetchImpl);
          const observedMs = clock(); // Actual reply-available time, NEVER scheduled start.
          if (!validClock(observedMs) || observedMs < scheduledMs) throw Error('PUBLIC_PROVIDER_REPLY_CLOCK_INVALID');
          if (read.switched) throw Error("PUBLIC_PAIR_SWITCHED");
          const ins = await q(db,
            "INSERT OR IGNORE INTO watch(mint,first_at,first_ms,pair,initial_usd,last_check_ms,last_usd,state,risk_flags) VALUES(?,?,?,?,?,?,?,'OPEN',?)",
            mint, iso(observedMs), observedMs, read.pair, read.usd,
            observedMs, read.usd, JSON.stringify(read.risk)).run();
          if (!changed(ins)) continue;
          await q(db,
            "INSERT OR IGNORE INTO observations(mint,observed_ms,pair,price_usd,liquidity_usd) VALUES(?,?,?,?,?)",
            mint, observedMs, read.pair, read.usd, read.liquidity).run();
          newly++;
          // An uncertain Telegram send still consumes the per-cycle budget.
          // Never count only acknowledged sends: doing so could send another
          // message after a network timeout or ambiguous ACK.
          if (alertAttempts < RULES.maxAlerts &&
              env.SHARK_CF_ALERTS === "true" &&
              env.SHARK_CF_OWNER_AUTHORIZED === "true") {
            alertAttempts++;
            if (await sendPrivateOnce(env, db, mint, read.risk,
              observedMs, fetchImpl)) alerts++;
          }
        } catch {
          quarantined++; // rejected candidate never becomes a safe-token verdict
        }
      }
    }
    await q(db,
      "UPDATE cycles SET status='DONE',new_count=?,follow_count=?,invalid_count=? WHERE scheduled_ms=?",
      newly, followed, quarantined + censored, scheduledMs).run();
    return { status: "PUBLIC_PARTIAL_RESEARCH_ONLY", newCount: newly,
      priceOnlyCount: followed, censoredCount: censored,
      quarantinedCount: quarantined, privateSendAcknowledged: alerts,
      independentProviderAttestation: false, calibratedAlpha: false,
      continuousLatencyVerified: false, telegramMessagesRead: false,
      canTrade: false, canSign: false, canBroadcast: false };
  } catch {
    await q(db, "UPDATE cycles SET status='ERROR' WHERE scheduled_ms=?", scheduledMs).run();
    throw Error("PUBLIC_CYCLE_FAILED_CLOSED");
  }
}
export default {
  // No HTTP control plane, unauthenticated status API, webhook or request handler.
  async fetch() { return new Response("Not Found", { status: 404 }); },
  async scheduled(event, env) {
    if (event.cron !== "*/5 * * * *") return;
    try {
      const result = await runCycle(env, event.scheduledTime);
      // Redacted status only: no mint, price, token, user ID or Telegram message.
      console.log(JSON.stringify({
        schema: "SHARK_CF_PUBLIC_V1", status: result.status,
        newCount: result.newCount || 0,
        priceOnlyCount: result.priceOnlyCount || 0,
        quarantinedCount: result.quarantinedCount || 0,
        canTrade: false,
      }));
    } catch {
      console.log("SHARK_CF_SCHEDULED_FAIL_CLOSED");
    }
  },
};
