import { assessIssue, type EvidenceRecord } from "../../../lib/campaign/intelligence"

const evidence: EvidenceRecord[] = [
  {
    id: "demo-affordability-1",
    kind: "public_opinion",
    source: "Public opinion sample",
    sourceUrl: "https://example.com/evidence/affordability",
    publishedAt: "2026-08-01",
    geography: "National",
    issue: "affordability",
    claim: "Households report pressure from the cost of essentials.",
    confidence: "high",
  },
  {
    id: "demo-affordability-2",
    kind: "official_statistic",
    source: "Official statistics sample",
    sourceUrl: "https://example.com/evidence/economy",
    publishedAt: "2026-08-05",
    geography: "National",
    issue: "affordability",
    claim: "Prices and household budgets remain an important economic signal.",
    confidence: "high",
  },
]

export default function CampaignIntelligencePage() {
  const assessment = assessIssue(evidence, "affordability")

  return (
    <main style={{ minHeight: "100vh", padding: "32px 20px 110px", fontFamily: "system-ui", background: "#f7f8f6" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <p style={{ opacity: 0.55, marginBottom: 6 }}>CampaignOS</p>
        <h1 style={{ marginTop: 0 }}>Issue Intelligence</h1>
        <p style={{ maxWidth: 760, lineHeight: 1.6 }}>
          Jhadina translates public evidence into problems that can be measured,
          worked on and reviewed. It does not turn evidence into individual
          persuasion instructions or automatically change campaign actions.
        </p>

        <section style={{ marginTop: 24, padding: 24, borderRadius: 20, background: "white", border: "1px solid #dde2dc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ opacity: 0.55 }}>Issue</div>
              <h2 style={{ margin: "4px 0" }}>{assessment.issue}</h2>
            </div>
            <div><div style={{ opacity: 0.55 }}>Evidence</div><strong>{assessment.evidenceCount}</strong></div>
            <div><div style={{ opacity: 0.55 }}>Confidence</div><strong>{assessment.confidence}</strong></div>
            <div><div style={{ opacity: 0.55 }}>Signal</div><strong>{assessment.signal}</strong></div>
          </div>
        </section>

        <section style={{ marginTop: 18, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          <article style={{ padding: 22, borderRadius: 20, background: "white", border: "1px solid #dde2dc" }}>
            <h3>Jhadina translation</h3>
            <p style={{ lineHeight: 1.6 }}>{assessment.problemStatement}</p>
          </article>
          <article style={{ padding: 22, borderRadius: 20, background: "white", border: "1px solid #dde2dc" }}>
            <h3>Move from talk → work</h3>
            <ol style={{ lineHeight: 1.7, paddingLeft: 22 }}>
              {assessment.improvementAreas.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </article>
        </section>

        <section style={{ marginTop: 18, padding: 22, borderRadius: 20, background: "white", border: "1px solid #dde2dc" }}>
          <h3>Evidence ledger</h3>
          {evidence.map((item) => (
            <div key={item.id} style={{ padding: "14px 0", borderTop: "1px solid #edf0eb" }}>
              <strong>{item.source}</strong>
              <div style={{ opacity: 0.7 }}>{item.claim}</div>
              <small>{item.publishedAt} · {item.geography} · confidence: {item.confidence}</small>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
