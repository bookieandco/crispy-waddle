import { NextResponse } from "next/server";
import type { SqlExecutor } from "../../../packages/staffing-core/src/postgres-adapters.js";
import { createSqlExecutor } from "./postgres.js";

export interface StaffingSession {
  userId: string;
}

export type StaffingSessionResolver = (request: Request) => Promise<StaffingSession | null>;

type StaffingSqlClient = Parameters<typeof createSqlExecutor>[0];

interface StaffingRuntimeGlobals {
  STAFFING_SQL?: StaffingSqlClient;
  STAFFING_SESSION?: StaffingSessionResolver;
}

export class StaffingAccessError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 503) {
    super(message);
    this.name = "StaffingAccessError";
  }
}

export interface StaffingRequestContext {
  db: SqlExecutor;
  organizationId: string;
  userId: string;
  role: string;
}

function runtimeGlobals(): StaffingRuntimeGlobals {
  return globalThis as typeof globalThis & StaffingRuntimeGlobals;
}

export function organizationSelector(request: Request, explicit?: unknown): string | null {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const header = request.headers.get("x-organization-id");
  return header?.trim() || null;
}

export function assertSessionActor(provided: unknown, userId: string, fieldName = "actorId"): void {
  if (provided == null || provided === "") return;
  if (String(provided) !== userId) {
    throw new StaffingAccessError(`${fieldName} does not match the authenticated session`, 403);
  }
}

export async function requireStaffingContext(
  request: Request,
  selectedOrganizationId?: unknown,
): Promise<StaffingRequestContext> {
  const runtime = runtimeGlobals();
  if (!runtime.STAFFING_SESSION) {
    throw new StaffingAccessError("Staffing session resolver is not configured", 503);
  }

  const session = await runtime.STAFFING_SESSION(request);
  const userId = session?.userId?.trim();
  if (!userId) throw new StaffingAccessError("Authentication required", 401);

  const organizationId = organizationSelector(request, selectedOrganizationId);
  if (!organizationId) {
    throw new StaffingAccessError("Organization selection is required", 400);
  }

  if (!runtime.STAFFING_SQL) {
    throw new StaffingAccessError("Staffing database adapter is not configured", 503);
  }
  const db = createSqlExecutor(runtime.STAFFING_SQL);

  const memberships = await db.query<{ role: string }>(
    `select role
       from staffing_memberships
      where organization_id=$1
        and user_id=$2
        and status='ACTIVE'
        and revoked_at is null
      limit 1`,
    [organizationId, userId],
  );
  const membership = memberships[0];
  if (!membership) {
    throw new StaffingAccessError("Authenticated user is not an active member of this organization", 403);
  }

  return { db, organizationId, userId, role: membership.role };
}

export function staffingErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof StaffingAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
