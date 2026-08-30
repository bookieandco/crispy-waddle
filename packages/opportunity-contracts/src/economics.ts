export interface CommerceEconomics {
  currency: string;
  expectedRevenue: number;
  expectedSalePrice?: number;
  unitCost?: number;
  platformFees?: number;
  paymentFees?: number;
  shippingCost?: number;
  fulfillmentCost?: number;
  advertisingCost?: number;
  refundReserve?: number;
  otherVariableCosts?: number;
  contributionMargin: number;
  contributionMarginRate: number;
  requiredCapital?: number;
  confidence: "low" | "medium" | "high";
}
