import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";

describe("real postgres payment race", () => {
  const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;

  it.skipIf(!databaseUrl)("serializes concurrent duplicate webhook deliveries", async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 20 });
    const db = createPgSqlExecutor(pool);
    let idCounter = 20;
    const ids = {
      next: (_prefix: string) => {
        const id = idCounter++;
        return `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
      },
    };
    const invoiceId = "00000000-0000-0000-0000-000000000001";
    const organizationId = "00000000-0000-0000-0000-000000000002";
    const employerId = "00000000-0000-0000-0000-000000000003";

    const cleanup = async () => {
      await db.query("delete from staffing_cash_ledger_entries where payment_id in (select id from staffing_payments where organization_id=$1)", [organizationId]);
      await db.query("delete from staffing_payments where organization_id=$1", [organizationId]);
      await db.query("delete from invoices where id=$1", [invoiceId]);
    };

    try {
      await cleanup();
      await db.query("insert into invoices (id, organization_id, total, paid, currency, status) values ($1,$2,100,0,'USD','OPEN')", [invoiceId, organizationId]);

      const repository = new PostgresPaymentReconciliationRepository(db, ids);
      const transaction = new PostgresPaymentTransaction(db, ids);
      const service = new PaymentReconciliationService(repository, transaction);

      const duplicatePayment: PaymentReceipt = {
        organizationId, provider: "test-provider", externalPaymentId: "evt-concurrent-50",
        invoiceId, employerId, amount: 100, currency: "USD", receivedAt: "2026-08-11T00:00:00Z",
      };
      const duplicateResults = await Promise.allSettled(
        Array.from({ length: 50 }, () => service.reconcile(duplicatePayment)),
      );
      expect(duplicateResults.filter((result) => result.status === "rejected")).toHaveLength(0);

      await cleanup();
      await db.query("insert into invoices (id, organization_id, total, paid, currency, status) values ($1,$2,100,0,'USD','OPEN')", [invoiceId, organizationId]);

      const distinctPayments = [40, 60].map((amount, index) => ({
        organizationId, provider: "test-provider", externalPaymentId: `evt-distinct-${index + 1}`,
        invoiceId, employerId, amount, currency: "USD", receivedAt: "2026-08-11T00:00:00Z",
      } satisfies PaymentReceipt));
      const distinctResults = await Promise.allSettled(
        distinctPayments.map((payment) => service.reconcile(payment)),
      );
      expect(distinctResults.filter((result) => result.status === "rejected")).toHaveLength(0);

      const payments = await db.query<{ count: number; total: string }>(
        "select count(*)::int as count, coalesce(sum(amount),0)::text as total from staffing_payments where organization_id=$1 and invoice_id=$2",
        [organizationId, invoiceId],
      );
      expect(payments[0].count).toBe(2);
      expect(Number(payments[0].total)).toBe(100);

      const ledger = await db.query<{ count: number }>(
        "select count(*)::int as count from staffing_cash_ledger_entries where payment_id in (select id from staffing_payments where organization_id=$1 and invoice_id=$2)",
        [organizationId, invoiceId],
      );
      expect(ledger[0].count).toBe(2);

      const invoice = await db.query<{ paid: number; status: string }>("select paid,status from invoices where id=$1", [invoiceId]);
      expect(Number(invoice[0].paid)).toBe(100);
      expect(invoice[0].status).toBe("PAID");
    } finally {
      await cleanup();
      await db.close();
    }
  });
});
