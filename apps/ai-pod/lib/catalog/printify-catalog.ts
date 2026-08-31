import {
  normalizePrintifyProduct,
  type NormalizedFulfillmentProduct,
  type PrintifyProductPayload,
} from "../fulfillment/printify-adapter";

export interface ProductCatalogProvider {
  listProducts(): Promise<NormalizedFulfillmentProduct[]>;
  getProduct(productId: string): Promise<NormalizedFulfillmentProduct | null>;
}

/**
 * Printify-backed catalog boundary. Network/auth concerns belong in the
 * application adapter; this class only normalizes provider payloads.
 */
export class PrintifyCatalogProvider implements ProductCatalogProvider {
  constructor(
    private readonly client: {
      listProducts: () => Promise<PrintifyProductPayload[]>;
      getProduct: (productId: string) => Promise<PrintifyProductPayload | null>;
    },
  ) {}

  async listProducts(): Promise<NormalizedFulfillmentProduct[]> {
    const products = await this.client.listProducts();
    return products.map(normalizePrintifyProduct);
  }

  async getProduct(
    productId: string,
  ): Promise<NormalizedFulfillmentProduct | null> {
    const product = await this.client.getProduct(productId);
    return product ? normalizePrintifyProduct(product) : null;
  }
}
