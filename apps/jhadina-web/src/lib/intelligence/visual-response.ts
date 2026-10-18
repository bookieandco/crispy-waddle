/**
 * JLLM Visual Response v1 — presentation only.
 *
 * A deterministic projection of a governed answer, never an executable
 * model payload. It cannot grant capability, cite new sources or write state.
 * Do not insert model-authored HTML, JSX, SVG, CSS, JS, URLs or callbacks.
 */
export type VisualKind = "checklist" | "stepper" | "diagram" | "bars" | "gallery"

export type VisualItem = {
  id: string
  label: string
  detail?: string
  value?: number
  unit?: string
}

export type VisualResponse = {
  version: 1
  kind: VisualKind
  title: string
  items: VisualItem[]
  note: string
  authority: "PRESENTATION_ONLY"
}

export type VisualProposal = {
  disposition: "PROCEED" | "ASK" | "DECLINE" | "DEFER"
  recommendation: string
  evidence?: readonly { id: string; source: string; summary: string }[]
}

const MAX_ITEMS = 8
const MAX_INPUT_LENGTH = 12000
const CLEAN_PREFIX = /^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/
const NUMERIC_LINE = /^(.{2,72}?)\s*[:—-]\s*(\$)?(\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?)\s*(%|points|votes|usd|kg|ms)?\s*[.!]?$/i
const KNOWN_KINDS: readonly VisualKind[] = ["checklist", "stepper", "diagram", "bars", "gallery"]

function cleanText(value: string, limit: number): string {
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
}

function entriesFromRecommendation(recommendation: string): string[] {
  const lines = recommendation.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const bulletLines = lines.filter(line => CLEAN_PREFIX.test(line))
  const parts = bulletLines.length >= 2
    ? bulletLines.map(line => line.replace(CLEAN_PREFIX, ""))
    : recommendation.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  return [...new Set(parts.map(part => cleanText(part, 320)).filter(part => part.length >= 8))].slice(0, MAX_ITEMS)
}

function numbered(items: readonly string[]): VisualItem[] {
  return items.map((content, index) => ({
    id: String(index + 1),
    label: cleanText(content, 160),
    ...(content.length > 160 ? { detail: cleanText(content.slice(160), 160) } : {}),
  }))
}

function numericItems(parts: readonly string[]): VisualItem[] | null {
  const numeric = parts.map(value => {
    const match = NUMERIC_LINE.exec(value)
    if (!match) return null
    const parsed = Number(match[3].replace(/,/g, ""))
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return { label: cleanText(match[1], 100), value: parsed, unit: match[2] ? "USD" : (match[4] || "number").toLowerCase() }
  }).filter((value): value is { label: string; value: number; unit: string } => value !== null)
  if (numeric.length < 2 || numeric.some(value => value.unit !== numeric[0].unit)) return null
  return numeric.slice(0, MAX_ITEMS).map((value, index) => ({ ...value, id: String(index + 1) }))
}

/** Called only after the command has traversed normal JLLM governance. */
export function buildVisualResponse(input: {
  activeTask: string
  proposal: VisualProposal
  verified: boolean
}): VisualResponse | null {
  if (!input.verified || input.proposal.disposition !== "PROCEED") return null
  if (!input.activeTask || !input.proposal.recommendation || input.proposal.recommendation.length > MAX_INPUT_LENGTH) return null

  const task = input.activeTask.slice(0, 1000).toLowerCase()
  if (!/\b(interactive|visual|illustrat\w*|diagram|flowchart|checklist|step.by.step|walkthrough|gallery|photograph\w*|picture\w*|chart\w*|graph\w*|plot|comparison|compare|timeline|stages|recipe|ingredients|steps|explore)\b/i.test(task)) return null

  const parts = entriesFromRecommendation(input.proposal.recommendation)
  const genericNote = "Interactive presentation of the governed answer; not independent evidence or permission to act."
  const wantsChart = /\b(chart|graph|plot|visualize data|bar chart)\b/i.test(task)
  if (wantsChart) {
    const bars = numericItems(parts)
    if (bars) return { version: 1, kind: "bars", title: "Data from this answer", items: bars, note: "Only comparable numbers explicitly in the answer are plotted. No values are estimated.", authority: "PRESENTATION_ONLY" }
  }

  if (/\b(gallery|photographs?|pictures?|photos?|images?)\b/i.test(task)) {
    const evidence = (input.proposal.evidence ?? []).filter(item => item.id && item.source && item.summary).slice(0, MAX_ITEMS)
    if (evidence.length >= 2) return {
      version: 1, kind: "gallery", title: "Explore the cited sources",
      items: evidence.map((item, index) => ({ id: String(index + 1), label: cleanText(item.source, 160), detail: cleanText(item.summary, 160) })),
      note: "Source cards only. No photographs are supplied or invented; image retrieval needs a separately verified media source.",
      authority: "PRESENTATION_ONLY",
    }
  }

  if (parts.length < 2) return null
  const kind: VisualKind = /\b(checklist|ingredients|recipe|to.do)\b/i.test(task) ? "checklist"
    : /\b(diagram|flowchart|lifecycle|life cycle|architecture)\b/i.test(task) ? "diagram"
    : "stepper"
  return {
    version: 1,
    kind,
    title: kind === "checklist" ? "Interactive checklist" : kind === "diagram" ? "Visual sequence" : "Step-by-step explorer",
    items: numbered(parts),
    note: wantsChart ? "No comparable numeric series was present, so this is a text walkthrough rather than a fabricated chart." : genericNote,
    authority: "PRESENTATION_ONLY",
  }
}

/** Revalidate JSON crossing the HTTP boundary before rendering it. */
export function parseVisualResponse(raw: unknown): VisualResponse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  if (data.version !== 1 || data.authority !== "PRESENTATION_ONLY" || !KNOWN_KINDS.includes(data.kind as VisualKind)) return null
  if (typeof data.title !== "string" || data.title.length > 120 || typeof data.note !== "string" || data.note.length > 400) return null
  if (!Array.isArray(data.items) || data.items.length < 2 || data.items.length > MAX_ITEMS) return null
  const items: VisualItem[] = []
  for (const value of data.items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const item = value as Record<string, unknown>
    if (typeof item.id !== "string" || item.id.length > 32 || typeof item.label !== "string" || item.label.length < 1 || item.label.length > 160) return null
    if (item.detail !== undefined && (typeof item.detail !== "string" || item.detail.length > 160)) return null
    if (item.value !== undefined && (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0)) return null
    if (item.unit !== undefined && (typeof item.unit !== "string" || item.unit.length > 12)) return null
    items.push({
      id: item.id, label: cleanText(item.label, 160),
      ...(typeof item.detail === "string" ? { detail: cleanText(item.detail, 160) } : {}),
      ...(typeof item.value === "number" ? { value: item.value } : {}),
      ...(typeof item.unit === "string" ? { unit: cleanText(item.unit, 12) } : {}),
    })
  }
  if (new Set(items.map(item => item.id)).size !== items.length) return null
  if (data.kind === "bars" && (items.some(item => item.value === undefined) || items.some(item => item.unit !== items[0].unit))) return null
  return {
    version: 1, kind: data.kind as VisualKind, title: cleanText(data.title, 120),
    note: cleanText(data.note, 400), authority: "PRESENTATION_ONLY", items,
  }
}
