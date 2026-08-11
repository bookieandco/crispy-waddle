import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";

describe("real postgres payment race", () => {
  const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;

  it.skipIf(!databaseUrl)("serializes two webhook deliveries against one invoice", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const db = createPgSqlExecutor(pool);
    const ids = {
      next: (prefix: string) => {
        const values: Record<string, string> = {
          payment: "00000000-0000-0000-0000-000000000010",
          ledger: "00000000-0000-0000-0000-000000000011",
        };
        return values[prefix] ?? "00000000-0000-0000-0000-000000000099";
      },
    };
    const invoiceId = "00000000-0000-0000-0000-000000000001";
    const organizationId = "00000000-0000-0000-0000-000000000002";
    const employerId = "00000000-0000-0000-0000-000000000003";

    try {
      await db.query("delete from staffing_payments where organization_id=$1", [organizationId]);
      await db.query("delete from invoices where id=$1", [invoiceId]);
      await db.query("insert into invoices (id, organization_id, total, paid, currency, status) values ($1,$2,100,0,'USD','OPEN')", [invoiceId, organizationId]);

      const payment: PaymentReceipt = {
        organizationId, provider: "test-provider", externalPaymentId: "evt-concurrent-1",
        invoiceId, employerId, amount: 100, currency: "USD", receivedAt: "2026-08-11T00:00:00Z",
      };
      const repository = new PostgresPaymentReconciliationRepository(db, ids);
      const transaction = new PostgresPaymentTransaction(db, ids);
      const service = new PaymentReconciliationService(repository, ids, transaction);

      const results = await Promise.allSettled([service.reconcile(payment), service.reconcile(payment)]);
      const fulfilled = results.filter(r => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(new Set(fulfilled.map(r => r.value.paymentId)).size).toBe(1);

      const payments = await db.query<{ count: number }>("select count(*)::int as count from staffing_payments where organization_id=$1 and provider=$2 and external_payment_id=$3", [organizationId, payment.provider, payment.externalPaymentId]);
      expect(payments[0].count).toBe(1);
      const invoice = await db.query<{ paid: number; status: string }>("select paid,status from invoices where id=$1", [invoiceId]);
      expect(Number(invoice[0].paid)).toBe(100);
      expect(invoice[0].status).toBe("PAID");
    } finally {
      await db.query("delete from staffing_payments where organization_id=$1", [organizationId]);
      await db.query("delete from invoices where id=$1", [invoiceId]);
      await db.close();
    }
  });
});
