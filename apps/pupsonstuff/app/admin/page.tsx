import StatCard from "@/components/admin/StatCard";
import CategoryBarChart from "@/components/admin/CategoryBarChart";
import {
  getSellableHotspots,
  getCategoryCounts,
  getPriceStats,
  getUnfulfilledListings,
  getArtStyleEngineCounts,
  formatPriceCents,
} from "@/lib/admin/stats";
import { mockOrders, mockOrderTotalCents } from "@/data/mockOrders";

export const metadata = { title: "Dashboard — PupsonStuff Admin" };

export default function AdminDashboardPage() {
  const products = getSellableHotspots();
  const categories = getCategoryCounts();
  const price = getPriceStats();
  const unfulfilled = getUnfulfilledListings();
  const engines = getArtStyleEngineCounts();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every stat below is computed live from the real catalog
        (data/hotspots.ts) — except the order figures, which are clearly
        marked demo data (see the Orders page).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active listings" value={String(products.length)} />
        <StatCard
          label="Price range"
          value={price ? formatPriceCents(price.minCents) : "—"}
          note={price ? `up to ${formatPriceCents(price.maxCents)}` : undefined}
        />
        <StatCard
          label="Unmapped to Printful"
          value={String(unfulfilled.length)}
          note={
            unfulfilled.length > 0
              ? "still using PLACEHOLDER product IDs"
              : "all listings mapped"
          }
        />
        <StatCard
          label="Art styles"
          value={String(engines.openai + engines.muapi + engines.deterministic)}
          note={`${engines.openai} OpenAI · ${engines.muapi} Muapi · ${engines.deterministic} deterministic`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-greige/40 bg-white/50 p-5">
          <h2 className="font-body text-sm font-semibold text-ink">
            Listings by category
          </h2>
          <div className="mt-4">
            <CategoryBarChart data={categories} />
          </div>
        </div>

        <div className="rounded-lg border border-greige/40 bg-white/50 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-body text-sm font-semibold text-ink">
              Recent orders
            </h2>
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-bronze">
              Demo data
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/50">
            No cart/checkout system exists yet (roadmap Milestones 5–6) — these
            are fabricated orders for layout purposes, not real sales.
          </p>
          <ul className="mt-4 divide-y divide-greige/30">
            {mockOrders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">{o.customerName}</p>
                  <p className="text-xs text-ink/50">{o.id}</p>
                </div>
                <span className="font-medium text-ink">
                  {formatPriceCents(mockOrderTotalCents(o))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
