export interface CustomerEconomicsInput {
  spend: number;
  newCustomers: number;
  revenue: number;
  refunds: number;
  variableCosts: number;
  repeatRevenue?: number;
}

export interface CustomerEconomics {
  cac: number;
  grossRevenue: number;
  netRevenue: number;
  contributionMargin: number;
  ltvPerCustomer: number;
  netLtvPerCustomer: number;
  ltvToCac: number;
  mer: number;
  contributionRoas: number;
}

export function calculateCustomerEconomics(input: CustomerEconomicsInput): CustomerEconomics {
  const spend = Math.max(0, input.spend);
  const customers = Math.max(0, input.newCustomers);
  const grossRevenue = Math.max(0, input.revenue) + Math.max(0, input.repeatRevenue ?? 0);
  const refunds = Math.max(0, input.refunds);
  const variableCosts = Math.max(0, input.variableCosts);
  const netRevenue = grossRevenue - refunds;
  const contributionMargin = netRevenue - variableCosts;
  const cac = customers === 0 ? 0 : spend / customers;
  const ltvPerCustomer = customers === 0 ? 0 : netRevenue / customers;
  const netLtvPerCustomer = customers === 0 ? 0 : contributionMargin / customers;
  return {
    cac,
    grossRevenue,
    netRevenue,
    contributionMargin,
    ltvPerCustomer,
    netLtvPerCustomer,
    ltvToCac: cac === 0 ? 0 : netLtvPerCustomer / cac,
    mer: spend === 0 ? 0 : grossRevenue / spend,
    contributionRoas: spend === 0 ? 0 : contributionMargin / spend,
  };
}
