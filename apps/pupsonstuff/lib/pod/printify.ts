export type PrintifyConfig = {
  apiKey: string;
  shopId: string;
};

export type PrintifyOrderDraft = {
  externalProductId: string;
  variantId: string;
  quantity: number;
  artworkUrl: string;
};

export type PrintifyOrderRequest = {
  externalId: string;
  lineItems: Array<{ productId: string; variantId: number; quantity: number }>;
  shippingMethod?: number;
  sendShippingNotification?: boolean;
  address: { firstName: string; lastName: string; email?: string; phone?: string; country: string; region?: string; address1: string; address2?: string; city: string; zip: string };
};

export type PrintifyApi = {
  createOrder(input: PrintifyOrderRequest): Promise<{ orderId: string }>;
  publishOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<unknown>;
  getShippingCost(input: Omit<PrintifyOrderRequest, "externalId">): Promise<unknown>;
};

export class PrintifyProvider {
  constructor(private readonly config: PrintifyConfig) {}

  isConfigured() {
    return Boolean(this.config.apiKey && this.config.shopId);
  }

  buildOrderDraft(input: PrintifyOrderDraft) {
    if (!this.isConfigured()) throw new Error("Printify is not configured.");
    if (!input.externalProductId || !input.variantId || !input.artworkUrl) throw new Error("Printify order requires product, variant, and artwork.");
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Invalid order quantity.");
    return { ...input };
  }

  assertProductionReady(input: { customerApprovedAt?: string; qualityScore?: number; productionReady?: boolean }) {
    if (!input.customerApprovedAt) throw new Error("Customer approval is required before fulfillment.");
    if (!input.productionReady || (input.qualityScore ?? 0) < 90) throw new Error("Production artwork has not passed QA.");
  }

  buildOrder(input: { creationId: string; productId: string; variantId: number; address: PrintifyOrderRequest["address"] }): PrintifyOrderRequest {
    return { externalId: input.creationId, lineItems: [{ productId: input.productId, variantId: input.variantId, quantity: 1 }], sendShippingNotification: false, address: input.address };
  }
}
