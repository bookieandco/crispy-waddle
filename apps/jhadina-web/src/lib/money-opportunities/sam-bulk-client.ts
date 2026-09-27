import { createHash } from 'node:crypto'

export const DEFAULT_SAM_BULK_URL =
  'https://s3.amazonaws.com/falextracts/Contract%20Opportunities/datagov/ContractOpportunitiesFullCSV.csv'

export type SamBulkRow = Record<string, string>
export type SamBulkStreamReceipt = {
  sourceUrl: string
  sha256: string
  bytes: number
  sourceRows: number
  headers: string[]
  lastModified?: string
}

type CsvState = {
  field: string
  row: string[]
  inQuotes: boolean
  pendingQuote: boolean
  skipLf: boolean
}

const csvState = (): CsvState => ({
  field: '',
  row: [],
  inQuotes: false,
  pendingQuote: false,
  skipLf: false,
})

function finishField(state: CsvState) {
  state.row.push(state.field)
  state.field = ''
}

function finishRow(state: CsvState, out: string[][]) {
  finishField(state)
  out.push(state.row)
  state.row = []
}

function consumeCsvText(text: string, state: CsvState): string[][] {
  const out: string[][] = []

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!

    if (state.pendingQuote) {
      state.pendingQuote = false
      if (char === '"') {
        state.field += '"'
        continue
      }
      state.inQuotes = false
      // The quote at the end of the previous chunk closed the quoted field.
      // Process this character again using the unquoted rules below.
    }

    if (state.inQuotes) {
      if (char !== '"') {
        state.field += char
        continue
      }
      if (index + 1 >= text.length) {
        state.pendingQuote = true
        continue
      }
      if (text[index + 1] === '"') {
        state.field += '"'
        index += 1
        continue
      }
      state.inQuotes = false
      continue
    }

    if (state.skipLf) {
      state.skipLf = false
      if (char === '\n') continue
    }

    if (char === '"' && state.field.length === 0) {
      state.inQuotes = true
      continue
    }
    if (char === ',') {
      finishField(state)
      continue
    }
    if (char === '\r') {
      finishRow(state, out)
      state.skipLf = true
      continue
    }
    if (char === '\n') {
      finishRow(state, out)
      continue
    }
    state.field += char
  }

  return out
}

function finishCsv(state: CsvState): string[][] {
  if (state.pendingQuote) {
    state.pendingQuote = false
    state.inQuotes = false
  }
  if (state.inQuotes) throw new Error('SAM bulk CSV ended inside a quoted field')

  const out: string[][] = []
  if (state.field.length > 0 || state.row.length > 0) finishRow(state, out)
  return out
}

const normalizeHeader = (value: string, index: number) =>
  (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim()

function isHeaderRow(row: string[]) {
  const columns = new Set(row.map(normalizeHeader))
  return columns.has('NoticeId') && columns.has('Title') && columns.has('PostedDate')
}

function rowObject(headers: string[], values: string[]): SamBulkRow {
  const row: SamBulkRow = {}
  for (let index = 0; index < headers.length; index += 1) {
    row[headers[index]!] = values[index] ?? ''
  }
  return row
}

export async function streamSamBulkRows(input: {
  sourceUrl?: string
  fetchImpl?: typeof fetch
  onRow: (row: SamBulkRow) => void | Promise<void>
}): Promise<SamBulkStreamReceipt> {
  const sourceUrl = input.sourceUrl ?? DEFAULT_SAM_BULK_URL
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(sourceUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/csv,*/*;q=0.8',
      'User-Agent': 'Jhadina-SAM-Bulk/1.0',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10 * 60_000),
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(`SAM_BULK_DOWNLOAD_FAILED:${response.status || 'unknown'}`)
  }

  const decoder = new TextDecoder('utf-8')
  const reader = response.body.getReader()
  const hash = createHash('sha256')
  const state = csvState()
  let headers: string[] | null = null
  let bytes = 0
  let sourceRows = 0

  async function consume(records: string[][]) {
    for (const record of records) {
      if (record.length === 1 && record[0]?.trim() === '') continue
      if (!headers) {
        if (!isHeaderRow(record)) continue
        headers = record.map(normalizeHeader)
        continue
      }
      sourceRows += 1
      await input.onRow(rowObject(headers, record))
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    bytes += value.byteLength
    hash.update(value)
    await consume(consumeCsvText(decoder.decode(value, { stream: true }), state))
  }

  const tail = decoder.decode()
  if (tail) await consume(consumeCsvText(tail, state))
  await consume(finishCsv(state))

  if (!headers) throw new Error('SAM_BULK_SCHEMA_MISSING_REQUIRED_HEADERS')
  if (sourceRows < 1) throw new Error('SAM_BULK_EMPTY_SNAPSHOT')

  return {
    sourceUrl,
    sha256: hash.digest('hex'),
    bytes,
    sourceRows,
    headers,
    lastModified: response.headers.get('last-modified') ?? undefined,
  }
}

const value = (row: SamBulkRow, ...keys: string[]) => {
  for (const key of keys) {
    const candidate = row[key]?.trim()
    if (candidate) return candidate
  }
  return ''
}

export function samBulkPostedDay(row: SamBulkRow): string | null {
  const raw = value(row, 'PostedDate')
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`
  return null
}

export function samBulkRowToApiNotice(row: SamBulkRow): Record<string, unknown> {
  const noticeId = value(row, 'NoticeId', 'Sol#')
  const solicitationNumber = value(row, 'Sol#', 'SolicitationNumber')
  const link = value(row, 'Link')
  const additionalInfoLink = value(row, 'AdditionalInfoLink')
  const popCity = value(row, 'PopCity')
  const popState = value(row, 'PopState')
  const popCountry = value(row, 'PopCountry')
  const popZip = value(row, 'PopZip')

  return {
    noticeId,
    solicitationNumber,
    title: value(row, 'Title'),
    type: value(row, 'Type'),
    baseType: value(row, 'BaseType'),
    postedDate: value(row, 'PostedDate'),
    responseDeadLine: value(row, 'ResponseDeadLine'),
    archiveDate: value(row, 'ArchiveDate'),
    naicsCode: value(row, 'NaicsCode'),
    classificationCode: value(row, 'ClassificationCode'),
    typeOfSetAsideDescription: value(row, 'SetASide'),
    typeOfSetAside: value(row, 'SetASideCode'),
    fullParentPathName: value(row, 'Department/Ind.Agency'),
    department: value(row, 'Department/Ind.Agency'),
    subTier: value(row, 'Sub-Tier'),
    office: value(row, 'Office'),
    placeOfPerformance: {
      city: popCity ? { name: popCity } : undefined,
      state: popState ? { name: popState, code: popState } : undefined,
      country: popCountry ? { name: popCountry, code: popCountry } : undefined,
      zip: popZip || undefined,
    },
    description: value(row, 'Description'),
    uiLink: link,
    additionalInfoLink,
    active: value(row, 'Active'),
    award: {
      number: value(row, 'AwardNumber'),
      amount: value(row, 'Award$'),
      date: value(row, 'AwardDate'),
      awardee: value(row, 'Awardee'),
    },
    bulkSource: 'SAM.gov Contract Opportunities public full CSV',
  }
}
