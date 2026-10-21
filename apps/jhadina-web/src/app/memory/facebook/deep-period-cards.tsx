import React from "react"
import type { DeepPeriodObservation } from "@/lib/personality/facebook-owner-deep-periods"

/**
 * FB-RELATE.DEEP.07: non-interactive view; the only inputs are aggregated
 * numeric counts, fixed period labels and fixed categorical explanations.
 */
export function DeepPeriodCards({ periods }: { periods: readonly DeepPeriodObservation[] }) {
  const visible = periods.filter((period) => period.entries > 0)
  if (!visible.length) return <p className="jh-meta">No dated writing in the bounded sample.</p>
  return <div style={{
    display: "grid", gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 265px), 1fr))", marginTop: 12,
  }}>
    {visible.map((period) => <article key={period.period} className="jh-item"
      aria-label={"Sample period " + period.period}>
      <strong>{period.period}</strong>
      <p className="jh-meta">{period.entries} sampled · {period.posts} posts · {period.comments} comments</p>
      {period.status === "insufficient-sampled-writing" ?
        <p className="jh-meta">Too few sampled entries to report wording proportions.</p> :
        period.indicators.length ? <div>
          {period.indicators.slice(0, 4).map((signal) => <div key={signal.id} style={{ marginTop: 10 }}>
            <p className="jh-meta">{signal.label}: {signal.count}/{signal.denominator} ({signal.percent}%)</p>
            <div aria-hidden="true" style={{
              height: 6, borderRadius: 4, background: "rgba(127,127,127,.17)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: Math.max(0, Math.min(100, signal.percent)) + "%",
                background: "#617b6e", borderRadius: 4,
              }} />
            </div>
          </div>)}
        </div> : <p className="jh-meta">No repeated fixed-rule indicators for this period.</p>}
    </article>)}
  </div>
}
