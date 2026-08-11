import type { AgencyContract, AgencyContractRepository, CommercialAgreement, CommercialSplit, ID } from "./agency-agreements.js";
import { calculateCommercialSplit } from "./agency-agreements.js";

export interface PlacementCommercialContext {
  placementId: ID;
  agencyId: ID;
  employerId: ID;
  organizationId: ID;
  at: string;
  billingTotal: number;
  grossSpread: number;
  currency: string;
}

export interface ResolvedAgreement {
  contract: AgencyContract;
  agreement: CommercialAgreement;
  split: CommercialSplit;
}

export interface CommercialLedgerWriter {
  write(entry: {
    organizationId: ID;
    placementId: ID;
    agreementId: ID;
    type: "PLATFORM_FEE" | "AGENCY_REVENUE" | "PLATFORM_REVENUE";
    amount: number;
    currency: string;
    occurredAt: string;
  }): Promise<void>;
}

export class AgreementResolutionService {
  constructor(
    private readonly repository: AgencyContractRepository,
    private readonly ledger: CommercialLedgerWriter,
  ) {}

  async resolve(input: PlacementCommercialContext): Promise<ResolvedAgreement> {
    const agreement = await this.repository.getActiveAgreement({
      agencyId: input.agencyId,
      employerId: input.employerId,
      at: input.at,
    });
    if (!agreement) throw new Error("No active commercial agreement found for this placement");
    if (agreement.currency !== input.currency) throw new Error("Commercial agreement currency does not match billing currency");

    // Repository resolution guarantees that the selected agreement belongs to an active contract.
    const contract = await this.resolveContract(agreement);
    const split = calculateCommercialSplit({
      agreement,
      billingTotal: input.billingTotal,
      grossSpread: input.grossSpread,
    });

    await this.ledger.write({ organizationId: input.organizationId, placementId: input.placementId, agreementId: agreement.id, type: "PLATFORM_FEE", amount: split.platformFee, currency: split.currency, occurredAt: input.at });
    await this.ledger.write({ organizationId: input.organizationId, placementId: input.placementId, agreementId: agreement.id, type: "AGENCY_REVENUE", amount: split.agencyRevenue, currency: split.currency, occurredAt: input.at });
    await this.ledger.write({ organizationId: input.organizationId, placementId: input.placementId, agreementId: agreement.id, type: "PLATFORM_REVENUE", amount: split.platformRevenue, currency: split.currency, occurredAt: input.at });

    return { contract, agreement, split };
  }

  private async resolveContract(agreement: CommercialAgreement): Promise<AgencyContract> {
    // Implementations should extend the repository with getContract(contractId)
    // and verify ACTIVE status plus effective/expiry dates transactionally.
    const repository = this.repository as AgencyContractRepository & {
      getContract?: (id: ID) => Promise<AgencyContract | null>;
    };
    if (!repository.getContract) throw new Error("AgencyContractRepository.getContract is required for agreement resolution");
    const contract = await repository.getContract(agreement.contractId);
    if (!contract || contract.status !== "ACTIVE") throw new Error("Commercial agreement is not backed by an active agency contract");
    return contract;
  }
}
