'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderTrackingPanel from './OrderTrackingPanel';

export default function TrackOrderContent() {
  const search = useSearchParams();
  const sessionId = search.get('session_id');

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-ink">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze/65">
          PupsonStuff
        </p>
        <h1 className="mt-2 font-display text-3xl text-bronze">Where&apos;s my stuff?</h1>
        <p className="mt-2 text-sm text-ink/60">
          Follow your custom order from payment through Printify production and shipment.
        </p>
        {sessionId ? (
          <OrderTrackingPanel sessionId={sessionId} />
        ) : (
          <div className="mt-7 rounded-xl border border-greige/45 bg-white/55 p-5 text-sm text-ink/60">
            Open the tracking link from your PupsonStuff checkout confirmation.
          </div>
        )}
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-bronze underline">
          Back to the boutique
        </Link>
      </div>
    </main>
  );
}
