'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

type Idea = { topic: string; intent: 'transactional' | 'commercial' | 'informational'; issue: 'content' | 'technical' | 'conversion' | 'community' | 'repurpose'; page: string; impressions: string; clicks: string }
type Mission = { id: string; kind: string; title: string; stage: string; score: number; proposedXp: number; earnedXp: number; status: string; blockers: string[] }
type MissionResponse = { ok: boolean; error?: string; evidenceStatus?: string; data?: { missions: Mission[]; totalEarnedXp: number } }
type OwnedVenture = { id: string; title: string; lifecycle: string }
type SaveResponse = { ok: boolean; error?: string; queued?: number; blocked?: number; alreadyPresent?: number }
const emptyIdea: Idea = { topic: '', intent: 'transactional', issue: 'content', page: '', impressions: '', clicks: '' }
const panel = { border: '1px solid color-mix(in srgb, currentColor 20%, transparent)', borderRadius: 15, padding: 18 } as const
const field = { display: 'grid', gap: 5, fontSize: 13, minWidth: 190, flex: 1 } as const
const control = { color: 'inherit', background: 'transparent', border: '1px solid color-mix(in srgb, currentColor 35%, transparent)', borderRadius: 9, padding: '10px 11px', fontSize: 15, width: '100%' } as const
const primary = { border: '1px solid currentColor', background: 'transparent', color: 'inherit', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontWeight: 650 } as const

export default function BusinessGrowthMissionPage() {
  const [business, setBusiness] = useState('PupsonStuff')
  const [website, setWebsite] = useState('')
  const [draft, setDraft] = useState<Idea>(emptyIdea)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [preview, setPreview] = useState<MissionResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ownedVentures, setOwnedVentures] = useState<OwnedVenture[]>([])
  const [selectedVentureId, setSelectedVentureId] = useState('')
  const [lastSnapshot, setLastSnapshot] = useState<object | null>(null)
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/opportunities/ventures', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => { if (active && data.ok) setOwnedVentures((data.ventures ?? []) as OwnedVenture[]) })
      .catch(() => { /* unavailable runtime leaves the non-persistent preview usable */ })
    return () => { active = false }
  }, [])

  function saveIdea() {
    if (!draft.topic.trim()) return
    setIdeas(existing => [...existing, draft])
    setDraft(emptyIdea)
    setPreview(null)
  }
  async function generate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setPreview(null)
    setLastSnapshot(null)
    setSaveResponse(null)
    try {
      const id = business.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
      const now = new Date().toISOString()
      const source = draft.topic.trim() ? [...ideas, draft] : ideas
      const signals = source.map((idea, i) => ({
        id: 'idea-' + (i + 1),
        query: idea.topic,
        intent: idea.intent,
        issue: idea.issue,
        existingPageUrl: idea.page.trim() || undefined,
        impressions: idea.impressions.trim() ? Number(idea.impressions) : undefined,
        clicks: idea.clicks.trim() ? Number(idea.clicks) : undefined,
        evidenceRefs: ['manual:idea-' + (i + 1)],
      }))
      const snapshot = {
          businessId: id,
          ventureId: 'preview:' + id,
          siteUrl: website.trim(),
          observedAt: now,
          evidence: signals.map(signal => ({
            ref: signal.evidenceRefs[0], kind: 'manual', verified: false, observedAt: now,
          })),
          signals,
      }
      const response = await fetch('/api/business-growth/missions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
      })
      const body = await response.json() as MissionResponse
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Could not prepare missions')
      setPreview(body)
      setLastSnapshot(snapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare missions')
    } finally { setBusy(false) }
  }

  async function saveToPipeline() {
    if (!lastSnapshot || !selectedVentureId) return
    setSaving(true)
    setSaveResponse(null)
    try {
      const response = await fetch('/api/business-growth/missions/commit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...lastSnapshot, ventureId: selectedVentureId }),
      })
      const result = await response.json() as SaveResponse
      setSaveResponse(result)
    } catch {
      setSaveResponse({ ok: false, error: 'Could not reach the canonical venture ledger' })
    } finally { setSaving(false) }
  }

  return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 20px 90px' }}>
    <Link href="/opportunity/side-hustles" style={{ color: 'inherit', opacity: .7 }}>← Business Factory</Link>
    <header style={{ margin: '25px 0' }}>
      <p style={{ margin: 0, fontSize: 12, opacity: .55, letterSpacing: 1.5 }}>BUSINESS PIPELINE GAME / GROWTH MISSIONS</p>
      <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', margin: '8px 0' }}>Make every growth move count.</h1>
      <p style={{ maxWidth: 740, opacity: .73, lineHeight: 1.6 }}>
        Analyze a business, improve existing pages first, choose purchase-intent opportunities,
        and earn progress only after real commerce evidence. This begins as a planning preview.
        Saving is optional and creates only research work items for an existing owned venture; no provider is connected and no site or social account is modified.
      </p>
    </header>
    <form onSubmit={generate} style={{ display: 'grid', gap: 16 }}>
      <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 21 }}>1. Select the business</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={field}>Business name
            <input style={control} value={business} maxLength={100} required onChange={event => setBusiness(event.target.value)} />
          </label>
          <label style={field}>Owned website
            <input style={control} type="url" value={website} placeholder="https://yourstore.com" required onChange={event => setWebsite(event.target.value)} />
          </label>
        </div>
        <p style={{ fontSize: 12, opacity: .62 }}>This board accepts manual ideas without claiming first-party proof. Selecting an owned venture below may save only planning tasks; trusted Search Console verification still requires provider integration.</p>
      </section>
      <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 21 }}>2. Add buyer searches and site opportunities</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ ...field, flex: 2 }}>Search phrase or issue
            <input style={control} value={draft.topic} placeholder="custom pet memorial canvas" onChange={event => setDraft(s => ({ ...s, topic: event.target.value }))} />
          </label>
          <label style={field}>Intent
            <select style={control} value={draft.intent} onChange={event => setDraft(s => ({ ...s, intent: event.target.value as Idea['intent'] }))}>
              <option value="transactional">Ready to buy</option>
              <option value="commercial">Comparing products</option>
              <option value="informational">Research only</option>
            </select>
          </label>
          <label style={field}>Type of mission
            <select style={control} value={draft.issue} onChange={event => setDraft(s => ({ ...s, issue: event.target.value as Idea['issue'] }))}>
              <option value="content">Search/content opportunity</option>
              <option value="technical">Technical audit issue</option>
              <option value="conversion">Landing-page conversion fix</option>
              <option value="community">Relevant community conversation</option>
              <option value="repurpose">Repurpose original content</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          <label style={{ ...field, flex: 2 }}>Existing page (optional)
            <input style={control} type="url" value={draft.page} placeholder="https://yourstore.com/products/example" onChange={event => setDraft(s => ({ ...s, page: event.target.value }))} />
          </label>
          <label style={field}>Impressions (if known)
            <input style={control} type="number" min="0" value={draft.impressions} placeholder="unknown" onChange={event => setDraft(s => ({ ...s, impressions: event.target.value }))} />
          </label>
          <label style={field}>Clicks (if known)
            <input style={control} type="number" min="0" value={draft.clicks} placeholder="unknown" onChange={event => setDraft(s => ({ ...s, clicks: event.target.value }))} />
          </label>
        </div>
        <button type="button" onClick={saveIdea} disabled={!draft.topic.trim()} style={{ ...primary, marginTop: 14 }}>Add another opportunity</button>
        {ideas.length > 0 ? <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, opacity: .65 }}>{ideas.length} saved locally for this preview</p>
          {ideas.map((idea, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
            <span>{idea.topic} · {idea.intent}</span>
            <button type="button" onClick={() => { setIdeas(rows => rows.filter((_, j) => j !== i)); setPreview(null) }}
              style={{ border: 0, color: 'inherit', background: 'transparent', textDecoration: 'underline', cursor: 'pointer' }}>Remove</button>
          </div>)}
        </div> : null}
      </section>
      <button type="submit" style={{ ...primary, padding: 15 }} disabled={busy || !business.trim() || !website.trim()}>
        {busy ? 'Analyzing preview…' : 'Generate growth missions'}
      </button>
    </form>
    {error && <p role="alert" style={{ marginTop: 20 }}>Unable to generate: {error}</p>}
    {preview?.data && <section style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 26 }}>3. Mission board</h2>
      <p style={{ opacity: .7, maxWidth: 820, lineHeight: 1.5 }}>
        Manual inputs are unverified, so publishing missions stay evidence-blocked.
        Score represents review priority, not expected traffic or revenue.
        Potential XP is not earned XP. Earned XP: {preview.data.totalEarnedXp}.
      </p>
      <section style={{ ...panel, margin: '16px 0', display: 'grid', gap: 10 }}>
        <strong>Save planning work to the existing Business Pipeline (optional)</strong>
        <p style={{ margin: 0, fontSize: 13, opacity: .7 }}>Only existing owner-scoped ventures can receive tasks. Saving never dispatches Marisa, opens a social account or authorizes publication. Already recorded tasks are not overwritten.</p>
        <label style={field}>Select the canonical venture
          <select style={control} value={selectedVentureId} onChange={event => setSelectedVentureId(event.target.value)}>
            <option value="">Preview only — do not save</option>
            {ownedVentures.filter(v => !['killed', 'archived', 'paused'].includes(v.lifecycle)).map(v =>
              <option key={v.id} value={v.id}>{v.title} · {v.id}</option>)}
          </select>
        </label>
        <div><button type="button" onClick={() => void saveToPipeline()} disabled={!selectedVentureId || !lastSnapshot || saving} style={primary}>
          {saving ? 'Saving planning tasks…' : 'Queue review missions in Business Pipeline'}
        </button></div>
        {saveResponse && <p role="status" style={{ margin: 0, fontSize: 13 }}>{saveResponse.ok
          ? `Saved: ${saveResponse.queued ?? 0} review tasks, ${saveResponse.blocked ?? 0} evidence-blocked tasks; ${saveResponse.alreadyPresent ?? 0} already present.`
          : `Not saved: ${saveResponse.error ?? 'unknown error'}`}</p>}
        {!ownedVentures.length && <p style={{ margin: 0, fontSize: 12, opacity: .6 }}>No owned ventures were returned, or the venture runtime is unavailable. You can still use the preview.</p>}
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 18 }}>
        {preview.data.missions.map(mission => <article key={mission.id} style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, letterSpacing: 1, opacity: .65 }}>{mission.stage} · {mission.kind.replace(/_/g, ' ')}</span>
            <span style={{ fontWeight: 700 }}>{mission.score}/100</span>
          </div>
          <h3 style={{ fontSize: 18, lineHeight: 1.35, margin: '13px 0 8px' }}>{mission.title}</h3>
          <p style={{ fontSize: 13, opacity: .75 }}>{mission.status === 'review_ready' ? 'Research task ready for owner review' : 'Blocked pending provider evidence'}</p>
          {mission.blockers.length > 0 && <ul style={{ fontSize: 13, opacity: .7, paddingLeft: 18 }}>{mission.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
          <p style={{ fontSize: 12, opacity: .62, marginBottom: 0 }}>Potential {mission.proposedXp} XP · 0 earned · zero spend · approval required</p>
        </article>)}
      </div>
    </section>}
  </main>
}
