import type { SqlExecutor } from "./postgres-adapters.js";

export interface PaymentReconciliationFixture {
  invoiceId: string;
  organizationId: string;
  employerId: string;
}

function fixtureIds(invoiceId: string) {
  return {
    jobId: `job:${invoiceId}`,
    applicationId: `application:${invoiceId}`,
    placementId: `placement:${invoiceId}`,
    timesheetId: `timesheet:${invoiceId}`,
    sourceEventId: `source:${invoiceId}`,
    agreementId: `agreement:${invoiceId}`,
  };
}

const workerId = "00000000-0000-0000-0000-000000000099";

export async function cleanupPaymentReconciliationFixture(db: SqlExecutor, fixture: PaymentReconciliationFixture): Promise<void> {
  const ids = fixtureIds(fixture.invoiceId);
  await db.query("delete from staffing_cash_ledger_entries where organization_id=$1", [fixture.organizationId]);
  await db.query("delete from staffing_payment_ledger_postings where organization_id=$1", [fixture.organizationId]);
  await db.query("delete from staffing_ledger_entries where organization_id=$1", [fixture.organizationId]);
  await db.query("delete from staffing_payments where organization_id=$1", [fixture.organizationId]);
  await db.query("delete from staffing_invoice_lines where invoice_id=$1", [fixture.invoiceId]);
  await db.query("delete from staffing_invoices where id=$1", [fixture.invoiceId]);
  await db.query("delete from staffing_timesheets where id=$1", [ids.timesheetId]);
  await db.query("delete from staffing_placements where id=$1", [ids.placementId]);
  await db.query("delete from staffing_candidate_pipeline where application_id=$1", [ids.applicationId]);
  await db.query("delete from staffing_applications where id=$1", [ids.applicationId]);
  await db.query("delete from staffing_marketplace_jobs where id=$1", [ids.jobId]);
}

export async function seedPaymentReconciliationFixture(db: SqlExecutor, fixture: PaymentReconciliationFixture): Promise<void> {
  const ids = fixtureIds(fixture.invoiceId);
  await cleanupPaymentReconciliationFixture(db, fixture);
  await db.query(
    `insert into staffing_marketplace_jobs
      (id,organization_id,employer_id,title,description,location,pay_rate,currency,remote,status,created_at,updated_at,source_event_id,marketplace_published_at)
     values ($1,$2,$3,'Test role','Fixture role','Remote',50,'USD',true,'PUBLISHED',now(),now(),$4,now())`,
    [ids.jobId, fixture.organizationId, fixture.employerId, ids.sourceEventId],
  );
  await db.query(
    `insert into staffing_applications
      (id,organization_id,job_id,worker_id,status,cover_note,created_at,updated_at)
     values ($1,$2,$3,$4,'ADVANCING','',now(),now())`,
    [ids.applicationId, fixture.organizationId, ids.jobId, workerId],
  );
  await db.query(
    `insert into staffing_placements
      (id,organization_id,application_id,job_id,worker_id,employer_id,agency_id,status,start_date,end_date,pay_rate,currency,created_at,updated_at)
     values ($1,$2,$3,$4,$5,$6,null,'PENDING','2026-10-01',null,50,'USD',now(),now())`,
    [ids.placementId, fixture.organizationId, ids.applicationId, ids.jobId, workerId, fixture.employerId],
  );
  await db.query(
    `insert into staffing_timesheets
      (id,organization_id,placement_id,worker_id,period_start,period_end,regular_hours,overtime_hours,status,submitted_at,approved_at,created_at,updated_at)
     values ($1,$2,$3,$4,'2026-10-01','2026-10-07',2,0,'APPROVED',now(),now(),now(),now())`,
    [ids.timesheetId, fixture.organizationId, ids.placementId, workerId],
  );
  await db.query(
    `insert into staffing_invoices
      (id,organization_id,placement_id,timesheet_id,agreement_id,currency,subtotal,status,issued_at,created_at)
     values ($1,$2,$3,$4,$5,'USD',100,'ISSUED',now(),now())`,
    [fixture.invoiceId, fixture.organizationId, ids.placementId, ids.timesheetId, ids.agreementId],
  );
}

export async function receivedPaymentTotal(db: SqlExecutor, fixture: PaymentReconciliationFixture): Promise<number> {
  const rows = await db.query<{ total: string }>(
    `select coalesce(sum(amount),0)::text as total from staffing_payments
      where organization_id=$1 and invoice_id=$2 and status in ('RECEIVED','SETTLED')`,
    [fixture.organizationId, fixture.invoiceId],
  );
  return Number(rows[0]?.total ?? 0);
}
