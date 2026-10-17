import Link from "next/link"
import ResearchNotebook from "./ResearchNotebook"
import styles from "./campaign.module.css"

const areas = [
  { name: "Policy & solutions", status: "Working notebook", text: "Compare evidence, alternatives, costs and measurable public outcomes.", href: "#notebook" },
  { name: "Public polling", status: "No source connected", text: "Inspect methodology and comparable samples. No invented candidate numbers.", href: "/campaign/polls" },
  { name: "Campaign administration", status: "Needs verification", text: "Candidate status, committee records, filing history and ballot-access deadlines need original records.", href: "#readiness" },
]

export default function CampaignPage() {
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>CampaignOS / Research foundation</span>
      <h1>Political<br />Juggernaut</h1>
      <p className={styles.lead}>Understand the problem. Test the options. Keep the receipts.</p>
      <p>A workspace for public-policy research and accountable preparation. Build positions you can explain and outcomes you can measure.</p>
      <a className={styles.button} href="#notebook">Open policy workshop</a>
    </header>
    <nav className={styles.grid} aria-label="Campaign workspace">
      {areas.map(area => <Link href={area.href} className={styles.cardLink} key={area.name}>
        <span className={styles.eyebrow}>{area.status}</span><h2>{area.name}</h2><p>{area.text}</p><span aria-hidden="true">Explore →</span>
      </Link>)}
    </nav>
    <section className={styles.card} aria-labelledby="cabinet-title">
      <span className={styles.eyebrow}>One Jhadina · shared responsibilities</span>
      <h2 id="cabinet-title">The research desk</h2>
      <dl className={styles.roles}>
        <div><dt>JANET / Context</dt><dd>Preserve sourced history, decisions and corrections.</dd></div>
        <div><dt>DELIA / Analysis</dt><dd>Compare options, challenge assumptions and expose uncertainty.</dd></div>
        <div><dt>MARISA / Operations</dt><dd>Prepare reviewable tasks and track verified outcomes.</dd></div>
      </dl>
      <p>These are the existing Jhadina roles. Their live CampaignOS integration is pending; this page does not run autonomous agents.</p>
    </section>
    <ResearchNotebook />
    <section className={styles.card} id="readiness" aria-labelledby="readiness-title">
      <span className={styles.eyebrow}>What comes next</span><h2 id="readiness-title">Evidence before activation</h2>
      <ol className={styles.steps}>
        <li><strong>Recover and reconcile.</strong> Preserve the historical plan and selectively review the older intelligence branch.</li>
        <li><strong>Verify organizational boundaries.</strong> Keep charitable service and candidate campaign operations distinct. Entity status and registrations are unverified.</li>
        <li><strong>Connect original sources.</strong> Retain dates, methodology, contradictions and freshness. A configured source is not a successful collection.</li>
        <li><strong>Prove private persistence.</strong> Authenticate ownership, test isolation and recovery, then verify a complete phone workflow.</li>
      </ol>
      <p>No live collector, filing submission, fundraising, publishing or outreach is connected here.</p>
      <details><summary>Official compliance references</summary>
        <p>These are reference materials, not a determination of your organization&apos;s status.</p>
        <ul>
          <li><a href="https://www.irs.gov/charities-non-profits/charitable-organizations/restriction-of-political-campaign-intervention-by-section-501c3-tax-exempt-organizations">IRS: charitable organizations and campaign intervention</a></li>
          <li><a href="https://www.fec.gov/help-candidates-and-committees/registering-candidate/testing-the-waters-possible-candidacy/">FEC: testing the waters and recordkeeping</a></li>
          <li><a href="https://www.fec.gov/help-candidates-and-committees/filing-reports/registering-candidate/">FEC: candidate registration</a></li>
        </ul>
      </details>
    </section>
  </div></main>
}
