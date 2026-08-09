import { getSellableHotspots, formatPriceCents } from "@/lib/admin/stats";

export const metadata = { title: "Products — PupsonStuff Admin" };

export default function AdminProductsPage() {
  const products = getSellableHotspots();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Products</h1>
      <p className="mt-1 text-sm text-ink/60">
        {products.length} active listings, read straight from
        data/hotspots.ts — the same file the boutique's hotspots and
        pricing already come from. This is a read-only view; editing here
        doesn&apos;t write anything back yet (no CMS/DB behind the catalog).
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-greige/40 bg-white/50">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-greige/40 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium">Fulfillment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-greige/30">
            {products.map((p) => {
              const variants = p.fulfillment?.variants ?? [];
              const prices = variants.map((v) => v.priceCents);
              const priceLabel =
                prices.length === 0
                  ? "—"
                  : prices.length === 1 || Math.min(...prices) === Math.max(...prices)
                  ? formatPriceCents(prices[0])
                  : `${formatPriceCents(Math.min(...prices))} – ${formatPriceCents(Math.max(...prices))}`;
              const isPlaceholder = p.fulfillment?.productId?.includes("PLACEHOLDER");

              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-ink/70">{p.product}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">
                    {priceLabel}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {p.estimatedDeliveryDays
                      ? `${p.estimatedDeliveryDays[0]}–${p.estimatedDeliveryDays[1]} days`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isPlaceholder ? (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-bronze">
                        Placeholder ID
                      </span>
                    ) : (
                      <span className="rounded-full bg-honey-oak/15 px-2 py-0.5 text-[11px] font-medium text-honey-oak">
                        Mapped
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
