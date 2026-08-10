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

/**
 * Provider boundary. Keep Printify credentials server-side and keep the
 * storefront independent from provider-specific request shapes.
 * Actual provider calls belong in a server-only integration module once
 * production credentials and product mappings are configured.
 */
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
}
