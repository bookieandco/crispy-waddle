import { summarizePolls, type PollRecord } from "../../../lib/campaign/polling"

const demoPolls: PollRecord[] = [
  { id: "demo-1", pollster: "Example Pollster", fieldStart: "2026-08-01", fieldEnd: "2026-08-03", geography: "National", sampleSize: 1000, population: "likely_voters", marginOfError: 3.1, candidate: "You", support: 42, sourceUrl: "https://example.com" },
  { id: "demo-2", pollster: "Example Pollster B", fieldStart: "2026-08-04", fieldEnd: "2026-08-06", geography: "National", sampleSize: 1200, population: "likely_voters", marginOfError: 2.9, candidate: "You", support: 44, sourceUrl: "https://example.com" },
]

export default function CampaignPollsPage() {
  const trend = summarizePolls(demoPolls, "You", "National")
  return (
    <main style={{ minHeight: "100vh", padding: "32px 20px 110px", fontFamily: "system-ui", background: "#f7f8f6" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ opacity: .55, marginBottom: 6 }}>CampaignOS</p>
        <h1 style={{ marginTop: 0 }}>📊 Poll Intelligence</h1>
        <p style={{ maxWidth: 680, lineHeight: 1.6 }}>Track public polling as one evidence stream. Jhadina summarizes methodology, recency and trend strength; it does not automatically change campaign actions.</p>
        <section style={{ marginTop: 24, padding: 22, borderRadius: 20, background: "white", border: "1px solid #dde2dc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div><strong>National — You</strong><div style={{ fontSize: 34, fontWeight: 800 }}>{trend.averageSupport?.toFixed(1)}%</div></div>
            <div><strong>Direction</strong><div>{trend.direction}</div><strong>Confidence</strong><div>{trend.confidence}</div></div>
            <div><strong>Polls</strong><div>{trend.pollCount}</div><strong>Action</strong><div>Review, don&apos;t auto-react</div></div>
          </div>
          {trend.warning && <p style={{ marginBottom: 0, color: "#765b00" }}>{trend.warning}</p>}
        </section>
      </div>
    </main>
  )
}
