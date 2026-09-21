import { getSellableHotspots, formatPriceCents } from "@/lib/admin/stats";
import { getAdminCatalogVariants } from "@/lib/admin/live-data";

export const metadata = { title: "Products — PupsonStuff Admin" };

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = getSellableHotspots();
  const catalog = await getAdminCatalogVariants();
  const certification = new Map(
    catalog.variants.map((variant) => [
      `${variant.product_id}:${variant.variant_id}`,
      variant,
    ])
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Products</h1>
      <p className="mt-1 text-sm text-ink/60">
        {products.length} active storefront listings. Product names, prices, and local variant IDs
        come from the boutique catalog; provider IDs and certification status come from the live
        catalog ledger.
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
              const statuses = variants.map((variant) =>
                certification.get(`${p.id}:${variant.variantId}`)
              );
              const sampleVerified = statuses.filter(
                (row) => row?.active && row.provider === "printify" && row.certification_status === "sample_verified"
              ).length;
              const sandboxVerified = statuses.filter(
                (row) =>
                  row?.active &&
                  row.provider === "printify" &&
                  ["sandbox_verified", "sample_verified"].includes(row.certification_status)
              ).length;

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
                    {!catalog.configured ? (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-bronze">
                        Catalog unavailable
                      </span>
                    ) : sampleVerified === variants.length && variants.length > 0 ? (
                      <span className="rounded-full bg-honey-oak/15 px-2 py-0.5 text-[11px] font-medium text-honey-oak">
                        Sample verified
                      </span>
                    ) : sandboxVerified > 0 ? (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-bronze">
                        {sandboxVerified}/{variants.length} sandbox verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        Uncertified
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
