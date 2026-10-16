'use client'

import Link from 'next/link'
import { simulateDisclosedTreasuryProfitTaking } from '@jhadina/opportunity-core/meme-profit-policy'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  MEME_SERVICE_THESIS,
  MEME_VENTURE_ACCEPTANCE,
  proposeMemeDemandExperiment,
  quoteMemeService,
  reviewMemeDraft,
  simulateMemePool,
  type MemeDraft,
  type MemeServiceTier,
} from '@jhadina/opportunity-core/meme-venture'

type SavedMemeDraft = {
  id: string
  revision: number
  ventureId: string | null
  payload: {
    draft: MemeDraft
    tier: MemeServiceTier
    laborHours: number
    laborRate: number
    otherCosts: number
    paperSol: number
    paperBuySol: number
    paperSellTokens: number
  }
  createdAt: string
  updatedAt: string
  authority: 'PAPER_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}
type EligibleMemeVenture = { id: string; title: string; opportunityId: string }

const starter: MemeDraft = {
  name: 'Cactus Astronaut',
  ticker: 'CACTUS',
  description: 'An original fictional space cactus exploring distant galaxies.',
  totalSupply: 1_000_000_000,
  poolSupplyPercent: 90,
  creatorSupplyPercent: 10,
  artworkRightsConfirmed: false,
  brandOriginalityConfirmed: false,
  allocationDisclosureConfirmed: false,
  liquidityTermsDisclosureConfirmed: false,
  truthfulPromotionConfirmed: false,
  noArtificialVolumeConfirmed: false,
  noGuaranteedReturnsConfirmed: false,
}

type ConfirmationKey = 'artworkRightsConfirmed' | 'brandOriginalityConfirmed' |
  'allocationDisclosureConfirmed' | 'liquidityTermsDisclosureConfirmed' |
  'truthfulPromotionConfirmed' | 'noArtificialVolumeConfirmed' | 'noGuaranteedReturnsConfirmed'

const confirmations: readonly { key: ConfirmationKey; title: string }[] = [
  { key: 'artworkRightsConfirmed', title: 'I own or have rights to use the proposed artwork.' },
  { key: 'brandOriginalityConfirmed', title: 'The brand is original and does not impersonate another project.' },
  { key: 'allocationDisclosureConfirmed', title: 'Creator allocations will be disclosed accurately.' },
  { key: 'liquidityTermsDisclosureConfirmed', title: 'Liquidity and withdrawal terms will be disclosed accurately.' },
  { key: 'truthfulPromotionConfirmed', title: 'No false scarcity, fake buyers, or misleading promotion.' },
  { key: 'noArtificialVolumeConfirmed', title: 'No wash trading, fake volume, or artificial market activity.' },
  { key: 'noGuaranteedReturnsConfirmed', title: 'No investment return or profit guarantees.' },
]

const panel: CSSProperties = {
  border: '1px solid rgba(160,160,160,.3)', borderRadius: 16, padding: 20,
  background: 'rgba(127,127,127,.045)',
}
const hint: CSSProperties = { fontSize: 13, opacity: .7, lineHeight: 1.5 }
const inputStyle: CSSProperties = {
  width: '100%', minHeight: 42, boxSizing: 'border-box', font: 'inherit', color: 'inherit',
  background: 'transparent', borderRadius: 9, border: '1px solid rgba(160,160,160,.55)',
  padding: '9px 12px', marginTop: 6,
}
const buttonStyle: CSSProperties = {
  background: '#c9ab7b', color: '#171717', border: 0, borderRadius: 10,
  padding: '12px 19px', fontWeight: 700, cursor: 'pointer',
}
function money(n: number): string { return Number.isFinite(n) ? '$' + n.toFixed(2) : 'Not available' }
function tokens(n: number): string { return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : 'Not available' }

export default function TokenCreatorStudio() {
  const [draft, setDraft] = useState<MemeDraft>(starter)
  const [tier, setTier] = useState<MemeServiceTier>('creation_prep')
  const [laborHours, setLaborHours] = useState(2)
  const [laborRate, setLaborRate] = useState(25)
  const [otherCosts, setOtherCosts] = useState(10)
  const [paperSol, setPaperSol] = useState(2)
  const [paperBuySol, setPaperBuySol] = useState(.1)
  const [paperSellTokens, setPaperSellTokens] = useState(20_000_000)
  const [showPaper, setShowPaper] = useState(false)
  const [showExperiment, setShowExperiment] = useState(false)
  const [showTreasuryPlan, setShowTreasuryPlan] = useState(false)
  const [assumePublicDisclosure, setAssumePublicDisclosure] = useState(false)
  const [assumedSolUsd, setAssumedSolUsd] = useState(175)
  const [paperTranchePercent, setPaperTranchePercent] = useState(0.05)

  const [savedDrafts, setSavedDrafts] = useState<SavedMemeDraft[]>([])
  const [eligibleVentures, setEligibleVentures] = useState<EligibleMemeVenture[]>([])
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedRevision, setSavedRevision] = useState<number | null>(null)
  const [linkedVentureId, setLinkedVentureId] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [syncError, setSyncError] = useState('')
  const [syncStatus, setSyncStatus] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [loadingDrafts, setLoadingDrafts] = useState(true)

  const currentPayload = useMemo(() => ({
    draft, tier, laborHours, laborRate, otherCosts, paperSol, paperBuySol, paperSellTokens,
  }), [draft, tier, laborHours, laborRate, otherCosts, paperSol, paperBuySol, paperSellTokens])
  const currentSnapshot = JSON.stringify({ payload: currentPayload, ventureId: linkedVentureId })
  const isDirty = savedSnapshot !== currentSnapshot

  useEffect(() => {
    let active = true
    void fetch('/api/opportunities/meme-studio', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.error || 'Saved drafts unavailable')
        return data as { drafts: SavedMemeDraft[]; eligibleVentures: EligibleMemeVenture[] }
      })
      .then(data => {
        if (!active) return
        setSavedDrafts(data.drafts)
        setEligibleVentures(data.eligibleVentures)
        setSyncError('')
      })
      .catch(error => { if (active) setSyncError(error instanceof Error ? error.message : 'Storage unavailable') })
      .finally(() => { if (active) setLoadingDrafts(false) })
    return () => { active = false }
  }, [])

  function openSaved(record: SavedMemeDraft) {
    const value = record.payload
    setDraft(value.draft)
    setTier(value.tier)
    setLaborHours(value.laborHours)
    setLaborRate(value.laborRate)
    setOtherCosts(value.otherCosts)
    setPaperSol(value.paperSol)
    setPaperBuySol(value.paperBuySol)
    setPaperSellTokens(value.paperSellTokens)
    setLinkedVentureId(record.ventureId)
    setSavedId(record.id)
    setSavedRevision(record.revision)
    setSavedSnapshot(JSON.stringify({ payload: value, ventureId: record.ventureId }))
    setSyncStatus('Opened saved draft. No live token or wallet.')
    setSyncError('')
    setShowPaper(false)
  }

  function newDraft() {
    setDraft(starter)
    setTier('creation_prep')
    setLaborHours(2)
    setLaborRate(25)
    setOtherCosts(10)
    setPaperSol(2)
    setPaperBuySol(.1)
    setPaperSellTokens(20_000_000)
    setLinkedVentureId(null)
    setSavedId(null)
    setSavedRevision(null)
    setSavedSnapshot(null)
    setSyncError('')
    setSyncStatus('New unsaved paper draft.')
    setShowPaper(false)
  }

  async function saveDraft() {
    setSyncBusy(true)
    setSyncStatus('')
    setSyncError('')
    try {
      const response = await fetch('/api/opportunities/meme-studio', {
        method: savedId ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(savedId ? { id: savedId, revision: savedRevision } : {}),
          payload: currentPayload,
          ventureId: linkedVentureId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(
        response.status === 409 ? 'Another version exists. Reopen your draft before saving.' :
        data.error || 'Draft save failed'
      )
      const record = data.draft as SavedMemeDraft
      setSavedId(record.id)
      setSavedRevision(record.revision)
      setSavedSnapshot(JSON.stringify({ payload: record.payload, ventureId: record.ventureId }))
      setSavedDrafts(old => [record, ...old.filter(item => item.id !== record.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      setSyncStatus('Saved to owner-scoped Jhadina storage. Paper-only; not a Venture admission.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Draft save failed')
    } finally { setSyncBusy(false) }
  }

  async function archiveDraft() {
    if (!savedId || savedRevision === null) return
    if (!window.confirm('Archive this design draft? This does not delete a real token.')) return
    setSyncBusy(true)
    setSyncError('')
    setSyncStatus('')
    try {
      const response = await fetch('/api/opportunities/meme-studio', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: savedId, revision: savedRevision }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Archive failed')
      setSavedDrafts(old => old.filter(item => item.id !== savedId))
      newDraft()
      setSyncStatus('Archived saved draft.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Archive failed')
    } finally { setSyncBusy(false) }
  }

  const output = useMemo(() => {
    try {
      const review = reviewMemeDraft(draft)
      const quote = quoteMemeService({
        tier, estimatedLaborHours: laborHours,
        estimatedLaborCostPerHourUsd: laborRate, estimatedOtherCostUsd: otherCosts,
      })
      const simulation = review.decision === 'paper_preview_only'
        ? simulateMemePool({
          initialReserveSol: paperSol,
          initialReserveTokens: review.poolTokenAllocation,
          feeBps: 30,
          paperTrades: [
            { side: 'buy', amount: paperBuySol },
            { side: 'sell', amount: paperSellTokens },
          ],
        })
        : null
      return { review, quote, simulation, error: '' }
    } catch (error) {
      return {
        review: null,
        quote: null,
        simulation: null,
        error: error instanceof Error ? error.message : 'Preview could not be calculated',
      }
    }
  }, [draft, tier, laborHours, laborRate, otherCosts, paperSol, paperBuySol, paperSellTokens])

  const treasuryStudy = useMemo(() => {
    if (!showTreasuryPlan) return { report: null, error: '' }
    try {
      const report = simulateDisclosedTreasuryProfitTaking({
        totalSupplyTokens: draft.totalSupply,
        creatorAllocationTokens: draft.totalSupply * draft.creatorSupplyPercent / 100,
        poolReserveTokens: draft.totalSupply * draft.poolSupplyPercent / 100,
        poolReserveSol: paperSol,
        hypotheticalSolPriceUsd: assumedSolUsd,
        ammFeeBps: 30,
        assumedNetworkCostSolPerSale: 0.001,
        assumedCostBasisUsdPerToken: 0,
        estimatedBusinessOverheadUsd: 75,
        assumedTaxReservePercent: 25,
        schedulePubliclyDisclosed: assumePublicDisclosure,
        liquidityWithdrawalsForbidden: true,
        inventedVolumeForbidden: true,
        ownerAuthorizedPaperStudy: true,
        plannedSales: [1, 8, 15].map(day => ({
          day, tokens: draft.totalSupply * paperTranchePercent / 100,
        })),
      })
      return { report, error: '' }
    } catch (error) {
      return { report: null, error: error instanceof Error ? error.message : 'Paper study unavailable' }
    }
  }, [showTreasuryPlan, draft.totalSupply, draft.creatorSupplyPercent, draft.poolSupplyPercent, paperSol, assumedSolUsd, paperTranchePercent, assumePublicDisclosure])

  function updateText(key: 'name' | 'ticker' | 'description', value: string) {
    setDraft(old => ({ ...old, [key]: value }))
  }
  function updateNumber(key: 'totalSupply' | 'poolSupplyPercent' | 'creatorSupplyPercent', value: string) {
    setDraft(old => ({ ...old, [key]: Number(value) }))
  }
  const experiment = proposeMemeDemandExperiment({
    durationDays: 7, minimumIndependentResponses: 5,
    priceHypothesisUsd: MEME_SERVICE_THESIS.servicePriceHypothesisUsd,
  })

  return <main style={{ maxWidth: 1120, padding: '32px 18px 90px', margin: '0 auto' }}>
    <Link href="/opportunity/side-hustles" style={{ color: 'inherit', opacity: .7 }}>← Side Hustle Factory</Link>
    <header style={{ margin: '20px 0 30px' }}>
      <p style={{ color: '#c9ab7b', fontWeight: 700, letterSpacing: 1.6, fontSize: 12 }}>JHADINA · MEME-VENTURE.01–.08</p>
      <h1 style={{ fontSize: 'clamp(30px, 6vw, 46px)', lineHeight: 1.1, margin: '10px 0' }}>Token Creator Studio</h1>
      <p style={{ ...hint, maxWidth: 760 }}>
        Original meme-brand preparation, transparent allocations, hypothetical liquidity scenarios and a nonbinding service estimate.
        This workspace is offline and paper-only. No wallet connection, token minting, deposits, trades or real earnings.
      </p>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 15 }}>
        {['Research candidate', 'No real SOL', 'No signing', 'No token launch'].map(x =>
          <span key={x} style={{ border: '1px solid rgba(160,160,160,.45)', borderRadius: 20, padding: '6px 10px', fontSize: 12 }}>{x}</span>)}
      </div>
    </header>

    <section style={{ ...panel, marginBottom: 18 }} aria-label="Saved Token Creator drafts">
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Saved drafts</h2>
      <p style={hint}>Private, authenticated design storage. Saving does not mint a coin, submit an opportunity, publish a campaign, or collect funds.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 12 }}>
        <label>Open a saved design
          <select aria-label="Saved designs" style={inputStyle} value={savedId || ''}
            onChange={event => {
              if (!event.target.value) { newDraft(); return }
              const item = savedDrafts.find(record => record.id === event.target.value)
              if (item) openSaved(item)
            }}>
            <option value="" style={{ color: '#111' }}>New / unsaved design</option>
            {savedDrafts.map(record => <option key={record.id} value={record.id} style={{ color: '#111' }}>
              {record.payload.draft.name} ({record.payload.draft.ticker}) · v{record.revision}
            </option>)}
          </select>
        </label>
        <label>Canonical Venture Factory link (optional)
          <select aria-label="Existing adopted venture" style={inputStyle}
            value={linkedVentureId || ''} onChange={event => setLinkedVentureId(event.target.value || null)}>
            <option value="" style={{ color: '#111' }}>Unlinked research draft</option>
            {eligibleVentures.map(venture => <option key={venture.id} value={venture.id} style={{ color: '#111' }}>
              {venture.title}
            </option>)}
          </select>
        </label>
      </div>
      <p style={hint}>Only an already-adopted Token Services venture appears in the link menu. A saved draft never creates a Venture record or grants permission to launch.</p>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <button type="button" style={buttonStyle} disabled={syncBusy || loadingDrafts} onClick={() => void saveDraft()}>
          {syncBusy ? 'Updating…' : savedId ? 'Save revision' : 'Save new draft'}
        </button>
        <button type="button" disabled={syncBusy} onClick={newDraft} style={{ ...buttonStyle, background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}>New design</button>
        {savedId && <button type="button" disabled={syncBusy} onClick={() => void archiveDraft()}
          style={{ ...buttonStyle, background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}>Archive</button>}
        <span style={{ fontSize: 12, opacity: .75 }}>{loadingDrafts ? 'Checking storage…' : savedId
          ? 'Revision ' + savedRevision + (isDirty ? ' · Unsaved edits' : ' · Up to date')
          : 'Unsaved design'}</span>
      </div>
      {syncError && <p role="alert" style={{ color: '#cc6b58', marginBottom: 0 }}>{syncError}. Your current edits remain on this screen.</p>}
      {syncStatus && <p role="status" style={{ color: 'inherit', marginBottom: 0 }}>{syncStatus}</p>}
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,330px),1fr))', gap: 18 }}>
      <section style={panel}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>1. Create an original concept</h2>
        <p style={hint}>Starter content is fictional and does not demonstrate rights clearance.</p>
        <label style={{ display: 'block', marginTop: 18 }}>Name
          <input aria-label="Token name" style={inputStyle} value={draft.name} maxLength={40} onChange={e => updateText('name', e.target.value)} />
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>Ticker
          <input aria-label="Token ticker" style={inputStyle} value={draft.ticker} maxLength={10}
            onChange={e => updateText('ticker', e.target.value.toUpperCase())} />
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>Concept description
          <textarea aria-label="Token description" style={{ ...inputStyle, minHeight: 92 }} value={draft.description}
            maxLength={280} onChange={e => updateText('description', e.target.value)} />
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>Total hypothetical supply
          <input type="number" min="1" max="1000000000000" step="1" style={inputStyle} value={draft.totalSupply}
            onChange={e => updateNumber('totalSupply', e.target.value)} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <label>Pool allocation %
            <input type="number" min="0" max="100" style={inputStyle} value={draft.poolSupplyPercent}
              onChange={e => updateNumber('poolSupplyPercent', e.target.value)} />
          </label>
          <label>Creator allocation %
            <input type="number" min="0" max="100" style={inputStyle} value={draft.creatorSupplyPercent}
              onChange={e => updateNumber('creatorSupplyPercent', e.target.value)} />
          </label>
        </div>
        <p style={hint}>Allocations are illustrative. No token exists and no liquidity is deposited.</p>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>2. Rights and conduct checks</h2>
        <p style={hint}>Self-attestations only. Independent ownership, security and legal reviews are still mandatory.</p>
        <div style={{ display: 'grid', gap: 13, marginTop: 16 }}>
          {confirmations.map(row => <label key={row.key} style={{ display: 'flex', gap: 11, fontSize: 14, lineHeight: 1.4 }}>
            <input type="checkbox" checked={draft[row.key]}
              onChange={e => setDraft(old => ({ ...old, [row.key]: e.target.checked }))}
              style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span>{row.title}</span>
          </label>)}
        </div>
        <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: 'rgba(200,140,70,.10)' }}>
          <strong>{output.error ? 'Invalid inputs' : output.review?.decision === 'blocked' ? 'Preview blocked' : 'Paper preview available'}</strong>
          <p style={{ ...hint, marginBottom: 0 }}>{output.error || (output.review?.blockers.join(' · ') || 'Preliminary checks recorded. Not cleared for launch.')}</p>
        </div>
        {output.review?.metadata && <div style={{ marginTop: 16, fontSize: 14 }}>
          <p><strong>Original mock metadata:</strong> {output.review.metadata.name} ({output.review.metadata.symbol})</p>
          <p>Pool: {tokens(output.review.poolTokenAllocation)} tokens</p>
          <p>Creator: {tokens(output.review.creatorTokenAllocation)} tokens</p>
          <p>Unallocated: {tokens(output.review.unsoldOrUnallocatedTokens)} tokens</p>
        </div>}
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>3. Service estimate</h2>
        <p style={hint}>An optional service pricing hypothesis. Not an invoice, booking or request for payment.</p>
        <label style={{ display: 'block', marginTop: 14 }}>Scope
          <select style={inputStyle} value={tier} onChange={e => setTier(e.target.value as MemeServiceTier)}>
            <option value="brand_preview" style={{ color: '#111' }}>Brand preview — proposed $49</option>
            <option value="creation_prep" style={{ color: '#111' }}>Creation preparation — proposed $149</option>
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 9, marginTop: 15 }}>
          <label style={{ fontSize: 12 }}>Labor hours
            <input aria-label="Estimated labor hours" type="number" min="0" step=".5" style={inputStyle} value={laborHours} onChange={e => setLaborHours(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12 }}>$/hour
            <input aria-label="Estimated hourly cost" type="number" min="0" step="1" style={inputStyle} value={laborRate} onChange={e => setLaborRate(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12 }}>Other $
            <input aria-label="Estimated other costs" type="number" min="0" step="1" style={inputStyle} value={otherCosts} onChange={e => setOtherCosts(Number(e.target.value))} />
          </label>
        </div>
        {output.quote && <div style={{ marginTop: 18, lineHeight: 2 }}>
          <div>Proposed price: <strong>{money(output.quote.proposedPriceUsd)}</strong></div>
          <div>Assumed costs: <strong>{money(output.quote.estimatedCostUsd)}</strong></div>
          <div>Estimated gross margin: <strong>{money(output.quote.estimatedGrossMarginUsd)}</strong></div>
          <div>Actual revenue: <strong>$0.00</strong></div>
        </div>}
        <p style={hint}>Costs exclude unspecified taxes, refunds, compliance review and network fees. Customer demand and price acceptance are unverified.</p>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>4. Liquidity experiment</h2>
        <p style={hint}>Constant-product AMM simulation with hypothetical user-specified inputs. No bots, wallet or chain activity.</p>
        <label style={{ display: 'block', marginTop: 14 }}>Hypothetical initial SOL reserve
          <input type="number" aria-label="Paper initial SOL" min=".000001" step=".1" style={inputStyle}
            value={paperSol} onChange={e => setPaperSol(Number(e.target.value))} />
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>Hypothetical buy (SOL in)
          <input type="number" aria-label="Paper SOL buy" min=".000001" step=".01" style={inputStyle}
            value={paperBuySol} onChange={e => setPaperBuySol(Number(e.target.value))} />
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>Hypothetical sell (tokens in)
          <input type="number" aria-label="Paper token sell" min=".000001" step="1000000" style={inputStyle}
            value={paperSellTokens} onChange={e => setPaperSellTokens(Number(e.target.value))} />
        </label>
        <button type="button" style={{ ...buttonStyle, marginTop: 18 }} onClick={() => setShowPaper(true)}>
          Run paper simulation
        </button>
        {showPaper && output.simulation && <div role="status" style={{ marginTop: 16 }}>
          <p>Ending paper reserve: <strong>{output.simulation.reserveSol.toFixed(6)} SOL</strong></p>
          <p>Ending paper tokens: <strong>{tokens(output.simulation.reserveTokens)}</strong></p>
          <p>Hypothetical events: <strong>{output.simulation.receipts.length}</strong></p>
          <p>Paper buy slippage (excluding fees): <strong>{output.simulation.receipts[0].slippagePercentExcludingFee.toFixed(2)}%</strong></p>
          <p>Realized owner revenue: <strong>$0.00</strong></p>
          <p style={hint}>30 bps AMM input fee assumed. Fees stay in the simulated pool; no one received them.</p>
        </div>}
      </section>
    </div>

    <section style={{ ...panel, marginTop: 18 }}>
      <h2 style={{ marginTop: 0 }}>5. Transparent profit-taking — paper study</h2>
      <p style={hint}>Proposed creator-treasury sales are different from withdrawing pooled liquidity. Every sale is hypothetical, must have an advance public schedule, and is refused if the amount or simulated price impact exceeds policy limits. No automatic selling.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <label>Assumed SOL price in USD (not live)
          <input type="number" min=".00001" step="1" style={inputStyle}
            aria-label="Assumed SOL price" value={assumedSolUsd}
            onChange={e => setAssumedSolUsd(Number(e.target.value))}/>
        </label>
        <label>Hypothetical tokens sold per slice (% total supply)
          <input type="number" min=".001" max=".25" step=".01" style={inputStyle}
            aria-label="Paper sale percent of supply" value={paperTranchePercent}
            onChange={e => setPaperTranchePercent(Number(e.target.value))}/>
        </label>
      </div>
      <label style={{ display: 'flex', gap: 10, marginTop: 16, lineHeight: 1.4 }}>
        <input type="checkbox" checked={assumePublicDisclosure}
          onChange={e => setAssumePublicDisclosure(e.target.checked)} />
        Assume a future treasury sale schedule is publicly disclosed in advance (scenario assumption only; no real disclosure has occurred)
      </label>
      <button type="button" onClick={() => setShowTreasuryPlan(old => !old)}
        style={{ ...buttonStyle, marginTop: 15 }}>
        {showTreasuryPlan ? 'Hide paper profit study' : 'Calculate paper profit study'}
      </button>
      {showTreasuryPlan && <div aria-live="polite" style={{ marginTop: 12, lineHeight: 1.65 }}>
        {treasuryStudy.error && <p role="alert">Cannot run study: {treasuryStudy.error}</p>}
        {treasuryStudy.report?.status === 'BLOCKED' && <>
          <strong>Scenario refused — no sale can be executed.</strong>
          <p style={hint}>{treasuryStudy.report.refusals.join(' · ')}</p>
        </>}
        {treasuryStudy.report?.status === 'SIMULATED' && <>
          <strong>3 hypothetical sales — days 1, 8 and 15</strong>
          <p>Hypothetical total sold: {tokens(treasuryStudy.report.hypotheticalTotalSoldTokens)} tokens</p>
          <p>Hypothetical net proceeds before tax reserve: {money(treasuryStudy.report.hypotheticalTotalNetProceedsUsdBeforeTaxReserve)}</p>
          <p>Hypothetical P/L after assumed basis and $75 overhead, before tax: <strong>{money(treasuryStudy.report.hypotheticalProfitBeforeTaxUsd)}</strong></p>
          <p>Remaining hypothetical treasury tokens: {tokens(treasuryStudy.report.hypotheticalRemainingTreasuryTokens)}</p>
          <p style={hint}>Each tranche must remain below 0.25% of supply, total slices below 5% of declared creator inventory, and simulated spot-price impact below 150 bps. A 0.001 SOL transaction cost per sale and 25% of positive hypothetical profit as a tax reserve are assumed—not verified.</p>
        </>}
        <p><strong>Actual revenue: $0.00 · Actual profit: $0.00 · Orders/signing: disabled.</strong></p>
      </div>}
    </section>

    <section style={{ ...panel, marginTop: 18 }}>
      <h2 style={{ marginTop: 0 }}>6. Demand experiment and venture gate</h2>
      <p style={hint}>Research may proceed without spending, but actual publication, outreach, custody, token issuance and investment activity require separate canonical approvals.</p>
      <button type="button" style={buttonStyle} onClick={() => setShowExperiment(old => !old)}>
        {showExperiment ? 'Hide proposed experiment' : 'View proposed 7-day test'}
      </button>
      {showExperiment && <div style={{ marginTop: 16 }}>
        <p><strong>Hypothesis:</strong> {experiment.question}</p>
        <p><strong>Limits:</strong> {experiment.durationDays} days · $0 proposed spend · at least {experiment.minimumIndependentResponses} independently evidenced responses</p>
        <p><strong>State:</strong> Proposal only. Not approved, published, started or measured.</p>
      </div>}
      <p style={{ ...hint, marginTop: 16 }}>
        MEME-VENTURE final gate: {MEME_VENTURE_ACCEPTANCE.liveStatus.replaceAll('_', ' ').toLowerCase()}.
        Independent legal and security reviews, real demand evidence and reconciled commercial receipts are still missing.
      </p>
    </section>
  </main>
}
