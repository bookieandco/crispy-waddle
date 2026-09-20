import { formatPriceCents } from '@/lib/admin/stats';
import { getAdminOrders } from '@/lib/admin/live-data';
import FulfillmentAction from '@/components/admin/FulfillmentAction';

export const metadata = { title: 'Orders — PupsonStuff Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const { configured, orders } = await getAdminOrders();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Orders</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Live Stripe ledger and fulfillment exception queue. Production submission remains blocked
        while `PUPSON_FULFILLMENT_MODE=dry_run`.
      </p>
      {!configured ? (
        <p className="mt-6 rounded-lg bg-gold/20 p-4 text-sm text-bronze">
          Supabase is not configured in this environment.
        </p>
      ) : null}
      {configured && orders.length === 0 ? (
        <p className="mt-6 rounded-lg border border-greige/40 bg-white/50 p-6 text-sm text-ink/60">
          No paid orders yet.
        </p>
      ) : null}
      {orders.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-greige/40 bg-white/50">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-greige/40 text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Fulfillment</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-greige/30">
              {orders.map((order) => {
                const fulfillment = order.fulfillment[0];
                return (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      {order.customer_name ?? order.customer_email ?? '—'}
                      <p className="text-xs text-ink/50">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {order.order_items
                        .map(
                          (item) => `${item.quantity}× ${item.product_name} (${item.variant_label})`
                        )
                        .join(', ')}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {order.amount_total_cents == null
                        ? '—'
                        : formatPriceCents(order.amount_total_cents)}
                    </td>
                    <td className="px-4 py-3 capitalize">{order.status}</td>
                    <td className="px-4 py-3 capitalize">
                      {fulfillment?.status ?? order.fulfillment_status}
                      {fulfillment?.last_error ? (
                        <p className="max-w-52 text-xs text-red-700">{fulfillment.last_error}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {fulfillment ? <FulfillmentAction fulfillmentId={fulfillment.id} /> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
