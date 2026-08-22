export interface AdminOrderItem {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_amount_cents: number;
}

export interface AdminOrder {
  id: string;
  stripe_session_id: string;
  customer_email: string | null;
  currency: string | null;
  amount_total_cents: number | null;
  status: string;
  fulfillment_status: string;
  created_at: string;
  items: AdminOrderItem[];
}

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin configuration is missing.");
  return { url: url.replace(/\/$/, ""), key };
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const { url, key } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/pupson_orders?select=id,stripe_session_id,customer_email,currency,amount_total_cents,status,fulfillment_status,created_at,pupson_order_items(product_name,variant_label,quantity,unit_amount_cents)&order=created_at.desc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Supabase admin order query failed (${response.status}).`);
  return (await response.json()) as AdminOrder[];
}
