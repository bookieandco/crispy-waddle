import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicCatalogProduct } from '@/lib/public-discovery';

export const dynamic = 'force-dynamic';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicCatalogProduct(id);
  if (!product) return { title: 'Product not found — PupsonStuff' };

  return {
    title: `${product.name} — PupsonStuff`,
    description: product.description,
    alternates: {
      canonical: product.canonicalUrl,
      types: {
        'text/markdown': product.markdownUrl,
      },
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getPublicCatalogProduct(id);
  if (!product) notFound();

  const prices = product.variants.map((variant) => variant.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const price = min === max ? money(min) : `${money(min)}–${money(max)}`;

  return (
    <main className="min-h-screen bg-cream px-5 py-10 text-ink sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-greige/40 bg-white/70 p-6 shadow-sm sm:p-9">
        <Link href="/" className="text-sm text-bronze hover:underline">
          ← Back to PupsonStuff
        </Link>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
          {product.category}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight">{product.name}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{product.description}</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Fact label="Price" value={price} />
          <Fact label="Checkout mapping" value={sellabilityLabel(product.sellability)} />
          {product.estimatedDeliveryDays ? (
            <Fact
              label="Estimated delivery"
              value={`${product.estimatedDeliveryDays[0]}–${product.estimatedDeliveryDays[1]} days`}
            />
          ) : null}
          <Fact label="Inventory" value="Verify during customization / checkout" />
        </div>

        <section className="mt-9">
          <h2 className="font-display text-2xl">Options</h2>
          <div className="mt-3 divide-y divide-greige/30 rounded-xl border border-greige/40">
            {product.variants.map((variant) => (
              <div key={variant.variantId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">{variant.label}</p>
                  <p className="text-xs text-ink/50">
                    Checkout mapping: {sellabilityLabel(variant.sellability)}
                  </p>
                </div>
                <p className="font-medium tabular-nums">{money(variant.priceCents)}</p>
              </div>
            ))}
          </div>
        </section>

        {product.customization?.sizes?.length || product.customization?.colors?.length ? (
          <section className="mt-9">
            <h2 className="font-display text-2xl">Customization</h2>
            {product.customization.sizes?.length ? (
              <p className="mt-3 text-sm text-ink/70">
                Sizes: {product.customization.sizes.join(', ')}
              </p>
            ) : null}
            {product.customization.colors?.length ? (
              <p className="mt-2 text-sm text-ink/70">
                Colors: {product.customization.colors.join(', ')}
              </p>
            ) : null}
          </section>
        ) : null}

        <aside className="mt-9 rounded-xl bg-greige/15 p-4 text-sm leading-6 text-ink/65">
          This page is a canonical public product description. Checkout certification is not an
          inventory signal; current availability and final transaction details are verified in the
          live customization and checkout flow.
        </aside>
      </article>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-greige/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function sellabilityLabel(value: 'certified' | 'partially_certified' | 'uncertified' | 'unknown'): string {
  switch (value) {
    case 'certified':
      return 'certified';
    case 'partially_certified':
      return 'partially certified';
    case 'uncertified':
      return 'not certified';
    default:
      return 'verification unavailable';
  }
}
