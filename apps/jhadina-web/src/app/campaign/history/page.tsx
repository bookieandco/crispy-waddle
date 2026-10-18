import Link from "next/link"
import HistoryExplorer from "./HistoryExplorer"
import { CIVIC_REFERENCE_NOTES, HISTORY_GUARDRAILS, HISTORY_SOURCES, HISTORY_AS_OF } from "../../../lib/campaign/history"
import styles from "../campaign.module.css"

export default function CampaignHistoryPage() {
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>CampaignOS / Historical intelligence / Read only</span>
      <h1>Power, movements<br />& democracy</h1>
      <p className={styles.lead}>Study historical pathways to political change and the safeguards that keep public power accountable.</p>
      <p>Manually reviewed sources as of {HISTORY_AS_OF}. No personalized persuasion, political advertising, campaign approval or background collectors.</p>
      <Link href="/campaign" className={styles.button}>Back to CampaignOS</Link>
    </header>
    <HistoryExplorer />
    <section className={styles.card} aria-labelledby="guardrails-title">
      <span className={styles.eyebrow}>Safety and civic accountability</span>
      <h2 id="guardrails-title">Non-negotiable boundaries</h2>
      <ul>{HISTORY_GUARDRAILS.map(guardrail => <li key={guardrail}>{guardrail}</li>)}</ul>
    </section>
    <section className={styles.card} aria-labelledby="institutions-title">
      <span className={styles.eyebrow}>United States civic institutions / Not legal advice</span>
      <h2 id="institutions-title">Current-process references</h2>
      <p>Historical German parliamentary events must never be used as a model of US presidential legal authority. Always recheck official guidance before making filings or determining charitable status.</p>
      <ul>{CIVIC_REFERENCE_NOTES.map(note => {
        const source = HISTORY_SOURCES.find(item => item.id === note.sourceId)
        return <li key={note.sourceId}><strong>{note.label}:</strong> {note.text} {source && <a href={source.url} target="_blank" rel="noopener noreferrer">Official source</a>}</li>
      })}</ul>
      <p>This page does not verify eligibility, candidate status, ballot access, nonprofit status, FEC filings or actual organizational registrations.</p>
    </section>
  </div></main>
}
