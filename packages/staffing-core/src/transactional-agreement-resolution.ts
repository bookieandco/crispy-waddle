import type { Placement } from "./placements.js";
import type { AgreementResolutionService } from "./agreement-resolution.js";

export interface TransactionalAgreementResolver {
  transaction<T>(work: (tx: TransactionalAgreementResolver) => Promise<T>): Promise<T>;
  lockPlacement(placementId: string, organizationId: string): Promise<Placement | null>;
  resolveActiveAgreement(input: { agencyId: string; employerId: string; at: string }): Promise<{
    contractId: string; agreementId: string; currency: string; billingRate: number; workerPayRate: number; agencySplitPercent: number;
  } | null>;
  writeLedger(entry: {
    organizationId: string; placementId: string; agreementId: string;
    type: "PLATFORM_FEE" | "AGENCY_REVENUE" | "PLATFORM_REVENUE";
    amount: number; currency: string; occurredAt: string;
  }): Promise<void>;
  writeEvent(event: { id: string; type: "AGREEMENT_RESOLVED"; aggregateId: string; organizationId: string; occurredAt: string; payload: unknown }): Promise<void>;
}

export class TransactionalAgreementResolutionService {
  constructor(private readonly db: TransactionalAgreementResolver, private readonly ids: { next(prefix: string): string }) {}

  async resolve(placementId: string, organizationId: string, at: string) {
    return this.db.transaction(async (tx) => {
      const placement = await tx.lockPlacement(placementId, organizationId);
      if (!placement) throw new Error("Placement not found");
      if (!placement.agencyId) throw new Error("Placement has no agency");
      const agreement = await tx.resolveActiveAgreement({ agencyId: placement.agencyId, employerId: placement.employerId, at });
      if (!agreement) throw new Error("No active commercial agreement found for placement");
      if (agreement.currency !== placement.currency) throw new Error("Agreement currency does not match placement currency");
      if (agreement.agencySplitPercent < 0 || agreement.agencySplitPercent > 100) throw new Error("Invalid agency split percentage");
      const agencyAmount = Number((agreement.billingRate * agreement.agencySplitPercent / 100).toFixed(2));
      const platformAmount = Number((agreement.billingRate - agencyAmount).toFixed(2));
      const entries = [
        { type: "AGENCY_REVENUE" as const, amount: agencyAmount },
        { type: "PLATFORM_REVENUE" as const, amount: platformAmount },
      ];
      for (const entry of entries) await tx.writeLedger({ organizationId, placementId, agreementId: agreement.agreementId, type: entry.type, amount: entry.amount, currency: agreement.currency, occurredAt: at });
      const resolved = { placementId, contractId: agreement.contractId, agreementId: agreement.agreementId, billingRate: agreement.billingRate, workerPayRate: agreement.workerPayRate, agencyAmount, platformAmount, currency: agreement.currency };
      await tx.writeEvent({ id: this.ids.next("event"), type: "AGREEMENT_RESOLVED", aggregateId: placementId, organizationId, occurredAt: at, payload: resolved });
      return resolved;
    });
  }
}
