import type { GrowthId } from '../domain/types.js';

export interface CustomerOrder {
  orderId: GrowthId;
  customerId: GrowthId;
  occurredAt: string;
  revenue: number;
  refunds: number;
  variableCosts: number;
  currency: string;
}

export interface CustomerValue {
  customerId: GrowthId;
  currency: string;
  orderCount: number;
  grossRevenue: number;
  refunds: number;
  variableCosts: number;
  contributionMargin: number;
  averageOrderValue: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
}

export function calculateCustomerValue(
  customerId: GrowthId,
  orders: readonly CustomerOrder[],
): CustomerValue {
  const customerOrders = orders.filter((order) => order.customerId === customerId);
  const currency = customerOrders[0]?.currency ?? 'USD';
  const grossRevenue = customerOrders.reduce((sum, order) => sum + order.revenue, 0);
  const refunds = customerOrders.reduce((sum, order) => sum + order.refunds, 0);
  const variableCosts = customerOrders.reduce((sum, order) => sum + order.variableCosts, 0);

  const dates = customerOrders.map((order) => order.occurredAt).sort();

  return {
    customerId,
    currency,
    orderCount: customerOrders.length,
    grossRevenue,
    refunds,
    variableCosts,
    contributionMargin: grossRevenue - refunds - variableCosts,
    averageOrderValue: customerOrders.length ? grossRevenue / customerOrders.length : 0,
    firstOrderAt: dates[0],
    lastOrderAt: dates.at(-1),
  };
}
