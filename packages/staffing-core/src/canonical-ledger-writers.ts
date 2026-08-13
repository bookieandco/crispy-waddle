import type { LedgerEntry, FinancialLedgerService } from "./financial-ledger.js";

export class CanonicalCommercialLedgerWriter {
  constructor(private readonly ledger: FinancialLedgerService) {}

  async agencyRevenue(input: Omit<LedgerEntry, "id" | "type" | "sourceId"> & { sourceId: string }): Promise<LedgerEntry> {
    return this.ledger.post({ ...input, type: "AGENCY_REVENUE" });
  }

  async platformRevenue(input: Omit<LedgerEntry, "id" | "type" | "sourceId"> & { sourceId: string }): Promise<LedgerEntry> {
    return this.ledger.post({ ...input, type: "PLATFORM_REVENUE" });
  }
}

export class CanonicalPaymentLedgerWriter {
  constructor(private readonly ledger: FinancialLedgerService) {}

  async paymentReceived(input: Omit<LedgerEntry, "id" | "type" | "sourceId"> & { paymentId: string; sourceId: string }): Promise<LedgerEntry> {
    return this.ledger.post({ ...input, type: "PAYMENT_RECEIVED" });
  }
}
