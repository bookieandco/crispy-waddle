import fs from "node:fs/promises";

const url = process.env.JHADINA_SUPABASE_URL;
const key = process.env.JHADINA_SUPABASE_SECRET_KEY || process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
const mode = process.argv[2];
const resultPath = process.argv[3];

if (!url) throw new Error("JHADINA_SUPABASE_URL is required");
if (!key) throw new Error("JHADINA_SUPABASE_SECRET_KEY or JHADINA_SUPABASE_SERVICE_ROLE_KEY is required");
if (!["dispatched", "finalize"].includes(mode)) throw new Error("Usage: persist-jhadina-evolution-ledger.mjs <dispatched|finalize> [result.json]");

const baseUrl = url.replace(/\/$/, "");

async function request(path, options = {}) {
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase evolution ledger request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function append(result, type, payload) {
  return request("/rest/v1/rpc/append_jhadina_evolution_run_ledger", {
    method: "POST",
    body: JSON.stringify({
      p_run_id: result.runId,
      p_task_id: result.taskId,
      p_type: type,
      p_occurred_at: new Date().toISOString(),
      p_payload: payload,
    }),
  });
}

async function list(runId) {
  return request(`/rest/v1/jhadina_evolution_run_ledger?run_id=eq.${encodeURIComponent(String(runId))}&order=sequence.asc&select=*`);
}

async function verify(runId) {
  return request("/rest/v1/rpc/verify_jhadina_evolution_run_ledger", {
    method: "POST",
    body: JSON.stringify({ p_run_id: runId }),
  });
}

if (mode === "dispatched") {
  const runId = Number(process.env.GITHUB_RUN_ID);
  const taskId = process.env.TASK_ID;
  if (!Number.isInteger(runId) || !taskId) throw new Error("GITHUB_RUN_ID and TASK_ID are required");

  const result = { runId, taskId };
  const events = await list(runId);
  if (!events.some((event) => event.type === "RUN_DISPATCHED")) {
    await append(result, "RUN_DISPATCHED", {
      baseBranch: process.env.BASE_BRANCH,
      branch: process.env.BRANCH_NAME,
    });
  }
  const valid = await verify(runId);
  if (!valid) throw new Error(`Evolution ledger verification failed immediately after dispatch for run ${runId}`);
  console.log(`Evolution ledger: RUN_DISPATCHED recorded and verified for run ${runId}`);
} else {
  if (!resultPath) throw new Error("Result JSON path is required for finalize mode");
  const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
  if (result.version !== "1" || !Number.isInteger(result.runId) || typeof result.taskId !== "string") {
    throw new Error("Invalid Jhadina evolution result");
  }

  let events = await list(result.runId);
  if (!events.some((event) => event.type === "RUN_DISPATCHED")) {
    await append(result, "RUN_DISPATCHED", {
      baseBranch: result.baseBranch,
      branch: result.branch,
    });
  }

  events = await list(result.runId);
  const terminalType = result.status === "VERIFIED"
    ? "RUN_VERIFIED"
    : result.status === "BLOCKED"
      ? "RUN_BLOCKED"
      : "RUN_FAILED";

  if (!events.some((event) => ["RUN_VERIFIED", "RUN_FAILED", "RUN_BLOCKED"].includes(event.type))) {
    await append(result, terminalType, {
      changedFiles: result.changedFiles,
      diffStat: result.diffStat,
      verification: result.verification,
      draftPr: result.draftPr,
    });
  }

  events = await list(result.runId);
  if (result.draftPr && !events.some((event) => event.type === "DRAFT_PR_CREATED")) {
    await append(result, "DRAFT_PR_CREATED", { url: result.draftPr });
  }

  const valid = await verify(result.runId);
  if (!valid) throw new Error(`Evolution ledger verification failed for run ${result.runId}`);

  const finalEvents = await list(result.runId);
  console.log(`Evolution ledger verified for run ${result.runId}: ${finalEvents.map((event) => event.type).join(" -> ")}`);
}
