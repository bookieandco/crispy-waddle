import { getAdminOrders } from "@/lib/admin/orders";
import { formatPriceCents } from "@/lib/admin/stats";

export const metadata = { title: "Orders — PupsonStuff Admin" };

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">Orders</h1>
        <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-bronze">
          Live data
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Orders recorded from completed Stripe payments. No fabricated demo orders are shown.
      </p>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-greige/40 bg-white/50 p-6 text-sm text-ink/60">
          No paid orders have been recorded yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-greige/40 bg-white/50">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-greige/40 text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-greige/30">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-ink">{order.id}</td>
                  <td className="px-4 py-3 text-ink/80">{order.customer_email ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-ink/70">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {order.items.map((item) => `${item.quantity}× ${item.product_name}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">
                    {order.amount_total_cents == null ? "—" : formatPriceCents(order.amount_total_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-greige/30 px-2 py-0.5 text-[11px] font-medium capitalize text-ink/70">
                      {order.fulfillment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
