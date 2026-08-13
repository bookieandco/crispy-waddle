import { NextResponse } from "next/server";
import { TransactionalJobService } from "../../../../../packages/staffing-core/src/transactional-job-service.js";
import { PostgresJobStore } from "../../../../../packages/staffing-core/src/postgres-adapters.js";
import { createSqlExecutor } from "../../../lib/postgres.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organizationId = request.headers.get("x-organization-id");
    const actorId = request.headers.get("x-actor-id");
    if (!organizationId || !actorId) return NextResponse.json({ error: "Missing organization context" }, { status: 401 });

    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });

    const store = new PostgresJobStore(createSqlExecutor(client));
    const service = new TransactionalJobService(
      store,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );

    const job = await service.create({
      organizationId,
      employerId: actorId,
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      location: String(body.location ?? ""),
      payRate: Number(body.payRate),
      currency: String(body.currency ?? "USD"),
      remote: Boolean(body.remote),
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create job";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
