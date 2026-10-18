/*
 * D1 implementation of the EXISTING Jhadina MemoryStorage gateway actions.
 * SQL statements have bound parameters. This worker must never accept browser
 * credentials or Facebook archive bytes. Caller identity is separately
 * authenticated through Vercel OIDC in worker.mjs; the Jhadina server verifies
 * individual owners before requesting scoped operations.
 */
const TABLE = "jhadina_memory_records";
const KINDS = Object.freeze({ memory: "memory", candidate: "candidate", reasoning: "reasoning", timeline: "timeline" });
const MAX_ROWS = 2500;
const MAX_RECORD_CHARS = 16000;

function requireString(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error("INVALID_" + name);
  }
  return value;
}
function requireOwner(value) { return requireString(value, "OWNER", 160); }
function newId(prefix) { return prefix + "_" + crypto.randomUUID(); }
function validRecord(value, kind) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_RECORD");
  const item = { ...value };
  requireOwner(item.userId);
  if (kind !== "timeline") requireString(item.content ?? item.userMessage ?? item.type, "CONTENT", MAX_RECORD_CHARS);
  const serialized = JSON.stringify(item);
  if (!serialized || serialized.length > 26000) throw new Error("RECORD_TOO_LARGE");
  return item;
}
function decode(row) { return row ? JSON.parse(row.payload) : undefined; }
async function lookup(db, kind, id) {
  requireString(id, "ID", 160);
  const row = await db.prepare("SELECT payload FROM " + TABLE + " WHERE kind=? AND id=?")
    .bind(kind, id).first();
  return decode(row);
}
async function scoped(db, kind, userId, limit = MAX_ROWS) {
  requireOwner(userId);
  const cap = Number.isSafeInteger(limit) ? Math.max(1, Math.min(MAX_ROWS, limit)) : 50;
  const rows = await db.prepare("SELECT payload FROM " + TABLE +
    " WHERE kind=? AND owner_id=? ORDER BY sort_at DESC,id DESC LIMIT ?")
    .bind(kind, userId, cap).all();
  return (rows.results ?? []).map(decode);
}
async function insert(db, kind, item, at) {
  const record = validRecord(item, kind);
  const data = JSON.stringify(record);
  const status = kind === "timeline" || kind === "reasoning"
    ? "EVENT" : record.status;
  const result = await db.prepare("INSERT INTO " + TABLE +
    " (id,owner_id,kind,status,sort_at,payload) VALUES (?,?,?,?,?,?)")
    .bind(record.id, record.userId, kind, status, at, data).run();
  if (result.meta?.changes !== 1) throw new Error("STORAGE_INSERT_REJECTED");
  return record;
}
async function updateOwned(db, kind, current, replacement) {
  const record = validRecord(replacement, kind);
  if (record.id !== current.id || record.userId !== current.userId) throw new Error("CROSS_OWNER_MUTATION");
  const result = await db.prepare("UPDATE " + TABLE + " SET status=?,payload=? " +
    "WHERE id=? AND kind=? AND owner_id=? AND status=?")
    .bind(kind === "memory" || kind === "candidate" ? record.status : "EVENT",
      JSON.stringify(record), record.id, kind, record.userId,
      kind === "memory" || kind === "candidate" ? current.status : "EVENT").run();
  if (result.meta?.changes !== 1) throw new Error("STALE_MEMORY_WRITE");
  return record;
}
function approvedMemory(record) {
  return record && record.status === "APPROVED" && record.type &&
    ["PREFERENCE","IDENTITY","GOAL","CONTEXT"].includes(record.type);
}
function assertStatus(value, allowed) { if (!allowed.includes(value)) throw new Error("INVALID_STATUS"); }
function sourceOwner(item, userId) { if (!item || item.userId !== userId) throw new Error("OWNER_OR_RECORD_MISMATCH"); }

export async function runMemoryAction(db, action, payload = {}) {
  if (!db || typeof db.prepare !== "function") throw new Error("D1_DATABASE_REQUIRED");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("INVALID_PAYLOAD");
  switch (action) {
    case "probe": {
      await db.prepare("SELECT id FROM " + TABLE + " LIMIT 1").first();
      return { ok: true, storage: "cloudflare-d1" };
    }
    case "getMemory": return await lookup(db, KINDS.memory, payload.id) ?? null;
    case "getCandidate": return await lookup(db, KINDS.candidate, payload.id) ?? null;
    case "getReasoningEvent": return await lookup(db, KINDS.reasoning, payload.id) ?? null;
    case "listMemories": return scoped(db, KINDS.memory, payload.userId);
    case "listCandidates": {
      const rows = await scoped(db, KINDS.candidate, payload.userId);
      if (payload.status && payload.status !== "PENDING") throw new Error("INVALID_CANDIDATE_STATUS");
      return rows.filter((r) => r.status === "PENDING");
    }
    case "listReasoningEvents": return scoped(db, KINDS.reasoning, payload.userId, payload.limit ?? 50);
    case "listTimeline": return scoped(db, KINDS.timeline, payload.userId, payload.limit ?? 50);
    case "createReasoningEvent": {
      const record = validRecord(payload.data, KINDS.reasoning);
      const output = { ...record, id: record.id ?? newId("reason") };
      requireString(output.timestamp, "TIMESTAMP", 80);
      return insert(db, KINDS.reasoning, output, output.timestamp);
    }
    case "createCandidate": {
      const record = validRecord(payload.data, KINDS.candidate);
      assertStatus(record.status, ["PENDING"]);
      requireString(record.reasoningEventId, "REASONING_ID", 160);
      const reasoning = await lookup(db, KINDS.reasoning, record.reasoningEventId);
      sourceOwner(reasoning, record.userId);
      const output = { ...record, id: newId("cand") };
      return insert(db, KINDS.candidate, output, output.createdAt);
    }
    case "createMemory": {
      const record = validRecord(payload.data, KINDS.memory);
      assertStatus(record.status, ["APPROVED"]);
      const related = await scoped(db, KINDS.candidate, record.userId);
      if (!related.some((item) => item.reasoningEventId === record.reasoningEventId &&
          item.content === record.content && item.status === "PENDING")) {
        throw new Error("UNAPPROVED_MEMORY_CANDIDATE");
      }
      const output = { ...record, id: newId("mem") };
      return insert(db, KINDS.memory, output, output.approvedAt ?? output.createdAt);
    }
    case "removeCandidate": {
      const id = requireString(payload.id, "ID", 160);
      // Caller-only ID operation intentionally kept protocol compatible:
      // it is reachable only behind verified Vercel workload identity.
      await db.prepare("DELETE FROM " + TABLE + " WHERE id=? AND kind='candidate'").bind(id).run();
      return null;
    }
    case "retireMemory": {
      const { id, userId, reason, revokedAt } = payload;
      requireOwner(userId);
      requireString(revokedAt, "TIMESTAMP", 80);
      assertStatus(reason, ["corrected", "forgotten", "retired"]);
      const original = await lookup(db, KINDS.memory, id);
      if (!original || original.userId !== userId || original.status !== "APPROVED") return null;
      return updateOwned(db, KINDS.memory, original, {
        ...original, status: "RETIRED", revokedAt, revocationReason: reason,
      });
    }
    case "correctMemory": {
      const params = payload.params;
      if (!params || typeof params !== "object") throw new Error("INVALID_CORRECTION");
      requireOwner(params.userId);
      requireString(params.content, "CONTENT", MAX_RECORD_CHARS);
      const old = await lookup(db, KINDS.memory, params.memoryId);
      if (!approvedMemory(old) || old.userId !== params.userId) throw new Error("INVALID_CORRECTION_TARGET");
      const reasoning = await lookup(db, KINDS.reasoning, params.reasoningEventId);
      sourceOwner(reasoning, params.userId);
      const retired = { ...old, status: "RETIRED", revokedAt: params.correctedAt, revocationReason: "corrected" };
      const replacement = {
        ...old, id: newId("mem"), status: "APPROVED", content: params.content,
        confidence: params.confidence, createdAt: params.correctedAt,
        approvedAt: params.correctedAt, revokedAt: undefined, revocationReason: undefined,
        supersedesMemoryId: old.id, reasoningEventId: params.reasoningEventId,
      };
      validRecord(replacement, KINDS.memory);
      // Atomic D1 batch. UPDATE and INSERT share the same D1 transaction.
      // The INSERT is conditional on the old memory still being APPROVED;
      // a racing correction cannot create an unlinked replacement.
      const result = await db.batch([
        db.prepare("INSERT INTO " + TABLE +
          " (id,owner_id,kind,status,sort_at,payload) SELECT ?,owner_id,'memory','APPROVED',?,?" +
          " FROM " + TABLE + " WHERE id=? AND owner_id=? AND kind='memory' AND status='APPROVED'")
          .bind(replacement.id, params.correctedAt, JSON.stringify(replacement), old.id, params.userId),
        db.prepare("UPDATE " + TABLE + " SET status='RETIRED',payload=? " +
          "WHERE id=? AND kind='memory' AND owner_id=? AND status='APPROVED'")
          .bind(JSON.stringify(retired), old.id, params.userId),
      ]);
      if (result.some((part) => part.meta?.changes !== 1)) throw new Error("STALE_CORRECTION");
      return { retired, replacement };
    }
    case "updateReasoningEvent": {
      const { id, userId, updates } = payload;
      requireOwner(userId);
      if (!updates || typeof updates !== "object" || Array.isArray(updates)) throw new Error("INVALID_UPDATES");
      const old = await lookup(db, KINDS.reasoning, id);
      if (!old || old.userId !== userId) return null;
      const allowed = ["classification","systemResponse","confidence","candidateId",
        "actor","outcome","correlationId","causationId","metadata"];
      const delta = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
      return updateOwned(db, KINDS.reasoning, old, { ...old, ...delta });
    }
    case "appendTimelineEvent": {
      const record = validRecord(payload.data, KINDS.timeline);
      const output = { ...record, id: newId("timeline") };
      requireString(output.timestamp, "TIMESTAMP", 80);
      return insert(db, KINDS.timeline, output, output.timestamp);
    }
    default: throw new Error("ACTION_NOT_SUPPORTED");
  }
}
