export type PrintifyOrderInput = { externalProductId: string; variantId: string; quantity: number; artworkUrl: string; address: { firstName: string; lastName: string; email: string; phone?: string; country: string; region?: string; city: string; address1: string; address2?: string; zip: string; } };

export type PrintifyOrderResult = { orderId: string; status?: string };

export class PrintifyClient {
  constructor(private readonly apiKey: string, private readonly shopId: string) {}

  async createOrder(input: PrintifyOrderInput): Promise<PrintifyOrderResult> {
    const response = await fetch(`https://api.printify.com/v1/shops/${this.shopId}/orders.json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: undefined, line_items: [{ product_id: input.externalProductId, variant_id: Number(input.variantId), quantity: input.quantity, print_provider_id: undefined, blueprint_id: undefined, placeholders: [{ position: "front", images: [{ id: input.artworkUrl }] }] }], shipping_method: 1, address_to: input.address }),
    });
    if (!response.ok) throw new Error(`Printify order creation failed: ${response.status}`);
    const data = await response.json() as { id?: string; status?: string };
    if (!data.id) throw new Error("Printify did not return an order ID.");
    return { orderId: data.id, status: data.status };
  }
}
