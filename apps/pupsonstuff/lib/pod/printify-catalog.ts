export type PrintifyCatalogProduct = { id: string; title?: string; blueprint_id?: number; print_provider_id?: number; variants?: Array<{ id: number; title?: string; sku?: string; is_enabled?: boolean }> };

export class PrintifyCatalogClient {
  constructor(private readonly apiKey: string, private readonly shopId: string) {}

  async listProducts(): Promise<PrintifyCatalogProduct[]> {
    const products: PrintifyCatalogProduct[] = [];
    let page = 1;
    while (true) {
      const response = await fetch(`https://api.printify.com/v1/shops/${this.shopId}/products.json?page=${page}&limit=100`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      if (!response.ok) throw new Error(`Printify catalog request failed: ${response.status}`);
      const payload = await response.json() as { data?: PrintifyCatalogProduct[]; current_page?: number; last_page?: number };
      products.push(...(payload.data ?? []));
      if (!payload.data?.length || (payload.current_page ?? page) >= (payload.last_page ?? page)) break;
      page += 1;
    }
    return products;
  }
}
