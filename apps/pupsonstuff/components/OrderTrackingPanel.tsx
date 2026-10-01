'use client';

import { useEffect, useMemo, useState } from 'react';

interface TrackingState {
  success: boolean;
  paymentStatus?: string;
  orderStatus?: string;
  fulfillmentStatus?: string;
  tracking?: Array<Record<string, unknown>>;
  attentionRequired?: boolean;
  error?: string;
}

const steps = [
  { id: 'paid', label: 'Payment received' },
  { id: 'pending', label: 'Preparing your custom order' },
  { id: 'submitted', label: 'Sent to production' },
  { id: 'in_production', label: 'Being made' },
  { id: 'shipped', label: 'On the way' },
  { id: 'fulfilled', label: 'Delivered' },
] as const;

function progressIndex(status: string | undefined) {
  switch (status) {
    case 'fulfilled':
      return 5;
    case 'shipped':
      return 4;
    case 'in_production':
      return 3;
    case 'submitted':
      return 2;
    case 'submitting':
      return 2;
    case 'pending':
    case 'blocked':
    case 'failed':
      return 1;
    default:
      return 0;
  }
}

export default function OrderTrackingPanel({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<TrackingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo(() => progressIndex(state?.fulfillmentStatus), [state?.fulfillmentStatus]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/order-tracking?session_id=${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' }
        );
        const body = (await response.json()) as TrackingState;
        if (cancelled) return;
        if (!response.ok || !body.success) {
          setError(body.error ?? 'Could not load order progress.');
          return;
        }
        setState(body);
        setError(null);
        if (!['fulfilled', 'shipped'].includes(body.fulfillmentStatus ?? '')) {
          timer = window.setTimeout(load, 30000);
        }
      } catch {
        if (!cancelled) setError('Could not refresh order progress.');
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <section className="mt-7 rounded-xl border border-greige/45 bg-white/55 p-5 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bronze/65">
            Order journey
          </p>
          <h2 className="mt-1 font-display text-xl text-bronze">Your PupsonStuff progress</h2>
        </div>
        <span className="rounded-full bg-honey-oak/15 px-3 py-1 text-[11px] font-medium text-bronze">
          Live status
        </span>
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                index <= current
                  ? 'border-honey-oak bg-honey-oak text-cream'
                  : 'border-greige/50 text-ink/35'
              }`}
            >
              {index < current ? '✓' : index + 1}
            </span>
            <span className={index <= current ? 'text-sm text-ink' : 'text-sm text-ink/40'}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {state?.attentionRequired && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your order needs operator attention before it can move forward. Your payment record is
          preserved; production has not been silently duplicated.
        </p>
      )}

      {error && <p className="mt-4 text-xs text-red-700">{error}</p>}

      {state?.tracking && state.tracking.length > 0 && (
        <div className="mt-5 border-t border-greige/35 pt-4">
          <p className="text-xs font-semibold text-bronze">Shipment</p>
          {state.tracking.map((shipment, index) => {
            const carrier = String(shipment.carrier ?? shipment.provider ?? 'Carrier');
            const number = String(
              shipment.number ?? shipment.tracking_number ?? shipment.trackingNumber ?? ''
            );
            const url = String(shipment.url ?? shipment.tracking_url ?? '');
            return (
              <p key={index} className="mt-2 text-xs text-ink/60">
                {carrier}{number ? ` · ${number}` : ''}
                {url.startsWith('http') ? (
                  <>
                    {' · '}
                    <a href={url} target="_blank" rel="noreferrer" className="font-medium text-bronze underline">
                      Track package
                    </a>
                  </>
                ) : null}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
