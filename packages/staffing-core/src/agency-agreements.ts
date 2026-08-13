export type ID = string;
export type AgreementStatus = "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TERMINATED";
export type FeeBasis = "BILLING_TOTAL" | "GROSS_SPREAD" | "WORKER_PAY" | "FLAT_PER_PLACEMENT";
export type RevenueParty = "AGENCY" | "PLATFORM" | "EMPLOYER";

export interface AgencyContract {
  id: ID;
  organizationId: ID;
  agencyId: ID;
  name: string;
  status: AgreementStatus;
  effectiveAt: string;
  expiresAt?: string;
  autoRenew: boolean;
  version: number;
  documentRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialAgreement {
  id: ID;
  contractId: ID;
  agencyId: ID;
  employerId?: ID;
  feeBasis: FeeBasis;
  platformFeePercent?: number;
  agencySharePercent?: number;
  platformSharePercent?: number;
  flatPlacementFee?: number;
  currency: string;
  effectiveAt: string;
  expiresAt?: string;
  priority: number;
}

export interface CommercialSplit {
  basisAmount: number;
  platformFee: number;
  agencyRevenue: number;
  platformRevenue: number;
  currency: string;
}

export interface AgencyContractRepository {
  saveContract(contract: AgencyContract): Promise<void>;
  saveAgreement(agreement: CommercialAgreement): Promise<void>;
  getActiveAgreement(input: { agencyId: ID; employerId?: ID; at: string }): Promise<CommercialAgreement | null>;
}

function assertPercent(value: number | undefined, name: string): void {
  if (value !== undefined && (value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1`);
}

export function validateCommercialAgreement(agreement: CommercialAgreement): void {
  assertPercent(agreement.platformFeePercent, "platformFeePercent");
  assertPercent(agreement.agencySharePercent, "agencySharePercent");
  assertPercent(agreement.platformSharePercent, "platformSharePercent");
  if (agreement.flatPlacementFee !== undefined && agreement.flatPlacementFee < 0) throw new Error("flatPlacementFee cannot be negative");
  if (!agreement.currency) throw new Error("currency is required");
  if (agreement.feeBasis === "FLAT_PER_PLACEMENT" && agreement.flatPlacementFee === undefined) throw new Error("flatPlacementFee is required for flat placement agreements");
  if (agreement.agencySharePercent !== undefined && agreement.platformSharePercent !== undefined && Math.abs(agreement.agencySharePercent + agreement.platformSharePercent - 1) > 0.000001) {
    throw new Error("agencySharePercent and platformSharePercent must total 100%");
  }
}

export function calculateCommercialSplit(input: {
  agreement: CommercialAgreement;
  billingTotal: number;
  grossSpread: number;
}): CommercialSplit {
  validateCommercialAgreement(input.agreement);
  if (input.billingTotal < 0 || input.grossSpread < 0) throw new Error("Commercial amounts cannot be negative");

  const a = input.agreement;
  const basisAmount = a.feeBasis === "BILLING_TOTAL" ? input.billingTotal
    : a.feeBasis === "GROSS_SPREAD" ? input.grossSpread
    : a.feeBasis === "FLAT_PER_PLACEMENT" ? a.flatPlacementFee ?? 0
    : input.grossSpread;

  const platformFee = a.platformFeePercent !== undefined ? basisAmount * a.platformFeePercent : 0;
  const distributable = Math.max(0, basisAmount - platformFee);
  const platformRevenue = a.platformSharePercent !== undefined ? distributable * a.platformSharePercent : platformFee;
  const agencyRevenue = a.agencySharePercent !== undefined ? distributable * a.agencySharePercent : Math.max(0, distributable - platformRevenue);

  return { basisAmount, platformFee, agencyRevenue, platformRevenue, currency: a.currency };
}
