import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";
import { PostgresCommandCenterReadModel } from "./command-center-read-model.js";

const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;
const db = pool ? createPgSqlExecutor(pool) : undefined;
const orgId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

afterAll(async () => {
  if (db) await db.query("delete from staffing_jobs where organization_id=$1", [orgId]);
  if (pool) await pool.end();
});

describe("Staffing lifecycle schema convergence", () => {
  it.skipIf(!databaseUrl)("matches canonical states and commercial placement columns", async () => {
    if (!db) throw new Error("database missing");

    const constraints = await db.query<{ tableName: string; definition: string }>(
      `select c.relname as "tableName", pg_get_constraintdef(k.oid) as definition
         from pg_constraint k
         join pg_class c on c.oid=k.conrelid
        where k.conname in (
          'staffing_jobs_status_check',
          'staffing_applications_status_check',
          'staffing_placements_status_check',
          'staffing_timesheets_status_check'
        )
        order by c.relname`,
    );
    const byTable = Object.fromEntries(constraints.map((row) => [row.tableName, row.definition]));

    expect(byTable.staffing_jobs).toContain("PUBLISHED");
    expect(byTable.staffing_jobs).not.toContain("OPEN");
    expect(byTable.staffing_placements).toContain("COMPLETED");
    expect(byTable.staffing_placements).not.toContain("ENDED");
    expect(byTable.staffing_timesheets).toContain("BILLABLE");
    expect(byTable.staffing_timesheets).not.toContain("DISPUTED");
    expect(byTable.staffing_applications).toContain("PLACEMENT_READY");
    expect(byTable.staffing_applications).toContain("REFERRED");

    const columns = await db.query<{ columnName: string }>(
      `select column_name as "columnName"
         from information_schema.columns
        where table_schema='public'
          and table_name='staffing_placements'
          and column_name in (
            'candidate_id','contract_id','commercial_agreement_id',
            'split_basis_points','hourly_bill_rate','created_by'
          )
        order by column_name`,
    );
    expect(columns.map((row) => row.columnName)).toEqual([
      "candidate_id",
      "commercial_agreement_id",
      "contract_id",
      "created_by",
      "hourly_bill_rate",
      "split_basis_points",
    ]);

    const ownedTables = await db.query<{ contracts: boolean; agreements: boolean }>(
      `select
         to_regclass('public.staffing_agency_contracts') is not null contracts,
         to_regclass('public.staffing_commercial_agreements') is not null agreements`,
    );
    expect(ownedTables[0]).toEqual({ contracts: true, agreements: true });
  });

  it.skipIf(!databaseUrl)("counts PUBLISHED jobs as open in Command Center", async () => {
    if (!db) throw new Error("database missing");
    await db.query("delete from staffing_jobs where organization_id=$1", [orgId]);
    await db.query(
      `insert into staffing_jobs
        (id,organization_id,employer_id,title,description,location,pay_rate,currency,remote,status,created_at,updated_at)
       values
        ('lifecycle-open',$1,$1,'Open','Open','Remote',50,'USD',true,'PUBLISHED',now(),now()),
        ('lifecycle-draft',$1,$1,'Draft','Draft','Remote',50,'USD',true,'DRAFT',now(),now())`,
      [orgId],
    );
    const signals = await new PostgresCommandCenterReadModel(db).signals(orgId);
    expect(signals.find((signal) => signal.label === "Open Jobs")?.value).toBe(1);
  });
});
