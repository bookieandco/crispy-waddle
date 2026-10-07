import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";

const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 20 }) : undefined;
const db = pool ? createPgSqlExecutor(pool) : undefined;

async function applyCanonicalSchema() {
  if (!pool || !db) return;
  await db.query("drop schema public cascade; create schema public");
  const migrationDir = path.join(process.cwd(), "packages/staffing-core/migrations");
  const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await db.query(await readFile(path.join(migrationDir, migration), "utf8"));
  }

  const schema = await db.query<{ provider: boolean; pipeline_rls: boolean; legacy_invoices: boolean }>(
    `select
       exists(select 1 from information_schema.columns where table_schema='public' and table_name='staffing_payments' and column_name='provider') provider,
       (select relrowsecurity from pg_class where oid='public.staffing_candidate_pipeline'::regclass) pipeline_rls,
       to_regclass('public.invoices') is not null legacy_invoices`,
  );
  expect(schema[0]).toEqual({ provider: true, pipeline_rls: true, legacy_invoices: false });

  await db.query(`insert into staffing_organizations(id,legal_name,display_name) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Org A','Org A'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Org B','Org B')`);
  await db.query(`insert into staffing_memberships(id,organization_id,user_id,role)
    values ('membership-a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','user-a','OWNER')`);
  await db.query(`insert into staffing_jobs
    (id,organization_id,employer_id,title,description,location,pay_rate,currency,remote,status,created_at,updated_at) values
    ('rls-a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','A','A','Remote',50,'USD',true,'PUBLISHED',now(),now()),
    ('rls-b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B','B','Remote',50,'USD',true,'PUBLISHED',now(),now())`);

  const client = await pool.connect();
  try {
    await client.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='staffing_rls_test') then
        create role staffing_rls_test nologin;
      end if;
    end $$`);
    await client.query("grant usage on schema public to staffing_rls_test");
    await client.query("grant select on staffing_jobs to staffing_rls_test");
    await client.query("set role staffing_rls_test");
    await client.query("select set_config('app.user_id','user-a',false)");
    const visible = await client.query<{ count: number }>("select count(*)::int count from staffing_jobs");
    const foreign = await client.query<{ count: number }>(
      "select count(*)::int count from staffing_jobs where organization_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
    );
    expect(visible.rows[0].count).toBe(1);
    expect(foreign.rows[0].count).toBe(0);
    await client.query("reset role");
  } finally {
    client.release();
  }
}

async function seedInvoice(invoiceId:string, organizationId:string, employerId:string) {
  if (!db) return;
  const workerId="00000000-0000-0000-0000-000000000099";
  const jobId=`job:${invoiceId}`, applicationId=`application:${invoiceId}`;
  const placementId=`placement:${invoiceId}`, timesheetId=`timesheet:${invoiceId}`;
  await db.query(`insert into staffing_marketplace_jobs
    (id,organization_id,employer_id,title,description,location,pay_rate,currency,remote,status,created_at,updated_at,source_event_id,marketplace_published_at)
    values ($1,$2,$3,'Test','Test','Remote',50,'USD',true,'PUBLISHED',now(),now(),$4,now())`,
    [jobId,organizationId,employerId,`source:${invoiceId}`]);
  await db.query(`insert into staffing_applications
    (id,organization_id,job_id,worker_id,status,cover_note,created_at,updated_at)
    values ($1,$2,$3,$4,'ADVANCING','',now(),now())`,[applicationId,organizationId,jobId,workerId]);
  await db.query(`insert into staffing_placements
    (id,organization_id,application_id,job_id,worker_id,employer_id,agency_id,status,start_date,end_date,pay_rate,currency,created_at,updated_at)
    values ($1,$2,$3,$4,$5,$6,null,'PENDING','2026-10-01',null,50,'USD',now(),now())`,
    [placementId,organizationId,applicationId,jobId,workerId,employerId]);
  await db.query(`insert into staffing_timesheets
    (id,organization_id,placement_id,worker_id,period_start,period_end,regular_hours,overtime_hours,status,submitted_at,approved_at,created_at,updated_at)
    values ($1,$2,$3,$4,'2026-10-01','2026-10-07',2,0,'APPROVED',now(),now(),now(),now())`,
    [timesheetId,organizationId,placementId,workerId]);
  await db.query(`insert into staffing_invoices
    (id,organization_id,placement_id,timesheet_id,agreement_id,currency,subtotal,status,issued_at,created_at)
    values ($1,$2,$3,$4,$5,'USD',100,'ISSUED',now(),now())`,
    [invoiceId,organizationId,placementId,timesheetId,`agreement:${invoiceId}`]);
}

beforeAll(async () => { if (databaseUrl) await applyCanonicalSchema(); }, 30000);
afterAll(async () => { if (pool) await pool.end(); });

describe("canonical Staffing Postgres payment reconciliation", () => {
  it.skipIf(!databaseUrl)("deduplicates provider events and serializes distinct payments", async () => {
    if (!db) throw new Error("database missing");
    let idCounter=20;
    const ids={next:()=>`00000000-0000-0000-0000-${String(idCounter++).padStart(12,"0")}`};
    const invoiceId="00000000-0000-0000-0000-000000000001";
    const organizationId="00000000-0000-0000-0000-000000000002";
    const employerId="00000000-0000-0000-0000-000000000003";
    await seedInvoice(invoiceId,organizationId,employerId);

    const service=new PaymentReconciliationService(
      new PostgresPaymentReconciliationRepository(db,ids),
      new PostgresPaymentTransaction(db,ids),
    );
    const receipt=(externalPaymentId:string,amount:number):PaymentReceipt=>({
      organizationId,provider:"test-provider",externalPaymentId,invoiceId,employerId,
      amount,currency:"USD",receivedAt:"2026-10-07T00:00:00Z",
    });

    const duplicate=receipt("evt-duplicate",40);
    const duplicateResults=await Promise.allSettled(Array.from({length:20},()=>service.reconcile(duplicate)));
    expect(duplicateResults.filter((result)=>result.status==="rejected")).toHaveLength(0);

    const remaining=await Promise.allSettled([
      service.reconcile(receipt("evt-a",25)),
      service.reconcile(receipt("evt-b",35)),
    ]);
    expect(remaining.filter((result)=>result.status==="rejected")).toHaveLength(0);

    const totals=await db.query<{count:number;total:string}>(
      `select count(*)::int count,coalesce(sum(amount),0)::text total
       from staffing_payments where organization_id=$1 and invoice_id=$2 and status='RECEIVED'`,
      [organizationId,invoiceId],
    );
    expect(totals[0].count).toBe(3);
    expect(Number(totals[0].total)).toBe(100);
    const invoice=await db.query<{status:string}>("select status from staffing_invoices where id=$1",[invoiceId]);
    expect(invoice[0].status).toBe("PAID");
  }, 30000);
});
