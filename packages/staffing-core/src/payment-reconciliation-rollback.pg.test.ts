import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import type { PaymentReceipt } from "./payment-reconciliation.js";
import { createPgSqlExecutor } from "./postgres-pg-test-adapter.js";

describe("real postgres payment rollback", () => {
  const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;

  it.skipIf(!databaseUrl)("rolls back payment and invoice changes when ledger write fails", async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 4 });
    const db = createPgSqlExecutor(pool);
    const ids = { next: (prefix: string) => ({
      payment: "00000000-0000-0000-0000-000000000021",
      cash: "00000000-0000-0000-0000-000000000022",
    }[prefix] ?? "00000000-0000-0000-0000-000000000099") };
    const invoiceId = "00000000-0000-0000-0000-000000000004";
    const organizationId = "00000000-0000-0000-0000-000000000005";
    const employerId = "00000000-0000-0000-0000-000000000006";

    const cleanup = async () => {
      await db.query("delete from staffing_cash_ledger_entries where organization_id=$1", [organizationId]);
      await db.query("delete from staffing_payments where organization_id=$1", [organizationId]);
      await db.query("delete from invoices where id=$1", [invoiceId]);
    };

    try {
      await cleanup();
      await db.query("insert into invoices (id, organization_id, total, paid, currency, status) values ($1,$2,100,0,'USD','OPEN')", [invoiceId, organizationId]);

      const repository = new PostgresPaymentReconciliationRepository(db, ids);
      const transaction = new PostgresPaymentTransaction(db, ids);
      const payment: PaymentReceipt = {
        organizationId, provider: "test-provider", externalPaymentId: "evt-rollback-1",
        invoiceId, employerId, amount: 100, currency: "USD", receivedAt: "2026-08-11T00:00:00Z",
      };

      await expect(transaction.run(async (store) => {
        const invoice = await store.lockInvoice(invoiceId, organizationId);
        if (!invoice) throw new Error("invoice missing");
        const paymentId = await store.recordPayment(payment);
        const paid = Number(invoice.paid) + payment.amount;
        await store.updateInvoicePaid(invoiceId, organizationId, paid, "PAID");
        await store.recordCashLedgerEntry({
          organizationId, invoiceId, paymentId, amount: payment.amount, currency: payment.currency,
          occurredAt: payment.receivedAt,
        });
        throw new Error("intentional ledger failure after writes");
      })).rejects.toThrow("intentional ledger failure after writes");

      const payments = await db.query<{ count: number }>("select count(*)::int as count from staffing_payments where organization_id=$1 and external_payment_id=$2", [organizationId, payment.externalPaymentId]);
      expect(payments[0].count).toBe(0);
      const ledger = await db.query<{ count: number }>("select count(*)::int as count from staffing_cash_ledger_entries where organization_id=$1", [organizationId]);
      expect(ledger[0].count).toBe(0);
      const invoice = await db.query<{ paid: number; status: string }>("select paid,status from invoices where id=$1", [invoiceId]);
      expect(Number(invoice[0].paid)).toBe(0);
      expect(invoice[0].status).toBe("OPEN");
    } finally {
      await cleanup();
      await db.close();
    }
  });
});
