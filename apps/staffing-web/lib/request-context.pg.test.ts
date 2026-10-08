import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createPgSqlExecutor } from "../../../packages/staffing-core/src/postgres-pg-test-adapter.js";
import {
  requireActiveOrganizationUsers,
  requireStaffingContext,
  type StaffingSessionResolver,
} from "./request-context.js";

const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;
const root = pool ? createPgSqlExecutor(pool) : undefined;

type Runtime = typeof globalThis & {
  STAFFING_SQL?: {
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
    transaction<T>(work: (tx: any) => Promise<T>): Promise<T>;
  };
  STAFFING_SESSION?: StaffingSessionResolver;
};
const runtime = globalThis as Runtime;

const orgA = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const orgB = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const userId = "session-user-a";

beforeAll(async () => {
  if (!root) return;
  await root.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='staffing_web_test') then
      create role staffing_web_test nologin;
    end if;
  end $$`);
  await root.query("grant usage on schema public to staffing_web_test");
  await root.query("grant select on staffing_memberships, staffing_jobs to staffing_web_test");
  await root.query("delete from staffing_jobs where organization_id in ($1,$2)", [orgA, orgB]);
  await root.query("delete from staffing_memberships where organization_id in ($1,$2)", [orgA, orgB]);
  await root.query("delete from staffing_organizations where id in ($1,$2)", [orgA, orgB]);
  await root.query(
    "insert into staffing_organizations(id,legal_name,display_name) values ($1,'Session A','Session A'),($2,'Session B','Session B')",
    [orgA, orgB],
  );
  await root.query(
    "insert into staffing_memberships(id,organization_id,user_id,role) values ('session-membership-a',$1,$2,'EMPLOYER')",
    [orgA, userId],
  );
  await root.query(
    `insert into staffing_jobs
      (id,organization_id,employer_id,title,description,location,pay_rate,currency,remote,status,created_at,updated_at)
     values
      ('session-job-a',$1,$1,'Allowed','Allowed','Remote',50,'USD',true,'PUBLISHED',now(),now()),
      ('session-job-b',$2,$2,'Foreign','Foreign','Remote',50,'USD',true,'PUBLISHED',now(),now())`,
    [orgA, orgB],
  );
}, 30000);

afterEach(() => {
  delete runtime.STAFFING_SQL;
  delete runtime.STAFFING_SESSION;
});

afterAll(async () => {
  if (root) {
    await root.query("delete from staffing_jobs where organization_id in ($1,$2)", [orgA, orgB]);
    await root.query("delete from staffing_memberships where organization_id in ($1,$2)", [orgA, orgB]);
    await root.query("delete from staffing_organizations where id in ($1,$2)", [orgA, orgB]);
  }
  if (pool) await pool.end();
});

describe("Staffing HTTP session and PostgreSQL RLS convergence", () => {
  it.skipIf(!databaseUrl)("binds the authenticated session into the same RLS identity used by Postgres", async () => {
    if (!root) throw new Error("database missing");
    const rlsClient = {
      query<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
        return root.transaction(async (tx) => {
          await tx.query("set local role staffing_web_test");
          return tx.query<T>(sql, params);
        });
      },
      transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
        return root.transaction(async (tx) => {
          await tx.query("set local role staffing_web_test");
          return work(tx);
        });
      },
    };

    runtime.STAFFING_SQL = rlsClient;
    runtime.STAFFING_SESSION = async () => ({ userId });

    const context = await requireStaffingContext(
      new Request("https://staffing.test/api/command-center?organizationId=" + orgA),
      orgA,
    );
    expect(context.role).toBe("EMPLOYER");

    const visible = await context.db.query<{ id: string }>(
      "select id from staffing_jobs order by id",
    );
    expect(visible.map((row) => row.id)).toEqual(["session-job-a"]);

    await requireActiveOrganizationUsers(context.db, orgA, [userId]);
    await expect(
      requireStaffingContext(new Request("https://staffing.test/api/command-center"), orgB),
    ).rejects.toMatchObject({ status: 403 });
  }, 30000);
});
