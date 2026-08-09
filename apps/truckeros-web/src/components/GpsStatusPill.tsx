import type { GpsStatus } from "@/lib/useDriverLocation"

const LABELS: Record<GpsStatus, string> = {
  acquiring: "Acquiring GPS…",
  live: "Live GPS",
  denied: "Permission denied",
  error: "GPS error",
}

export function GpsStatusPill({ status }: { status: GpsStatus }) {
  return (
    <span className="pill">
      <span className={`pill-dot dot-${status}`} />
      {LABELS[status]}
    </span>
  )
}
