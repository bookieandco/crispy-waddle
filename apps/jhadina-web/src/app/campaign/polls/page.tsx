import Link from "next/link"

export default function CampaignPollsPage() {
  return <main style={{ minHeight: "100vh", padding: "32px 20px 130px", background: "#f7f4ef", color: "#1e2923" }}>
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Link href="/campaign">← Political Juggernaut</Link>
      <h1>Poll Intelligence</h1>
      <p>Public polling is one evidence stream. It is not a prediction of victory.</p>
      <section style={{ padding: 24, background: "white", border: "1px solid #d6dfd7", borderRadius: 20 }}>
        <h2>No verified polling connected</h2>
        <p>No candidate support percentage or trend is available. The previous example numbers have been removed.</p>
        <p>Before importing: retain the original source, field dates, sample size, surveyed population, question wording and methodology. Review duplicate samples and conflicting findings.</p>
        <p>Import and live collection are not commissioned. Social engagement must remain separate from population polling.</p>
      </section>
    </div>
  </main>
}
