import { NextResponse } from "next/server";
import { TransactionalJobService } from "../../../../../packages/staffing-core/src/transactional-job-service.js";
import { PostgresJobStore } from "../../../../../packages/staffing-core/src/postgres-adapters.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../lib/request-context.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const context = await requireStaffingContext(request, body.organizationId);

    const store = new PostgresJobStore(context.db);
    const service = new TransactionalJobService(
      store,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );

    const job = await service.create({
      organizationId: context.organizationId,
      employerId: context.userId,
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      location: String(body.location ?? ""),
      payRate: Number(body.payRate),
      currency: String(body.currency ?? "USD"),
      remote: Boolean(body.remote),
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to create job", 400);
  }
}
