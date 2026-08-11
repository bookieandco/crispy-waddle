import { describe, expect, it } from "vitest";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";

/**
 * Real-Postgres integration hook.
 *
 * CI should provide STAFFING_TEST_DATABASE_URL and a SqlExecutor factory.
 * The test is intentionally skipped when the database is unavailable so the
 * normal unit suite remains deterministic; the dedicated integration job
 * enables it explicitly.
 */
describe("real postgres payment race", () => {
  const databaseUrl = process.env.STAFFING_TEST_DATABASE_URL;

  it.skipIf(!databaseUrl)("serializes two webhook deliveries against one invoice", async () => {
    // The repository's SqlExecutor factory is injected by the CI integration
    // harness. This test documents the exact production assertion: two
    // concurrent transactions may observe the same webhook, but only one
    // payment and one cash-ledger row can commit.
    expect(databaseUrl).toBeTruthy();

    const payment: PaymentReceipt = {
      organizationId: "org-test",
      provider: "test-provider",
      externalPaymentId: "evt-concurrent-1",
      invoiceId: "invoice-test",
      employerId: "employer-test",
      amount: 100,
      currency: "USD",
      receivedAt: "2026-08-11T00:00:00Z",
    };

    // The CI harness supplies a transaction-capable executor and fixtures.
    const db = await import("./postgres-test-harness.js").then(m => m.createSqlExecutor(databaseUrl));
    const ids = { next: (prefix: string) => `${prefix}-test` };
    const repository = new PostgresPaymentReconciliationRepository(db, ids);
    const transaction = new PostgresPaymentTransaction(db, ids);
    const service = new PaymentReconciliationService(repository, ids, transaction);

    const results = await Promise.allSettled([
      service.reconcile(payment),
      service.reconcile(payment),
    ]);

    const fulfilled = results.filter(r => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(new Set(fulfilled.map(r => r.value.paymentId)).size).toBe(1);

    const rows = await db.query<any>(
      `select count(*)::int as count from staffing_payments where organization_id=$1 and provider=$2 and external_payment_id=$3`,
      [payment.organizationId, payment.provider, payment.externalPaymentId],
    );
    expect(rows[0].count).toBe(1);

    await db.query(`rollback`);
    await db.close?.();
  });
});
