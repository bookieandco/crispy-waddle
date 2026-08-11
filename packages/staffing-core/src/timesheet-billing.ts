import type { ID } from "./agency-agreements.js";
import type { BillingCalculation } from "./billing.js";
import type { PlacementFinancialService, PlacementFinancialResult } from "./placement-financials.js";

export interface ApprovedTimesheetBillingInput {
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

export class ApprovedTimesheetBillingService {
  constructor(private readonly placementFinancials: PlacementFinancialService) {}

  async finalize(input: ApprovedTimesheetBillingInput): Promise<PlacementFinancialResult> {
    if (input.billing.employerBill <= 0) throw new Error("Approved timesheet billing must be positive");
    if (!input.timesheetId) throw new Error("Timesheet is required");
    return this.placementFinancials.finalize(input);
  }
}
