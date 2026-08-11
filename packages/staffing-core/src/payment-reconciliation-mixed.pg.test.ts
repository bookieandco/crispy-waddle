import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";

describe("real postgres mixed payment contention", () => {
  const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;

  it.skipIf(!databaseUrl)("deduplicates one webhook while preserving two distinct concurrent payments", async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 20 });
    const db = createPgSqlExecutor(pool);
    let idCounter = 100;
    const ids = { next: () => `00000000-0000-0000-0000-${String(idCounter++).padStart(12, "0")}` };
    const invoiceId = "00000000-0000-0000-0000-000000000007";
    const organizationId = "00000000-0000-0000-0000-000000000008";
    const employerId = "00000000-0000-0000-0000-000000000009";

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
      const service = new PaymentReconciliationService(repository, ids, transaction);
      const receipt = (externalPaymentId: string, amount: number): PaymentReceipt => ({
        organizationId, provider: "test-provider", externalPaymentId, invoiceId, employerId,
        amount, currency: "USD", receivedAt: "2026-08-11T00:00:00Z",
      });

      const deliveries = [
        ...Array.from({ length: 25 }, () => receipt("evt-mixed-duplicate", 50)),
        receipt("evt-mixed-distinct-a", 25),
        receipt("evt-mixed-distinct-b", 25),
      ];
      const results = await Promise.allSettled(deliveries.map((payment) => service.reconcile(payment)));
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(0);

      const payments = await db.query<{ count: number; total: string }>(
        "select count(*)::int as count, coalesce(sum(amount),0)::text as total from staffing_payments where organization_id=$1 and invoice_id=$2",
        [organizationId, invoiceId],
      );
      expect(payments[0].count).toBe(3);
      expect(Number(payments[0].total)).toBe(100);

      const duplicateCount = await db.query<{ count: number }>(
        "select count(*)::int as count from staffing_payments where organization_id=$1 and provider=$2 and external_payment_id=$3",
        [organizationId, "test-provider", "evt-mixed-duplicate"],
      );
      expect(duplicateCount[0].count).toBe(1);

      const ledger = await db.query<{ count: number }>(
        "select count(*)::int as count from staffing_cash_ledger_entries where payment_id in (select id from staffing_payments where organization_id=$1 and invoice_id=$2)",
        [organizationId, invoiceId],
      );
      expect(ledger[0].count).toBe(3);

      const invoice = await db.query<{ paid: number; status: string }>("select paid,status from invoices where id=$1", [invoiceId]);
      expect(Number(invoice[0].paid)).toBe(100);
      expect(invoice[0].status).toBe("PAID");
    } finally {
      await cleanup();
      await db.close();
    }
  });
});
