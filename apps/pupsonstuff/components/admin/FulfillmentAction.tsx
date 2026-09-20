'use client';

import { useState } from 'react';

export default function FulfillmentAction({ fulfillmentId }: { fulfillmentId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/fulfillment/${fulfillmentId}/submit`, {
      method: 'POST',
    });
    const body = await response.json();
    setMessage(response.ok ? body.status : body.error);
    setBusy(false);
  };
  return (
    <div>
      <button
        onClick={submit}
        disabled={busy}
        className="rounded bg-bronze px-2 py-1 text-xs text-cream disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Submit / retry'}
      </button>
      {message ? <p className="mt-1 max-w-48 text-[10px] text-ink/60">{message}</p> : null}
    </div>
  );
}
