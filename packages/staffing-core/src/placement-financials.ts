import type { ID } from "./agency-agreements.js";
import type { AgencyContractRepository, CommercialAgreement } from "./agency-agreements.js";
import { AgreementResolutionService, type CommercialLedgerWriter } from "./agreement-resolution.js";
import type { Invoice, InvoiceIds, InvoiceLedgerService, InvoiceRepository } from "./invoice-ledger.js";
import type { BillingCalculation } from "./billing.js";

export interface PlacementFinancialInput {
  organizationId: ID;
  placementId: ID;
  employerId: ID;
  agencyId: ID;
  timesheetId: ID;
  invoiceNumber: string;
  dueAt: string;
  occurredAt: string;
  billing: BillingCalculation;
  grossSpread: number;
}

export interface PlacementFinancialResult {
  invoice: Invoice;
  agreementId: ID;
  contractId: ID;
  basisAmount: number;
  platformFee: number;
  agencyRevenue: number;
  platformRevenue: number;
}

export interface PlacementFinancialRepository extends AgencyContractRepository, InvoiceRepository {}

export class PlacementFinancialService {
  constructor(
    private readonly repository: PlacementFinancialRepository,
    private readonly invoiceLedger: InvoiceLedgerService,
    private readonly resolution: AgreementResolutionService,
  ) {}

  async finalize(input: PlacementFinancialInput): Promise<PlacementFinancialResult> {
    if (input.grossSpread < 0) throw new Error("Gross spread cannot be negative");

    const resolved = await this.resolution.resolve({
      placementId: input.placementId,
      agencyId: input.agencyId,
      employerId: input.employerId,
      organizationId: input.organizationId,
      at: input.occurredAt,
      billingTotal: input.billing.employerBill,
      grossSpread: input.grossSpread,
      currency: input.billing.currency,
    });

    const invoice = await this.invoiceLedger.draftFromBilling({
      organizationId: input.organizationId,
      employerId: input.employerId,
      agencyId: input.agencyId,
      timesheetId: input.timesheetId,
      invoiceNumber: input.invoiceNumber,
      dueAt: input.dueAt,
      billing: input.billing,
    });

    await this.invoiceLedger.issue(invoice.id);

    return {
      invoice,
      agreementId: resolved.agreement.id,
      contractId: resolved.contract.id,
      basisAmount: resolved.split.basisAmount,
      platformFee: resolved.split.platformFee,
      agencyRevenue: resolved.split.agencyRevenue,
      platformRevenue: resolved.split.platformRevenue,
    };
  }
}

export function createCommercialLedgerWriter(repository: InvoiceRepository): CommercialLedgerWriter {
  return {
    async write(entry) {
      await repository.saveLedgerEntry({
        id: `commercial:${entry.placementId}:${entry.agreementId}:${entry.type}`,
        organizationId: entry.organizationId,
        invoiceId: entry.placementId,
        type: entry.type === "AGENCY_REVENUE" ? "PLATFORM_FEE" : entry.type === "PLATFORM_REVENUE" ? "PLATFORM_FEE" : "PLATFORM_FEE",
        amount: entry.amount,
        currency: entry.currency,
        occurredAt: entry.occurredAt,
      });
    },
  };
}
