"use client"

import { useState } from "react"
import { EMPTY_NOTEBOOK, RESEARCH_TOPICS, exportResearchNotebook, type ResearchNotebook as Notebook, type ResearchTopic } from "../../lib/campaign/research-notebook"
import styles from "./campaign.module.css"

const fields: { key: Exclude<keyof Notebook, "topic">; label: string; hint: string }[] = [
  { key: "problem", label: "What problem needs solving?", hint: "Describe the condition, jurisdiction and time period. Separate what you observed from what you suspect." },
  { key: "evidence", label: "Sources and observations", hint: "Record original URLs, publication dates, units, methodology and exact claims. A link alone does not verify a claim." },
  { key: "alternatives", label: "Options and decision-makers", hint: "Compare possible interventions, including the current approach. Who has authority to implement each?" },
  { key: "tradeoffs", label: "Costs and trade-offs", hint: "Identify resources, constraints, possible harms and unanswered questions." },
  { key: "counterevidence", label: "What challenges the idea?", hint: "Preserve contradictory sources, alternative explanations and what would change your mind." },
  { key: "outcomes", label: "How would we know it worked?", hint: "Define a baseline, measurable public outcome, review date and responsible reviewer." },
]

export default function ResearchNotebook() {
  const [note, setNote] = useState<Notebook>({ ...EMPTY_NOTEBOOK })
  const [message, setMessage] = useState("")
  const hasNotes = fields.some(({ key }) => note[key].trim())
  function download() {
    const blob = new Blob([exportResearchNotebook(note, new Date().toISOString())], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url; anchor.download = "political-research-draft.json"
    document.body.appendChild(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage("Draft export requested. Check your downloads. Nothing was submitted or published.")
  }
  return <section className={styles.card} id="notebook" aria-labelledby="notebook-title">
    <span className={styles.eyebrow}>Policy workshop · working draft</span>
    <h2 id="notebook-title">Build a position from evidence</h2>
    <p id="storage-note">Notes stay in this tab&apos;s memory only. Export before leaving or reloading. There is no cloud save or automatic source verification.</p>
    <label className={styles.field}>Research topic
      <select value={note.topic} onChange={event => setNote({ ...note, topic: event.target.value as ResearchTopic })}>
        {RESEARCH_TOPICS.map(topic => <option key={topic}>{topic}</option>)}
      </select>
    </label>
    {fields.map(({ key, label, hint }) => <label className={styles.field} key={key}>{label}
      <span id={`${key}-hint`} className={styles.hint}>{hint}</span>
      <textarea value={note[key]} rows={3} maxLength={12000} aria-describedby={`${key}-hint storage-note`}
        onChange={event => { setNote({ ...note, [key]: event.target.value }); setMessage("") }} />
    </label>)}
    <button className={styles.button} onClick={download} disabled={!hasNotes}>Export working draft</button>
    <p role="status" aria-live="polite">{message}</p>
  </section>
}
