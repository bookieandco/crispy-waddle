import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0";

const ALLOWED_ISSUERS = new Set([
  "https://oidc.vercel.com/bookieandcos-projects",
  "https://oidc.vercel.com",
]);
const AUDIENCE = "https://vercel.com/bookieandcos-projects";
const SUBJECT =
  "owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production";
const OWNER_ID = "team_NYQJ3NwijZZ6UJQdOdc5FjmX";
const PROJECT_ID = "prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco";
const PROJECT_NAME = "crispy-waddle-jhadina-web";
const OWNER = "bookieandcos-projects";

type JsonObject = Record<string, unknown>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function mustObject(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as JsonObject;
}

function mustString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function mustNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nextId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function authorizeVercel(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  let unverified: ReturnType<typeof decodeJwt>;
  try {
    unverified = decodeJwt(token);
  } catch {
    return false;
  }

  const issuer = typeof unverified.iss === "string" ? unverified.iss : "";
  if (!ALLOWED_ISSUERS.has(issuer)) return false;

  try {
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: AUDIENCE,
    });

    return (
      payload.sub === SUBJECT &&
      payload.owner === OWNER &&
      payload.owner_id === OWNER_ID &&
      payload.project === PROJECT_NAME &&
      payload.project_id === PROJECT_ID &&
      payload.environment === "production"
    );
  } catch {
    return false;
  }
}

function memoryFromRow(row: JsonObject): JsonObject {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    content: row.content,
    confidence: row.confidence,
    createdAt: row.created_at,
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    ...(row.rejected_at ? { rejectedAt: row.rejected_at } : {}),
    ...(row.reasoning_event_id ? { reasoningEventId: row.reasoning_event_id } : {}),
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
    ...(row.revocation_reason ? { revocationReason: row.revocation_reason } : {}),
    ...(row.supersedes_memory_id ? { supersedesMemoryId: row.supersedes_memory_id } : {}),
  };
}

function candidateFromRow(row: JsonObject): JsonObject {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    reasoningEventId: row.reasoning_event_id,
  };
}

function reasoningFromRow(row: JsonObject): JsonObject {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.occurred_at,
    userMessage: row.user_message,
    observation: row.observation,
    classification: row.classification,
    systemResponse: row.system_response,
    confidence: row.confidence,
    ...(row.candidate_id ? { candidateId: row.candidate_id } : {}),
    actor: row.actor,
    ...(row.outcome ? { outcome: row.outcome } : {}),
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.causation_id ? { causationId: row.causation_id } : {}),
    metadata: row.metadata ?? {},
  };
}

function timelineFromRow(row: JsonObject): JsonObject {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.occurred_at,
    type: row.type,
    ...(row.reasoning_event_id ? { reasoningEventId: row.reasoning_event_id } : {}),
    ...(row.memory_id ? { memoryId: row.memory_id } : {}),
    ...(row.memory_type ? { memoryType: row.memory_type } : {}),
    ...(row.memory_content ? { memoryContent: row.memory_content } : {}),
    ...(row.decision ? { decision: row.decision } : {}),
  };
}

function fail(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`storage:${context}:${error.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!(await authorizeVercel(req))) return json(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(503, { error: "supabase_admin_unavailable" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = mustObject(await req.json(), "body");
    const action = mustString(body.action, "action");
    const payload = body.payload && typeof body.payload === "object"
      ? (body.payload as JsonObject)
      : {};

    switch (action) {
      case "probe": {
        const { error } = await supabase
          .from("jhadina_memories")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        fail(error, action);
        return json(200, { data: { ok: true } });
      }

      case "createMemory": {
        const data = mustObject(payload.data, "data");
        const row = {
          id: nextId("mem"),
          user_id: mustString(data.userId, "data.userId"),
          type: mustString(data.type, "data.type"),
          status: mustString(data.status, "data.status"),
          content: mustString(data.content, "data.content"),
          confidence: mustNumber(data.confidence, "data.confidence"),
          created_at: mustString(data.createdAt, "data.createdAt"),
          approved_at: optionalString(data.approvedAt),
          rejected_at: optionalString(data.rejectedAt),
          reasoning_event_id: optionalString(data.reasoningEventId),
          revoked_at: optionalString(data.revokedAt),
          revocation_reason: optionalString(data.revocationReason),
          supersedes_memory_id: optionalString(data.supersedesMemoryId),
        };
        const { error } = await supabase.from("jhadina_memories").insert(row);
        fail(error, action);
        return json(200, { data: memoryFromRow(row) });
      }

      case "getMemory": {
        const id = mustString(payload.id, "id");
        const { data, error } = await supabase
          .from("jhadina_memories")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        fail(error, action);
        return json(200, { data: data ? memoryFromRow(data as JsonObject) : null });
      }

      case "listMemories": {
        const userId = mustString(payload.userId, "userId");
        const { data, error } = await supabase
          .from("jhadina_memories")
          .select("*")
          .eq("user_id", userId);
        fail(error, action);
        return json(200, { data: (data ?? []).map((row) => memoryFromRow(row as JsonObject)) });
      }

      case "retireMemory": {
        const { data, error } = await supabase.rpc("jhadina_retire_memory", {
          p_memory_id: mustString(payload.id, "id"),
          p_user_id: mustString(payload.userId, "userId"),
          p_reason: mustString(payload.reason, "reason"),
          p_revoked_at: mustString(payload.revokedAt, "revokedAt"),
        });
        fail(error, action);
        const row = Array.isArray(data) ? data[0] : data;
        return json(200, { data: row ? memoryFromRow(row as JsonObject) : null });
      }

      case "correctMemory": {
        const params = mustObject(payload.params, "params");
        const newMemoryId = nextId("mem");
        const { data, error } = await supabase.rpc("jhadina_correct_memory", {
          p_memory_id: mustString(params.memoryId, "params.memoryId"),
          p_user_id: mustString(params.userId, "params.userId"),
          p_new_memory_id: newMemoryId,
          p_content: mustString(params.content, "params.content"),
          p_confidence: mustNumber(params.confidence, "params.confidence"),
          p_reasoning_event_id: mustString(params.reasoningEventId, "params.reasoningEventId"),
          p_corrected_at: mustString(params.correctedAt, "params.correctedAt"),
        });
        fail(error, action);
        const row = (Array.isArray(data) ? data[0] : data) as
          | { retired?: JsonObject; replacement?: JsonObject }
          | null;
        if (!row?.retired || !row.replacement) throw new Error("storage:correctMemory:invalid result");
        return json(200, {
          data: {
            retired: memoryFromRow(row.retired),
            replacement: memoryFromRow(row.replacement),
          },
        });
      }

      case "createCandidate": {
        const data = mustObject(payload.data, "data");
        const row = {
          id: nextId("cand"),
          user_id: mustString(data.userId, "data.userId"),
          type: mustString(data.type, "data.type"),
          status: "PENDING",
          content: mustString(data.content, "data.content"),
          confidence: mustNumber(data.confidence, "data.confidence"),
          reasoning_event_id: mustString(data.reasoningEventId, "data.reasoningEventId"),
          created_at: mustString(data.createdAt, "data.createdAt"),
        };
        const { error } = await supabase.from("jhadina_memory_candidates").insert(row);
        fail(error, action);
        return json(200, { data: candidateFromRow(row) });
      }

      case "getCandidate": {
        const id = mustString(payload.id, "id");
        const { data, error } = await supabase
          .from("jhadina_memory_candidates")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        fail(error, action);
        return json(200, { data: data ? candidateFromRow(data as JsonObject) : null });
      }

      case "listCandidates": {
        const userId = mustString(payload.userId, "userId");
        let query = supabase.from("jhadina_memory_candidates").select("*").eq("user_id", userId);
        if (payload.status === "PENDING") query = query.eq("status", "PENDING");
        const { data, error } = await query;
        fail(error, action);
        return json(200, { data: (data ?? []).map((row) => candidateFromRow(row as JsonObject)) });
      }

      case "removeCandidate": {
        const id = mustString(payload.id, "id");
        const { error } = await supabase.from("jhadina_memory_candidates").delete().eq("id", id);
        fail(error, action);
        return json(200, { data: null });
      }

      case "createReasoningEvent": {
        const data = mustObject(payload.data, "data");
        const row = {
          id: optionalString(data.id) ?? nextId("reason"),
          user_id: mustString(data.userId, "data.userId"),
          occurred_at: mustString(data.timestamp, "data.timestamp"),
          user_message: mustString(data.userMessage, "data.userMessage"),
          observation: mustObject(data.observation, "data.observation"),
          classification: mustObject(data.classification, "data.classification"),
          system_response: mustString(data.systemResponse, "data.systemResponse"),
          confidence: mustNumber(data.confidence, "data.confidence"),
          candidate_id: optionalString(data.candidateId),
          actor: optionalString(data.actor) ?? "user",
          outcome: optionalString(data.outcome),
          correlation_id: optionalString(data.correlationId),
          causation_id: optionalString(data.causationId),
          metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
        };
        const { error } = await supabase.from("jhadina_reasoning_events").insert(row);
        fail(error, action);
        return json(200, { data: reasoningFromRow(row) });
      }

      case "getReasoningEvent": {
        const id = mustString(payload.id, "id");
        const { data, error } = await supabase
          .from("jhadina_reasoning_events")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        fail(error, action);
        return json(200, { data: data ? reasoningFromRow(data as JsonObject) : null });
      }

      case "updateReasoningEvent": {
        const id = mustString(payload.id, "id");
        const userId = mustString(payload.userId, "userId");
        const updates = mustObject(payload.updates, "updates");
        const patch: JsonObject = {};
        if (updates.classification !== undefined) patch.classification = updates.classification;
        if (updates.systemResponse !== undefined) patch.system_response = updates.systemResponse;
        if (updates.confidence !== undefined) patch.confidence = updates.confidence;
        if (updates.candidateId !== undefined) patch.candidate_id = updates.candidateId;
        if (updates.actor !== undefined) patch.actor = updates.actor;
        if (updates.outcome !== undefined) patch.outcome = updates.outcome;
        if (updates.correlationId !== undefined) patch.correlation_id = updates.correlationId;
        if (updates.causationId !== undefined) patch.causation_id = updates.causationId;
        if (updates.metadata !== undefined) patch.metadata = updates.metadata;

        const { data, error } = await supabase
          .from("jhadina_reasoning_events")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();
        fail(error, action);
        return json(200, { data: data ? reasoningFromRow(data as JsonObject) : null });
      }

      case "listReasoningEvents": {
        const userId = mustString(payload.userId, "userId");
        const limit = typeof payload.limit === "number" ? Math.max(1, Math.min(200, payload.limit)) : 50;
        const { data, error } = await supabase
          .from("jhadina_reasoning_events")
          .select("*")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(limit);
        fail(error, action);
        return json(200, { data: (data ?? []).map((row) => reasoningFromRow(row as JsonObject)) });
      }

      case "appendTimelineEvent": {
        const data = mustObject(payload.data, "data");
        const row = {
          id: nextId("timeline"),
          user_id: mustString(data.userId, "data.userId"),
          occurred_at: mustString(data.timestamp, "data.timestamp"),
          type: mustString(data.type, "data.type"),
          reasoning_event_id: optionalString(data.reasoningEventId),
          memory_id: optionalString(data.memoryId),
          memory_type: optionalString(data.memoryType),
          memory_content: optionalString(data.memoryContent),
          decision: optionalString(data.decision),
        };
        const { error } = await supabase.from("jhadina_timeline_events").insert(row);
        fail(error, action);
        return json(200, { data: timelineFromRow(row) });
      }

      case "listTimeline": {
        const userId = mustString(payload.userId, "userId");
        const limit = typeof payload.limit === "number" ? Math.max(1, Math.min(200, payload.limit)) : 50;
        const { data, error } = await supabase
          .from("jhadina_timeline_events")
          .select("*")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(limit);
        fail(error, action);
        return json(200, { data: (data ?? []).map((row) => timelineFromRow(row as JsonObject)) });
      }

      default:
        return json(400, { error: "unsupported_action" });
    }
  } catch (error) {
    console.error("jhadina-memory-gateway", error instanceof Error ? error.message : String(error));
    return json(500, { error: "storage_operation_failed" });
  }
});
