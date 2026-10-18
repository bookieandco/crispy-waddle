import { verifyVercelWorkload } from "./security.mjs";
import { runMemoryAction } from "./repository.mjs";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

/**
 * Private Vercel-server-to-Worker protocol, NOT a public user-memory API.
 * Reuses exactly the JSON wire contract of VercelOidcMemoryStorage.
 * No browser-origin CORS, querystring writes or public GET health endpoint.
 */
export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/memory") {
      return reply({ error: "Not found" }, 404);
    }
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return reply({ error: "JSON required" }, 415);
    }
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length > 30000) return reply({ error: "Too large" }, 413);
    if (!env.DB) return reply({ error: "Memory gateway not commissioned" }, 503);
    try {
      await verifyVercelWorkload(request.headers.get("authorization"), env);
    } catch {
      return reply({ error: "Unauthorized workload" }, 401);
    }
    try {
      const source = await request.text();
      if (source.length > 30000) return reply({ error: "Too large" }, 413);
      const body = JSON.parse(source);
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          typeof body.action !== "string" || body.action.length > 40) {
        return reply({ error: "Invalid request" }, 400);
      }
      const data = await runMemoryAction(env.DB, body.action, body.payload ?? {});
      return reply({ data: data ?? null });
    } catch {
      // No private content, tokens, personal identifiers or SQL error payloads
      // should reach clients or logs. Operators can inspect bounded counters.
      return reply({ error: "Memory operation unavailable" }, 503);
    }
  },
};
