import { adaptEmploymentOpportunity, type Opportunity } from '@jhadina/opportunity-core'

/** Public GET listings only; no applications, crawling arbitrary URLs, account access or outreach. */
export type PublicBoardSource = 'greenhouse' | 'lever'
export type BoardInput = { source: PublicBoardSource; board: string; limit?: number }
type ResponseLike = { body?: ReadableStream<Uint8Array> | null; ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }
type Fetcher = (url: string, options: { headers: Record<string,string>; redirect: 'error'; cache: 'no-store'; signal: AbortSignal }) => Promise<ResponseLike>
type JobRow = { id?: number | string; title?: string; text?: string; absolute_url?: string; hostedUrl?: string; applyUrl?: string; location?: { name?: string }; categories?: { location?: string; commitment?: string }; updated_at?: string }
const BOARD_PATTERN = /^[a-z0-9][a-z0-9_-]{1,49}$/i
const MAX_JOBS = 25
const MAX_BODY_BYTES = 5_000_000

function safeListingUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') ||
        /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return undefined
    return url.toString()
  } catch { return undefined }
}
function nonempty(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0,500) : ''
}
export function normalizePublicBoardRows(input: BoardInput, payload: unknown, capturedAt: string): Opportunity[] {
  if (!BOARD_PATTERN.test(input.board)) throw new Error('Invalid board identifier')
  const raw = input.source === 'greenhouse' && payload && typeof payload === 'object'
    ? (payload as { jobs?: unknown }).jobs
    : payload
  if (!Array.isArray(raw)) throw new Error('Provider returned an unexpected jobs format')
  const limit = Number.isInteger(input.limit) ? Math.max(1, Math.min(input.limit!, MAX_JOBS)) : MAX_JOBS
  const seen = new Set<string>()
  const output: Opportunity[] = []
  for (const candidate of raw.slice(0,500)) {
    if (output.length >= limit) break
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as JobRow
    const id = typeof row.id === 'number' && Number.isSafeInteger(row.id) ? String(row.id) : typeof row.id === 'string' ? row.id : ''
    const title = nonempty(row.title || row.text)
    const url = safeListingUrl(input.source === 'greenhouse' ? row.absolute_url : row.hostedUrl)
    if (!/^[\w-]{1,100}$/.test(id) || !title || !url || seen.has(id)) continue
    seen.add(id)
    const location = nonempty(input.source === 'greenhouse' ? row.location?.name : row.categories?.location)
    const sourceName = `${input.source === 'greenhouse' ? 'Greenhouse' : 'Lever'} / ${input.board}`
    const opportunity = adaptEmploymentOpportunity({
      providerId: 'provider:placement-jobs',
      externalId: `${input.source}:${input.board.toLowerCase()}:${id}`,
      title,
      sourceUrl: url,
      sourceName,
      description: location ? `Published job listing. Location: ${location}.` : 'Published job listing. Location/remote eligibility not independently checked.',
      kind: 'ai_job',
      remote: /\bremote\b/i.test(`${title} ${location}`),
      sourceType: 'official',
      capturedAt,
      confidence: 0.8,
      riskFlags: ['ELIGIBILITY_UNVERIFIED', 'APPLICATION_OWNER_REQUIRED', 'AI_WORK_POLICY_UNVERIFIED'],
    })
    opportunity.metadata = {
      ...opportunity.metadata,
      discoveredBy: 'public_job_board_get',
      boardSource: input.source,
      boardToken: input.board,
      externalJobId: id,
      applicationAuthority: 'NONE',
      discoveryOnly: true,
      providerUsage: 'PUBLIC_GET_ONLY',
    }
    output.push(opportunity)
  }
  return output
}

export async function discoverPublicBoard(input: BoardInput, fetcher: Fetcher = fetch as unknown as Fetcher) {
  if (!BOARD_PATTERN.test(input.board)) throw new Error('Board must be a published company site token')
  if (input.source !== 'greenhouse' && input.source !== 'lever') throw new Error('Unsupported public board provider')
  const board = input.board.toLowerCase()
  const url = input.source === 'greenhouse'
    ? `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`
    : `https://api.lever.co/v0/postings/${board}?mode=json&limit=100`
  const res = await fetcher(url, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Public board returned HTTP ${res.status}`)
  const length = Number(res.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new Error('Public board payload exceeds limit')
  const payload = await boundedPublicBoardJson(res)
  const capturedAt = new Date().toISOString()
  return { sourceUrl: url, capturedAt, opportunities: normalizePublicBoardRows(input, payload, capturedAt) }
}

/** Limit actual network bytes even if Content-Length is absent or dishonest. */
async function boundedPublicBoardJson(response: ResponseLike): Promise<unknown> {
  if (!response.body) return response.json()
  const reader=response.body.getReader()
  const chunks: Uint8Array[]=[]
  let size=0
  while(true){
    const next=await reader.read()
    if(next.done)break
    size+=next.value.byteLength
    if(size>MAX_BODY_BYTES){
      await reader.cancel().catch(()=>undefined)
      throw new Error('Public board response exceeds limit')
    }
    chunks.push(next.value)
  }
  const result=new Uint8Array(size)
  let offset=0
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder().decode(result)) as unknown
}
