import { adaptEmploymentOpportunity } from './employment.js'
import type { Opportunity } from '../domain/opportunity.js'

export type RemoteOkJobListing = {
  id: string
  slug?: string
  date?: string
  epoch?: number
  company: string
  position: string
  tags: string[]
  description?: string
  location?: string
  applyUrl?: string
  salaryMin?: number
  salaryMax?: number
  url: string
}

export type RemoteOkFeed = {
  legal?: string
  lastUpdated?: number
  jobs: RemoteOkJobListing[]
}

const AI_PATTERNS = [
  /\bartificial intelligence\b/i,
  /\bgenerative ai\b/i,
  /\bgenai\b/i,
  /\bmachine learning\b/i,
  /\bdeep learning\b/i,
  /\blarge language model(?:s)?\b/i,
  /\bllm(?:s)?\b/i,
  /\bcomputer vision\b/i,
  /\bnatural language processing\b/i,
  /\bnlp\b/i,
  /\bai\b/i,
  /\bml\b/i,
]

export function parseRemoteOkFeed(value: unknown): RemoteOkFeed {
  if (!Array.isArray(value)) throw new Error('Remote OK feed must be an array')

  let legal: string | undefined
  let lastUpdated: number | undefined
  const jobs: RemoteOkJobListing[] = []

  for (const item of value) {
    if (!isRecord(item)) continue

    if (typeof item.legal === 'string' && item.legal.trim()) {
      legal = item.legal.trim()
      lastUpdated = finiteNumber(item.last_updated)
      continue
    }

    const id = text(item.id)
    const position = text(item.position)
    const company = text(item.company)
    const url = text(item.url) || text(item.apply_url)
    if (!id || !position || !company || !url) continue

    jobs.push({
      id,
      slug: optionalText(item.slug),
      date: optionalText(item.date),
      epoch: finiteNumber(item.epoch),
      company,
      position,
      tags: stringArray(item.tags),
      description: optionalText(item.description),
      location: optionalText(item.location),
      applyUrl: optionalText(item.apply_url),
      salaryMin: positiveNumber(item.salary_min),
      salaryMax: positiveNumber(item.salary_max),
      url,
    })
  }

  return { legal, lastUpdated, jobs }
}

export function isRemoteOkAiJob(job: RemoteOkJobListing): boolean {
  const searchable = [job.position, ...job.tags].join(' ')
  return AI_PATTERNS.some((pattern) => pattern.test(searchable))
}

export function adaptRemoteOkAiJob(
  job: RemoteOkJobListing,
  capturedAt = new Date().toISOString(),
): Opportunity {
  if (!isRemoteOkAiJob(job)) throw new Error('Remote OK listing is not classified as an AI job')

  const sourceUrl = requireRemoteOkUrl(job.url || job.applyUrl)
  const pay = salary(job)
  const riskFlags = [
    'secondary_job_board_source',
    'employer_verification_required',
    ...(pay ? [] : ['salary_not_supplied']),
  ]

  const opportunity = adaptEmploymentOpportunity({
    providerId: 'provider:remoteok',
    externalId: job.id,
    title: job.position,
    sourceUrl,
    sourceName: 'Remote OK',
    description: summarize(job),
    kind: 'ai_job',
    pay,
    remote: true,
    capturedAt,
    confidence: 0.85,
    sourceType: 'secondary',
    riskFlags,
  })

  return {
    ...opportunity,
    metadata: {
      ...opportunity.metadata,
      employerName: job.company,
      jobLocation: job.location ?? 'Remote',
      jobTags: [...job.tags],
      postedAt: job.date ?? null,
      sourceExternalId: job.id,
      sourceAttribution: {
        name: 'Remote OK',
        required: true,
        linkBackRequired: true,
      },
      placementHandoffOwner: 'Placement Core',
      autoApplyAuthorized: false,
    },
  }
}

function salary(job: RemoteOkJobListing): { min?: number; max?: number; currency: string; cadence: string } | undefined {
  if (job.salaryMin === undefined && job.salaryMax === undefined) return undefined
  return {
    min: job.salaryMin,
    max: job.salaryMax,
    currency: 'USD',
    cadence: 'unknown',
  }
}

function summarize(job: RemoteOkJobListing): string {
  const body = stripHtml(job.description ?? '')
  const prefix = [job.company, job.location].filter(Boolean).join(' · ')
  return [prefix, body].filter(Boolean).join('\n\n').slice(0, 3000)
}

function requireRemoteOkUrl(raw: string | undefined): string {
  if (!raw) throw new Error('Remote OK listing requires a link-back URL')
  const parsed = new URL(raw)
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'remoteok.com') throw new Error('Remote OK listing URL must link back to Remote OK')
  return parsed.toString()
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function optionalText(value: unknown): string | undefined {
  const normalized = text(value)
  return normalized || undefined
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}
