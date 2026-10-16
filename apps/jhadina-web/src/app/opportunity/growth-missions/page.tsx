'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

type Idea = { topic: string; intent: 'transactional' | 'commercial' | 'informational'; issue: 'content' | 'technical' | 'conversion' | 'community' | 'repurpose'; page: string; impressions: string; clicks: string }
type Mission = { id: string; kind: string; title: string; stage: string; score: number; proposedXp: number; earnedXp: number; status: string; blockers: string[] }
type MissionResponse = { ok: boolean; error?: string; evidenceStatus?: string; data?: { missions: Mission[]; totalEarnedXp: number } }
type OwnedVenture = { id: string; title: string; lifecycle: string }
type SaveResponse = { ok: boolean; error?: string; queued?: number; blocked?: number; alreadyPresent?: number }
type ExperimentView = { id: string; startDate: string; endDate: string; hypothesis: string; status: string; checkpoints: Array<{ day: number; date: string; phase: string; deliverable: string }> }
type ExperimentResponse = { ok: boolean; experiment?: ExperimentView; error?: string }
type LiveReadiness = { ok:boolean;error?:string;liveCommissioningCertified?:boolean;gates?:Array<{code:string;title:string;status:string;missing:string}> }
type ResearchPreview = {ok:boolean;mode?:string;error?:string;summary?:{
  totalSamples?:number;brandMentionSamples?:number;ownedSiteCitationSamples?:number;
  outsideCitationDomains?:string[];action?:string;intent?:string;
  unverifiedCompetitorDomains?:string[];buyerQuestions?:string[];
}}
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
  const [experiment, setExperiment] = useState<ExperimentView | null>(null)
  const [experimentError, setExperimentError] = useState('')
  const [experimentBusy, setExperimentBusy] = useState(false)
  const [experimentSaving, setExperimentSaving] = useState(false)
  const [experimentSaved, setExperimentSaved] = useState('')
  const [experimentHypothesis, setExperimentHypothesis] = useState('Optimizing existing buyer-intent pages will produce attributable net-positive commercial outcomes.')
  const [liveReadiness, setLiveReadiness] = useState<LiveReadiness | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('Where can I buy a custom dog portrait?')
  const [aiEngine, setAiEngine] = useState<'chatgpt'|'gemini'|'perplexity'>('chatgpt')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiCitationUrls, setAiCitationUrls] = useState('')
  const [serpQuery, setSerpQuery] = useState('buy personalized dog portrait')
  const [serpResults, setSerpResults] = useState('')
  const [researchPreview, setResearchPreview] = useState<ResearchPreview | null>(null)
  const [researchBusy, setResearchBusy] = useState(false)

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

  async function generateExperimentPlan() {
    setExperimentBusy(true)
    setExperimentError('')
    setExperimentSaved('')
    try {
      const localDate = new Date()
      const startDate = [localDate.getFullYear(), String(localDate.getMonth()+1).padStart(2,'0'), String(localDate.getDate()).padStart(2,'0')].join('-')
      const response = await fetch('/api/business-growth/experiment/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId:business, startDate,
          hypothesis: experimentHypothesis,
        }),
      })
      const body = await response.json() as ExperimentResponse
      if (!response.ok || !body.ok || !body.experiment) throw new Error(body.error || 'Unable to plan experiment')
      setExperiment(body.experiment)
    } catch(cause) {
      setExperimentError(cause instanceof Error ? cause.message : 'Unable to plan experiment')
    } finally {
      setExperimentBusy(false)
    }
  }

  async function checkLiveReadiness() {
    if (!selectedVentureId) return
    setLiveReadiness(null)
    setLiveBusy(true)
    try {
      const response=await fetch('/api/business-growth/live-readiness?ventureId='+encodeURIComponent(selectedVentureId),
        {cache:'no-store'})
      const payload=await response.json() as LiveReadiness
      setLiveReadiness(payload)
    } catch {
      setLiveReadiness({ok:false,error:'Commissioning status endpoint unavailable'})
    } finally { setLiveBusy(false) }
  }

  async function previewEvidenceResearch(mode:'AI_VISIBILITY'|'SERP_INTENT') {
    setResearchBusy(true)
    setResearchPreview(null)
    try {
      const observedAt=new Date().toISOString()
      const body=mode==='AI_VISIBILITY' ? {
        mode,site:website,brand:business,
        observations:[{id:'manually-pasted-answer',engine:aiEngine,market:'en-US',
          prompt:aiPrompt,answer:aiAnswer,observedAt,source:'MANUAL_UNVERIFIED',
          sourceRef:'user:pasted-answer',
          citations:aiCitationUrls.split(/\r?\n/).map(value=>value.trim()).filter(Boolean).slice(0,20)}],
      } : {
        mode,site:website,ownedPages:[],validatedOfferIds:[],
        snapshot:{query:serpQuery,market:'en-US',observedAt,source:'MANUAL_UNVERIFIED',
          sourceRef:'user:pasted-serp',
          organic:serpResults.split(/\r?\n/).map(value=>value.trim())
            .filter(Boolean).slice(0,20).map((url,index)=>({url,position:index+1})),
          peopleAlsoAsk:[],relatedSearches:[]},
      }
      const response=await fetch('/api/business-growth/research-preview', {
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
      })
      const data=await response.json() as ResearchPreview
      setResearchPreview(data)
    } catch {
      setResearchPreview({ok:false,error:'Research preview service unavailable'})
    } finally {setResearchBusy(false)}
  }

  async function queueExperimentPlan() {
    if (!experiment || !selectedVentureId) return
    setExperimentSaving(true)
    setExperimentSaved('')
    try {
      const response = await fetch('/api/business-growth/experiment/commit', {
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          ventureId:selectedVentureId,startDate:experiment.startDate,hypothesis:experiment.hypothesis,
        }),
      })
      const result = await response.json() as {
        ok:boolean;error?:string;insertedPlanningTasks?:number;alreadyPresent?:number
      }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Unable to save')
      setExperimentSaved('Saved ' + result.insertedPlanningTasks + ' planning checkpoints; ' + result.alreadyPresent + ' already present. No background workers or external actions started.')
    } catch (cause) {
      setExperimentSaved('Plan not saved: ' + (cause instanceof Error ? cause.message : 'unknown error'))
    } finally { setExperimentSaving(false) }
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
    <section style={{ ...panel, marginTop: 28 }}>
      <p style={{ fontSize: 12, letterSpacing: 1.2, opacity: .6 }}>LIVE COMMISSIONING</p>
      <h2 style={{ margin: '7px 0 10px', fontSize: 24 }}>Verify the six live growth gates</h2>
      <p style={{ maxWidth: 780, opacity: .74, lineHeight: 1.5 }}>
        Check the canonical owned venture, Google search property, audited content, approval,
        provider delivery, and reconciled order before calling a growth cycle live.
        This probe is read-only and does not authorize publishing.
      </p>
      <button type="button" style={primary} disabled={!selectedVentureId || liveBusy}
        onClick={() => void checkLiveReadiness()}>
        {liveBusy ? 'Reading commissioning status…' : 'Check selected venture readiness'}
      </button>
      {!selectedVentureId && <p style={{ fontSize: 13, opacity: .65 }}>Select an existing venture in the mission board above.</p>}
      {liveReadiness && <div role="status" style={{ marginTop: 14 }}>
        {!liveReadiness.ok ? <p>Live readiness unavailable: {liveReadiness.error ?? 'unknown error'}</p> :
          <>
            <p style={{ fontSize: 13, opacity: .7 }}>Not certified: no actual provider and commerce receipt chain has been established by this probe.</p>
            <ol style={{ display:'grid', gap: 9, paddingLeft: 24 }}>
              {liveReadiness.gates?.map(gate => <li key={gate.code}>
                <strong>{gate.code} · {gate.title} — {gate.status}</strong>
                <div style={{ fontSize: 13, opacity: .7 }}>{gate.missing}</div>
              </li>)}
            </ol>
          </>}
      </div>}
    </section>

    <section style={{ ...panel, marginTop: 28 }}>
      <p style={{ fontSize: 12, letterSpacing: 1.2, opacity: .6 }}>AI SEARCH & BUYER INTENT</p>
      <h2 style={{ margin: '7px 0 10px', fontSize: 24 }}>Research AI mentions and search gaps</h2>
      <p style={{ maxWidth: 780, opacity:.75 }}>
        Paste observed answers or search-result URLs for a no-charge, read-only research preview.
        These are manually supplied notes—not verified provider responses, search rankings, citations, or earned XP.
      </p>
      <div style={{display:'grid',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))'}}>
        <div style={{display:'grid',gap:10}}>
          <strong>AI visibility sample</strong>
          <label style={field}>AI engine
            <select style={control} value={aiEngine} onChange={event=>setAiEngine(event.target.value as typeof aiEngine)}>
              <option value="chatgpt">ChatGPT</option><option value="gemini">Gemini</option><option value="perplexity">Perplexity</option>
            </select>
          </label>
          <label style={field}>Original prompt
            <input style={control} value={aiPrompt} onChange={event=>setAiPrompt(event.target.value)}/>
          </label>
          <label style={field}>Answer text (manual sample)
            <textarea style={control} rows={4} value={aiAnswer} onChange={event=>setAiAnswer(event.target.value)}/>
          </label>
          <label style={field}>Citation URLs, one per line
            <textarea style={control} rows={3} value={aiCitationUrls} onChange={event=>setAiCitationUrls(event.target.value)}/>
          </label>
          <div><button type="button" style={primary} disabled={!website.trim() || !business.trim() || !aiPrompt.trim() || !aiAnswer.trim() || researchBusy}
            onClick={() => void previewEvidenceResearch('AI_VISIBILITY')}>Check manually observed AI answer</button></div>
        </div>
        <div style={{display:'grid',gap:10,alignContent:'start'}}>
          <strong>Search-intent sample</strong>
          <label style={field}>Search query
            <input style={control} value={serpQuery} onChange={event=>setSerpQuery(event.target.value)}/>
          </label>
          <label style={field}>Observed result URLs, ordered (one per line)
            <textarea style={control} rows={5} value={serpResults} onChange={event=>setSerpResults(event.target.value)}/>
          </label>
          <div><button type="button" style={primary} disabled={!website.trim() || !serpQuery.trim() || !serpResults.trim() || researchBusy}
            onClick={() => void previewEvidenceResearch('SERP_INTENT')}>Classify manual search sample</button></div>
        </div>
      </div>
      {researchPreview && <div role="status" style={{marginTop:15}}>
        {!researchPreview.ok ? <p>Research preview unavailable: {researchPreview.error ?? 'invalid source evidence'}</p> : <>
          <p style={{fontWeight:650}}>Manual, unverified research only — no tasks, posts or XP were created.</p>
          {researchPreview.mode==='AI_VISIBILITY' ? <>
            <p>{researchPreview.summary?.brandMentionSamples ?? 0} of {researchPreview.summary?.totalSamples ?? 0} submitted answer samples mention the brand; {researchPreview.summary?.ownedSiteCitationSamples ?? 0} cite the entered site.</p>
            <p style={{fontSize:13,opacity:.75}}>Other domains to research: {researchPreview.summary?.outsideCitationDomains?.join(', ') || 'none in this sample'}</p>
          </> : <>
            <p>Inferred intent: {researchPreview.summary?.intent ?? 'unknown'}. Review action: {researchPreview.summary?.action ?? 'research only'}.</p>
            <p style={{fontSize:13,opacity:.75}}>External domains observed: {researchPreview.summary?.unverifiedCompetitorDomains?.join(', ') || 'none in this sample'}</p>
          </>}
        </>}
      </div>}
    </section>

    <section style={{ ...panel, marginTop: 28 }}>
      <p style={{ fontSize: 12, letterSpacing: 1.2, opacity: .6 }}>30-DAY GROWTH EXPERIMENT</p>
      <h2 style={{ margin: '7px 0 10px', fontSize: 24 }}>Plan the next 30 days</h2>
      <p style={{ maxWidth: 760, opacity: .75, lineHeight: 1.5 }}>
        Site evidence → existing-page fixes → researched drafts → owner-approved distribution → actual settled contribution.
        No automatic posting, new subscriptions or ad spending. This schedule is a preview and does not launch background workers.
      </p>
      <label style={{ ...field, marginBottom: 14 }}>Hypothesis
        <input style={control} value={experimentHypothesis} maxLength={500}
          onChange={event=>setExperimentHypothesis(event.target.value)} />
      </label>
      <button type="button" onClick={() => void generateExperimentPlan()} disabled={experimentBusy || !business.trim() || !experimentHypothesis.trim()} style={primary}>
        {experimentBusy ? 'Preparing 30-day plan…' : 'Create 30-day Growth experiment'}
      </button>
      {experimentError && <p role="alert">{experimentError}</p>}
      {experiment && <div style={{ marginTop: 18 }}>
        <p style={{ fontSize: 13, opacity: .7 }}>Planning only · {experiment.startDate} through {experiment.endDate}. Publishing and all financial actions are blocked until separately approved.</p>
        <ol style={{ display: 'grid', gap: 10, paddingLeft: 25 }}>
          {experiment.checkpoints.map(checkpoint => <li key={checkpoint.day}>
            <strong>Day {checkpoint.day} · {checkpoint.phase.replace(/_/g, ' ')}</strong>
            <div style={{ fontSize: 13, opacity: .7 }}>{checkpoint.date} — {checkpoint.deliverable}</div>
          </li>)}
        </ol>
        <div style={{borderTop:'1px solid color-mix(in srgb, currentColor 18%, transparent)',paddingTop:14}}>
          <p style={{fontSize:13,opacity:.7}}>Optionally queue these review checkpoints for the selected owned venture in Step 3. Planning work is not scheduled execution.</p>
          <button type="button" style={primary} disabled={!selectedVentureId || experimentSaving}
            onClick={() => void queueExperimentPlan()}>
            {experimentSaving ? 'Saving checkpoints…' : 'Queue 30-day planning checkpoints'}
          </button>
          {experimentSaved && <p role="status" style={{fontSize:13}}>{experimentSaved}</p>}
        </div>
      </div>}
    </section>
  </main>
}
