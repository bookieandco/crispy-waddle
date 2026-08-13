// components/admin/StatCard.tsx
//
// Stat tile per the dataviz skill's contract: label (sentence case, no
// trailing colon) + value (semibold, proportional figures — this is a
// standalone display value, not a table column, so NOT tabular-nums)
// + an optional note for context that isn't a delta (this dashboard has
// no prior period to compare against, so no signed delta/trend here —
// inventing one would be exactly the kind of fabricated number this
// project's own conventions elsewhere explicitly avoid).

interface Props {
  label: string;
  value: string;
  note?: string;
}

export default function StatCard({ label, value, note }: Props) {
  return (
    <div className="rounded-lg border border-greige/40 bg-white/50 p-4">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 font-body text-3xl font-semibold text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/50">{note}</p>}
    </div>
  );
}
