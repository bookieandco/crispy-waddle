import type { ID, Timesheet } from "./domain.js";

export interface BillingPolicy {
  payrollBurdenPercent: number;
  agencyMarkupPercent: number;
  platformFeePercent: number;
  currency: string;
}

export interface BillingCalculation {
  timesheetId: ID;
  hours: number;
  workerPay: number;
  payrollBurden: number;
  employerBill: number;
  agencyGrossSpread: number;
  platformFee: number;
  agencyNetRevenue: number;
  currency: string;
}

export function calculateBilling(
  timesheet: Timesheet,
  payRate: number,
  billRate: number,
  policy: BillingPolicy,
): BillingCalculation {
  if (payRate < 0 || billRate < 0) throw new Error("Rates cannot be negative");
  if (billRate < payRate) throw new Error("Bill rate cannot be below worker pay rate");
  if (policy.payrollBurdenPercent < 0 || policy.agencyMarkupPercent < 0 || policy.platformFeePercent < 0) {
    throw new Error("Billing percentages cannot be negative");
  }

  const workerPay = timesheet.hours * payRate;
  const payrollBurden = workerPay * policy.payrollBurdenPercent;
  const employerBill = timesheet.hours * billRate;
  const agencyGrossSpread = employerBill - workerPay - payrollBurden;
  const platformFee = Math.max(0, agencyGrossSpread) * policy.platformFeePercent;

  return {
    timesheetId: timesheet.id,
    hours: timesheet.hours,
    workerPay,
    payrollBurden,
    employerBill,
    agencyGrossSpread,
    platformFee,
    agencyNetRevenue: agencyGrossSpread - platformFee,
    currency: policy.currency,
  };
}
