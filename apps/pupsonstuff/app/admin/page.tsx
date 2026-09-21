import StatCard from '@/components/admin/StatCard';
import CategoryBarChart from '@/components/admin/CategoryBarChart';
import {
  getSellableHotspots,
  getCategoryCounts,
  getPriceStats,
  getArtStyleEngineCounts,
  formatPriceCents,
} from '@/lib/admin/stats';
import { getAdminCatalogVariants, getAdminOrders } from '@/lib/admin/live-data';

export const metadata = { title: 'Dashboard — PupsonStuff Admin' };

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const products = getSellableHotspots();
  const categories = getCategoryCounts();
  const price = getPriceStats();
  const engines = getArtStyleEngineCounts();
  const [{ configured, orders }, catalog] = await Promise.all([
    getAdminOrders(5),
    getAdminCatalogVariants(),
  ]);
  const certifiedVariants = catalog.variants.filter(
    (variant) =>
      variant.active &&
      variant.provider === 'printify' &&
      ['sandbox_verified', 'sample_verified'].includes(variant.certification_status)
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/60">
        Catalog configuration plus live order and fulfillment state.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active listings" value={String(products.length)} />
        <StatCard
          label="Price range"
          value={price ? formatPriceCents(price.minCents) : '—'}
          note={price ? `up to ${formatPriceCents(price.maxCents)}` : undefined}
        />
        <StatCard
          label="Certified variants"
          value={catalog.configured ? String(certifiedVariants.length) : '—'}
          note={
            catalog.configured
              ? `${catalog.variants.length} live mapping record(s)`
              : 'Supabase catalog unavailable'
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
          <h2 className="font-body text-sm font-semibold text-ink">Listings by category</h2>
          <div className="mt-4">
            <CategoryBarChart data={categories} />
          </div>
        </div>

        <div className="rounded-lg border border-greige/40 bg-white/50 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-body text-sm font-semibold text-ink">Recent orders</h2>
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-bronze">
              Live ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/50">
            {configured
              ? `${orders.length} most recent paid orders.`
              : 'Supabase is not configured in this environment.'}
          </p>
          <ul className="mt-4 divide-y divide-greige/30">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">{o.customer_name ?? o.customer_email ?? 'Customer'}</p>
                  <p className="text-xs text-ink/50">
                    {o.id.slice(0, 8)} · {o.fulfillment_status}
                  </p>
                </div>
                <span className="font-medium text-ink">
                  {o.amount_total_cents == null ? '—' : formatPriceCents(o.amount_total_cents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
