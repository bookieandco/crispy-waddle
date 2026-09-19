import { getPlatformConfig, rest } from '@/lib/platform';

export interface AdminOrder {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_total_cents: number | null;
  currency: string | null;
  status: string;
  fulfillment_status: string;
  created_at: string;
  order_items: Array<{ product_name: string; variant_label: string; quantity: number }>;
  fulfillment: Array<{
    id: string;
    status: string;
    last_error: string | null;
    provider_order_id: string | null;
  }>;
}

export async function getAdminOrders(
  limit = 100
): Promise<{ configured: boolean; orders: AdminOrder[] }> {
  if (!getPlatformConfig()) return { configured: false, orders: [] };
  const orders = await rest<AdminOrder[]>(
    `pupson_orders?select=id,customer_email,customer_name,amount_total_cents,currency,status,fulfillment_status,created_at,order_items:pupson_order_items(product_name,variant_label,quantity),fulfillment:pupson_fulfillment_orders(id,status,last_error,provider_order_id)&order=created_at.desc&limit=${limit}`
  );
  return { configured: true, orders };
}
