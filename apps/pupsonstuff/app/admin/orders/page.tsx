import { mockOrders, mockOrderTotalCents, OrderStatus } from "@/data/mockOrders";
import { formatPriceCents } from "@/lib/admin/stats";

export const metadata = { title: "Orders — PupsonStuff Admin" };

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-greige/30 text-ink/70",
  processing: "bg-gold/20 text-bronze",
  shipped: "bg-honey-oak/15 text-honey-oak",
  delivered: "bg-honey-oak text-cream",
};

export default function AdminOrdersPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">Orders</h1>
        <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-bronze">
          Demo data
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        PupsonStuff has no cart, checkout, or order-persistence system yet
        (see the README roadmap — Milestone 5 &quot;Shopping cart +
        checkout&quot; and Milestone 6 &quot;Printful automation&quot; are
        both still ahead). The table below is fabricated data
        (data/mockOrders.ts) built to spec the layout this page will need
        once real orders exist — customer names, dates, and statuses are
        not real; product names and prices are pulled from the real
        catalog.
      </p>

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
            {mockOrders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium text-ink">{o.id}</td>
                <td className="px-4 py-3 text-ink/80">{o.customerName}</td>
                <td className="px-4 py-3 tabular-nums text-ink/70">
                  {o.placedAt}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-ink">
                  {formatPriceCents(mockOrderTotalCents(o))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[o.status]}`}
                  >
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
