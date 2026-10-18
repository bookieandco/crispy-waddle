"use client"

import { useState } from "react"
import {
  HISTORY_CASES, HISTORY_SOURCES, historySourcesForClaim, type HistoricalCase
} from "../../../lib/campaign/history"
import styles from "../campaign.module.css"

type CaseId = HistoricalCase["id"]

export default function HistoryExplorer() {
  const [selected, setSelected] = useState<CaseId>("weimar")
  const active = HISTORY_CASES.find(item => item.id === selected) ?? HISTORY_CASES[0]
  return <section className={styles.card} aria-labelledby="history-explorer-title">
    <span className={styles.eyebrow}>Comparative history / original source links</span>
    <h2 id="history-explorer-title">Explore the cases</h2>
    <p>Compare public organization and institutional outcomes without copying authoritarian tactics. These are edited historical summaries, not live intelligence or electoral forecasts.</p>
    <label className={styles.field} htmlFor="history-case-select">Case study
      <select id="history-case-select" value={selected} onChange={event => setSelected(event.target.value as CaseId)}>
        {HISTORY_CASES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
    <div className={styles.grid} aria-label="Case overview">
      <article className={styles.card}>
        <span className={styles.eyebrow}>Place and time</span>
        <h3>{active.place}</h3><p>{active.period}</p>
      </article>
      <article className={styles.card}>
        <span className={styles.eyebrow}>Historical classification</span>
        <h3>{active.frame === "DEMOCRATIC_COLLAPSE" ? "Democratic collapse" : "Civic change"}</h3>
        <p>This is a descriptive analytical category, not a ranking of political figures.</p>
      </article>
    </div>
    <h3>Historical context</h3><p>{active.context}</p>
    <h3>Institutional outcome</h3><p>{active.outcome}</p>
    <h3>Public safeguards</h3><p>{active.guardrail}</p>
    <h3>Evidence cards</h3>
    {active.claims.map(claim => <article className={styles.card} key={claim.id}>
      <span className={styles.eyebrow}>{claim.kind === "DOCUMENTED_EVENT" ? "Sourced historical event" : "Interpretive research question"} · {claim.period}</span>
      <p>{claim.text}</p>
      <p><strong>Context and limits:</strong> {claim.limitation}</p>
      <p><strong>References:</strong> {historySourcesForClaim(claim).map((source, i) => <span key={source.id}>{i > 0 ? " · " : ""}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher}: {source.title}</a></span>)}</p>
    </article>)}
    <h3>Questions to investigate</h3>
    <ol className={styles.steps}>{active.questions.map(question => <li key={question}>{question}</li>)}</ol>
    <details>
      <summary>Full source catalog and freshness limitations</summary>
      <p>Manually reviewed on October 18, 2026. A URL is a reference, not a live connection. Multiple pages from one publisher do not constitute independent corroboration. Historical cases are not population-matched comparisons.</p>
      <ul>{HISTORY_SOURCES.map(source => <li key={source.id}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> — {source.publisher}, {source.scope === "HISTORICAL_REFERENCE" ? "historical research" : "current guidance (recheck before use)"}
      </li>)}</ul>
    </details>
  </section>
}
