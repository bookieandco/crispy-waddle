import { afterEach, describe, expect, it } from "vitest";
import {
  assertSessionActor,
  requireStaffingContext,
  StaffingAccessError,
  type StaffingSessionResolver,
} from "./request-context.js";

type Runtime = typeof globalThis & {
  STAFFING_SQL?: {
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
    transaction<T>(work: (tx: any) => Promise<T>): Promise<T>;
  };
  STAFFING_SESSION?: StaffingSessionResolver;
};

const runtime = globalThis as Runtime;

function sqlWithMembership(expectedUser = "user-1", expectedOrg = "org-1") {
  return {
    async query<T = unknown>(_sql: string, params: readonly unknown[] = []): Promise<T[]> {
      return params[0] === expectedOrg && params[1] === expectedUser
        ? ([{ role: "EMPLOYER" }] as T[])
        : [];
    },
    async transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
      return work(this);
    },
  };
}

afterEach(() => {
  delete runtime.STAFFING_SQL;
  delete runtime.STAFFING_SESSION;
});

describe("Staffing authenticated request context", () => {
  it("fails closed when no session resolver is commissioned", async () => {
    runtime.STAFFING_SQL = sqlWithMembership();
    await expect(
      requireStaffingContext(new Request("https://staffing.test/api/jobs"), "org-1"),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("rejects unauthenticated requests", async () => {
    runtime.STAFFING_SQL = sqlWithMembership();
    async function resolveUnauthenticatedSession() { return null; }
    runtime.STAFFING_SESSION = resolveUnauthenticatedSession;
    await expect(
      requireStaffingContext(new Request("https://staffing.test/api/jobs"), "org-1"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("treats organization input only as a selector and verifies membership", async () => {
    runtime.STAFFING_SQL = sqlWithMembership("user-1", "org-1");
    runtime.STAFFING_SESSION = async () => ({ userId: "user-1" });

    const allowed = await requireStaffingContext(
      new Request("https://staffing.test/api/jobs", { headers: { "x-organization-id": "org-1" } }),
    );
    expect(allowed.organizationId).toBe("org-1");
    expect(allowed.userId).toBe("user-1");

    await expect(
      requireStaffingContext(
        new Request("https://staffing.test/api/jobs", { headers: { "x-organization-id": "org-2" } }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects caller-supplied actor spoofing", () => {
    expect(() => assertSessionActor("attacker", "user-1", "reviewerId"))
      .toThrow(StaffingAccessError);
    expect(() => assertSessionActor("user-1", "user-1", "reviewerId")).not.toThrow();
  });
});
