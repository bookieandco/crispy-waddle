import { Suspense } from 'react';
import TrackOrderContent from '@/components/TrackOrderContent';

export const metadata = { title: 'Track Your Order — PupsonStuff' };

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-cream">
          <p className="text-sm text-ink/60">Loading order progress…</p>
        </main>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
