import type { ID } from "./agency-agreements.js";
import type { CommercialSplit } from "./agency-agreements.js";
import type { Invoice } from "./invoice-ledger.js";

export interface FinancialTransaction {
  createInvoice(input: {
    organizationId: ID;
    employerId: ID;
    agencyId: ID;
    timesheetId: ID;
    invoiceNumber: string;
    dueAt: string;
    currency: string;
    total: number;
  }): Promise<Invoice>;
  issueInvoice(invoiceId: ID, occurredAt: string): Promise<void>;
  appendCommercialSplit(input: {
    organizationId: ID;
    placementId: ID;
    invoiceId: ID;
    agreementId: ID;
    split: CommercialSplit;
    occurredAt: string;
  }): Promise<void>;
}

export interface FinancialTransactionRunner {
  run<T>(work: (tx: FinancialTransaction) => Promise<T>): Promise<T>;
}

export async function executePlacementFinancialTransaction<T>(
  runner: FinancialTransactionRunner,
  work: (tx: FinancialTransaction) => Promise<T>,
): Promise<T> {
  return runner.run(work);
}
